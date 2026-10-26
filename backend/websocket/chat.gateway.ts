import { IncomingMessage, Server as HttpServer } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import { AppDataSource } from "../config/data.source";
import { config } from "../config/config";
import { User, UserStatus } from "../entities/user.entity";
import { canAccessConversation, saveMessage, ChatActor } from "../services/chat.service";

interface AccessPayload extends JwtPayload {
  userId: string;
  type: "ACCESS";
}

interface ChatSocket extends WebSocket {
  actor: ChatActor;
  joined: Set<string>;
  timestamps: number[];
}

interface ClientEvent {
  event: "conversation:join" | "conversation:leave" | "message:send";
  conversationId?: string;
  content?: string;
}

const conversationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cookieValue(header: string | undefined, name: string): string | undefined {
  const match = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

async function authenticateUpgrade(request: IncomingMessage): Promise<ChatActor | null> {
  const authorization = request.headers.authorization;
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : undefined;
  const token = bearer ?? cookieValue(request.headers.cookie, "token");
  if (!token) return null;

  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, config.accessTokenSecret, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
  if (typeof decoded === "string" || decoded.type !== "ACCESS" || typeof decoded.userId !== "string") return null;

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: decoded.userId },
    select: { id: true, organizationId: true, role: true, status: true },
  });
  if (!user || user.status !== UserStatus.ACTIVE) return null;
  return { id: user.id, organizationId: user.organizationId ?? undefined, role: user.role };
}

function sendError(socket: ChatSocket, message: string) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event: "chat:error", message }));
  }
}

function isRateLimited(socket: ChatSocket) {
  const now = Date.now();
  socket.timestamps = socket.timestamps.filter((timestamp) => now - timestamp < 10_000);
  if (socket.timestamps.length >= 30) return true;
  socket.timestamps.push(now);
  return false;
}

export function attachChatWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const rooms = new Map<string, Set<ChatSocket>>();

  server.on("upgrade", (request, socket, head) => {
    const origin = request.headers.origin;
    if (origin && !config.corsOrigins.includes(origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname !== "/ws/chat") return;

    void authenticateUpgrade(request).then((actor) => {
      if (!actor) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (webSocket) => {
        const chatSocket = webSocket as ChatSocket;
        chatSocket.actor = actor;
        chatSocket.joined = new Set();
        chatSocket.timestamps = [];
        wss.emit("connection", chatSocket, request);
      });
    }).catch(() => {
      socket.destroy();
    });
  });

  wss.on("connection", (socket: ChatSocket) => {
    const leaveAllRooms = () => {
      for (const conversationId of socket.joined) {
        const room = rooms.get(conversationId);
        room?.delete(socket);
        if (room && room.size === 0) rooms.delete(conversationId);
      }
      socket.joined.clear();
    };

    socket.on("message", (raw) => {
      if (isRateLimited(socket)) {
        sendError(socket, "Too many messages. Please slow down.");
        return;
      }
      let event: ClientEvent;
      try {
        event = JSON.parse(raw.toString()) as ClientEvent;
      } catch {
        sendError(socket, "Invalid JSON message.");
        return;
      }
      if (!event || !["conversation:join", "conversation:leave", "message:send"].includes(event.event)) {
        sendError(socket, "Unsupported chat event.");
        return;
      }
      if (!event.conversationId || !conversationIdPattern.test(event.conversationId)) {
        sendError(socket, "A valid conversation ID is required.");
        return;
      }
      const conversationId = event.conversationId;

      void (async () => {
        if (!(await canAccessConversation(socket.actor, conversationId))) {
          sendError(socket, "You do not have access to this conversation.");
          return;
        }
        if (event.event === "conversation:join") {
          socket.joined.add(conversationId);
          let room = rooms.get(conversationId);
          if (!room) {
            room = new Set();
            rooms.set(conversationId, room);
          }
          room.add(socket);
          socket.send(JSON.stringify({ event: "conversation:joined", conversationId }));
          return;
        }
        if (event.event === "conversation:leave") {
          socket.joined.delete(conversationId);
          const room = rooms.get(conversationId);
          room?.delete(socket);
          if (room && room.size === 0) rooms.delete(conversationId);
          return;
        }
        if (!socket.joined.has(conversationId)) {
          sendError(socket, "Join the conversation before sending messages.");
          return;
        }
        if (typeof event.content !== "string" || event.content.trim().length === 0 || event.content.length > 4000) {
          sendError(socket, "Message content must be between 1 and 4000 characters.");
          return;
        }
        const message = await saveMessage(socket.actor, conversationId, event.content);
        const payload = JSON.stringify({
          event: "message:new",
          data: {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
          },
        });
        for (const memberSocket of rooms.get(conversationId) ?? []) {
          if (memberSocket.readyState === WebSocket.OPEN) memberSocket.send(payload);
        }
      })().catch(() => sendError(socket, "Unable to process the chat event."));
    });
    socket.on("close", leaveAllRooms);
    socket.on("error", leaveAllRooms);
  });

  return wss;
}
