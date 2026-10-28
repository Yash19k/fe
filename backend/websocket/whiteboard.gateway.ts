import jwt, { JwtPayload } from "jsonwebtoken";
import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { config } from "../config/config";
import { AppDataSource } from "../config/data.source";
import { User, UserStatus } from "../entities/user.entity";
import { getWhiteboard, updateWhiteboard } from "../services/whiteboard.service";
import {
  WhiteboardCursorPayload,
  WhiteboardJoinPayload,
  WhiteboardPresence,
  WhiteboardSceneUpdatePayload,
} from "../types/whiteboard-socket.types";

interface SocketActor {
  id: string;
  organizationId?: string;
  displayName: string;
}

interface WhiteboardSocket extends Socket {
  actor: SocketActor;
  whiteboards: Set<string>;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roomName = (whiteboardId: string) => `whiteboard:${whiteboardId}`;
const recentUpdates = new Map<string, number>();
const writeQueues = new Map<string, Promise<void>>();
const cursorTimestamps = new Map<string, number>();
const cursorRateWindows = new Map<string, number[]>();
const MAX_SCENE_BYTES = 900_000;
const CURSOR_INTERVAL_MS = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validScene(value: unknown): value is WhiteboardSceneUpdatePayload["sceneData"] {
  return (
    isRecord(value) &&
    Array.isArray(value.elements) &&
    isRecord(value.appState) &&
    isRecord(value.files) &&
    Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_SCENE_BYTES
  );
}

function validJoin(value: unknown): value is WhiteboardJoinPayload {
  return isRecord(value) && typeof value.whiteboardId === "string" && uuidPattern.test(value.whiteboardId);
}

function validUpdate(value: unknown): value is WhiteboardSceneUpdatePayload {
  return (
    isRecord(value) &&
    typeof value.whiteboardId === "string" &&
    uuidPattern.test(value.whiteboardId) &&
    typeof value.updateId === "string" &&
    value.updateId.length > 0 &&
    value.updateId.length <= 100 &&
    Number.isInteger(value.revision) &&
    Number(value.revision) >= 1 &&
    validScene(value.sceneData)
  );
}

function validCursor(value: unknown): value is WhiteboardCursorPayload {
  return (
    isRecord(value) &&
    typeof value.whiteboardId === "string" &&
    uuidPattern.test(value.whiteboardId) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    Math.abs(value.x) <= 1_000_000 &&
    Math.abs(value.y) <= 1_000_000
  );
}

function tokenFromSocket(socket: Socket): string | undefined {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.length > 0) return authToken;
  const authorization = socket.handshake.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  const cookie = socket.handshake.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("token="));
  return cookie ? decodeURIComponent(cookie.slice("token=".length)) : undefined;
}

async function authenticateSocket(socket: Socket): Promise<SocketActor> {
  const token = tokenFromSocket(socket);
  if (!token) throw new Error("UNAUTHORIZED");
  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, config.accessTokenSecret, { algorithms: ["HS256"] });
  } catch {
    throw new Error("UNAUTHORIZED");
  }
  if (typeof decoded === "string" || decoded.type !== "ACCESS" || typeof decoded.userId !== "string") {
    throw new Error("UNAUTHORIZED");
  }
  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: decoded.userId },
    select: { id: true, organizationId: true, fullName: true, email: true, status: true },
  });
  if (!user || user.status !== UserStatus.ACTIVE) throw new Error("UNAUTHORIZED");
  return {
    id: user.id,
    organizationId: user.organizationId ?? undefined,
    displayName: user.fullName?.trim() || user.email.split("@")[0],
  };
}

async function isActiveActor(actor: SocketActor): Promise<boolean> {
  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: actor.id },
    select: { id: true, status: true },
  });
  return user?.status === UserStatus.ACTIVE;
}

function presence(io: Server, whiteboardId: string): WhiteboardPresence[] {
  const users = new Map<string, WhiteboardPresence>();
  for (const socket of io.sockets.adapter.rooms.get(roomName(whiteboardId)) ?? []) {
    const member = io.sockets.sockets.get(socket) as WhiteboardSocket | undefined;
    if (member?.actor) users.set(member.actor.id, { userId: member.actor.id, displayName: member.actor.displayName });
  }
  return [...users.values()];
}

export function attachWhiteboardSocket(server: HttpServer): Server {
  const io = new Server(server, {
    maxHttpBufferSize: 1_000_000,
    cors: {
      origin: (origin, callback) => {
        if (!origin || config.corsOrigins.includes(origin)) callback(null, true);
        else callback(new Error("Origin is not allowed by CORS"));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      (socket as WhiteboardSocket).actor = await authenticateSocket(socket);
      (socket as WhiteboardSocket).whiteboards = new Set();
      next();
    } catch {
      next(new Error("Authentication required."));
    }
  });

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as WhiteboardSocket;
    const leave = (whiteboardId: string) => {
      if (!socket.whiteboards.delete(whiteboardId)) return;
      socket.leave(roomName(whiteboardId));
      io.to(roomName(whiteboardId)).emit("whiteboard:presence", presence(io, whiteboardId));
      io.to(roomName(whiteboardId)).emit("whiteboard:user-left", {
        userId: socket.actor.id,
        displayName: socket.actor.displayName,
      });
    };

    socket.on("whiteboard:join", async (payload: unknown, acknowledge?: (response: unknown) => void) => {
      if (!(await isActiveActor(socket.actor))) {
        acknowledge?.({ ok: false, message: "Authentication required." });
        socket.disconnect(true);
        return;
      }
      if (!validJoin(payload)) {
        acknowledge?.({ ok: false, message: "A valid whiteboard ID is required." });
        return;
      }
      try {
        const whiteboard = await getWhiteboard(payload.whiteboardId, socket.actor.id, socket.actor.organizationId);
        socket.join(roomName(payload.whiteboardId));
        socket.whiteboards.add(payload.whiteboardId);
        socket.emit("whiteboard:initial-scene", {
          whiteboardId: whiteboard.id,
          revision: whiteboard.revision,
          sceneData: whiteboard.sceneData,
        });
        socket.emit("whiteboard:joined", { whiteboardId: whiteboard.id });
        socket.to(roomName(whiteboard.id)).emit("whiteboard:user-joined", {
          userId: socket.actor.id,
          displayName: socket.actor.displayName,
        });
        io.to(roomName(whiteboard.id)).emit("whiteboard:presence", presence(io, whiteboard.id));
        acknowledge?.({ ok: true });
      } catch {
        acknowledge?.({ ok: false, message: "You do not have access to this whiteboard." });
      }
    });

    socket.on("whiteboard:leave", (payload: unknown) => {
      if (validJoin(payload)) leave(payload.whiteboardId);
    });

    socket.on("whiteboard:scene-update", async (payload: unknown, acknowledge?: (response: unknown) => void) => {
      if (!(await isActiveActor(socket.actor))) {
        acknowledge?.({ ok: false, message: "Authentication required." });
        socket.disconnect(true);
        return;
      }
      if (!validUpdate(payload) || !socket.whiteboards.has(payload.whiteboardId)) {
        acknowledge?.({ ok: false, message: "Join the whiteboard before updating it." });
        return;
      }
      const updateKey = `${socket.actor.id}:${payload.updateId}`;
      if (recentUpdates.has(updateKey)) {
        acknowledge?.({ ok: true, duplicate: true });
        return;
      }
      recentUpdates.set(updateKey, Date.now());
      for (const [key, timestamp] of recentUpdates) {
        if (Date.now() - timestamp > 60_000) recentUpdates.delete(key);
      }
      let saved: Awaited<ReturnType<typeof updateWhiteboard>>;
      let releaseWrite!: () => void;
      const previousWrite = writeQueues.get(payload.whiteboardId) ?? Promise.resolve();
      const currentWrite = previousWrite.then(
        () => new Promise<void>((resolve) => {
          releaseWrite = resolve;
        }),
      );
      writeQueues.set(payload.whiteboardId, currentWrite);
      try {
        await previousWrite;
        saved = await updateWhiteboard(
          payload.whiteboardId,
          socket.actor.id,
          socket.actor.organizationId,
          payload.sceneData,
          payload.revision,
        );
        socket.to(roomName(payload.whiteboardId)).emit("whiteboard:scene-update", {
          whiteboardId: saved.id,
          updateId: payload.updateId,
          revision: saved.revision,
          sceneData: saved.sceneData,
          senderId: socket.actor.id,
        });
        socket.emit("whiteboard:scene-saved", { whiteboardId: saved.id, revision: saved.revision, updateId: payload.updateId });
        acknowledge?.({ ok: true, revision: saved.revision });
      } catch (error) {
        if (error instanceof Error && "statusCode" in error && (error as { statusCode?: number }).statusCode === 409) {
          const current = await getWhiteboard(payload.whiteboardId, socket.actor.id, socket.actor.organizationId);
          socket.emit("whiteboard:sync-required", current);
        } else {
          socket.emit("whiteboard:error", { message: "Unable to save whiteboard changes." });
        }
        acknowledge?.({ ok: false, message: "Whiteboard update was rejected." });
      } finally {
        releaseWrite();
        if (writeQueues.get(payload.whiteboardId) === currentWrite) writeQueues.delete(payload.whiteboardId);
      }
    });

    socket.on("whiteboard:cursor-move", async (payload: unknown) => {
      if (!(await isActiveActor(socket.actor))) {
        socket.disconnect(true);
        return;
      }
      if (!validCursor(payload) || !socket.whiteboards.has(payload.whiteboardId)) return;
      const now = Date.now();
      const timestamps = (cursorRateWindows.get(socket.id) ?? []).filter((timestamp) => now - timestamp < 1000);
      if (timestamps.length >= 30) return;
      timestamps.push(now);
      cursorRateWindows.set(socket.id, timestamps);
      const cursorKey = `${socket.id}:${payload.whiteboardId}`;
      if (now - (cursorTimestamps.get(cursorKey) ?? 0) < CURSOR_INTERVAL_MS) return;
      cursorTimestamps.set(cursorKey, now);
      socket.to(roomName(payload.whiteboardId)).emit("whiteboard:cursor-update", {
        whiteboardId: payload.whiteboardId,
        userId: socket.actor.id,
        displayName: socket.actor.displayName,
        x: payload.x,
        y: payload.y,
        pressed: payload.pressed === true,
      });
    });

    socket.on("disconnect", () => {
      for (const whiteboardId of [...socket.whiteboards]) leave(whiteboardId);
      for (const key of cursorTimestamps.keys()) {
        if (key.startsWith(`${socket.id}:`)) cursorTimestamps.delete(key);
      }
      cursorRateWindows.delete(socket.id);
    });
  });

  return io;
}
