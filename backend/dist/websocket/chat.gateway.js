"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evictUserFromConversationRoom = evictUserFromConversationRoom;
exports.attachChatWebSocket = attachChatWebSocket;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ws_1 = require("ws");
const data_source_1 = require("../config/data.source");
const config_1 = require("../config/config");
const user_entity_1 = require("../entities/user.entity");
const chat_service_1 = require("../services/chat.service");
const conversationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function cookieValue(header, name) {
    const match = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}
async function authenticateUpgrade(request) {
    const authorization = request.headers.authorization;
    const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : undefined;
    const token = bearer ?? cookieValue(request.headers.cookie, "token");
    if (!token)
        return null;
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, config_1.config.accessTokenSecret, { algorithms: ["HS256"] });
    }
    catch {
        return null;
    }
    if (typeof decoded === "string" || decoded.type !== "ACCESS" || typeof decoded.userId !== "string")
        return null;
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: decoded.userId },
        select: { id: true, organizationId: true, role: true, status: true },
    });
    if (!user || user.status !== user_entity_1.UserStatus.ACTIVE)
        return null;
    return { id: user.id, organizationId: user.organizationId ?? undefined, role: user.role };
}
async function isActiveActor(actor) {
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: actor.id },
        select: { id: true, status: true },
    });
    return user?.status === user_entity_1.UserStatus.ACTIVE;
}
function sendError(socket, message) {
    if (socket.readyState === ws_1.WebSocket.OPEN) {
        socket.send(JSON.stringify({ event: "chat:error", message }));
    }
}
function isRateLimited(socket) {
    const now = Date.now();
    socket.timestamps = socket.timestamps.filter((timestamp) => now - timestamp < 10000);
    if (socket.timestamps.length >= 30)
        return true;
    socket.timestamps.push(now);
    return false;
}
const rooms = new Map();
function evictUserFromConversationRoom(conversationId, userId) {
    const room = rooms.get(conversationId);
    if (!room)
        return;
    for (const socket of Array.from(room)) {
        if (socket.actor?.id === userId) {
            socket.joined.delete(conversationId);
            room.delete(socket);
            if (socket.readyState === ws_1.WebSocket.OPEN) {
                try {
                    socket.send(JSON.stringify({
                        event: "conversation:removed",
                        conversationId,
                        message: "You have been removed from this conversation.",
                    }));
                }
                catch {
                    // Ignore write failure on stale socket
                }
            }
        }
    }
    if (room.size === 0)
        rooms.delete(conversationId);
}
(0, chat_service_1.registerRoomEvictor)(evictUserFromConversationRoom);
function attachChatWebSocket(server) {
    const wss = new ws_1.WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
    server.on("upgrade", (request, socket, head) => {
        const origin = request.headers.origin;
        if (origin && !config_1.config.corsOrigins.includes(origin)) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
        }
        const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
        if (pathname !== "/ws/chat")
            return;
        void authenticateUpgrade(request).then((actor) => {
            if (!actor) {
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                socket.destroy();
                return;
            }
            wss.handleUpgrade(request, socket, head, (webSocket) => {
                const chatSocket = webSocket;
                chatSocket.actor = actor;
                chatSocket.joined = new Set();
                chatSocket.timestamps = [];
                wss.emit("connection", chatSocket, request);
            });
        }).catch(() => {
            socket.destroy();
        });
    });
    wss.on("connection", (socket) => {
        const leaveAllRooms = () => {
            for (const conversationId of socket.joined) {
                const room = rooms.get(conversationId);
                room?.delete(socket);
                if (room && room.size === 0)
                    rooms.delete(conversationId);
            }
            socket.joined.clear();
        };
        socket.on("message", (raw) => {
            if (isRateLimited(socket)) {
                sendError(socket, "Too many messages. Please slow down.");
                return;
            }
            let event;
            try {
                event = JSON.parse(raw.toString());
            }
            catch {
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
                if (!(await isActiveActor(socket.actor))) {
                    sendError(socket, "Authentication required.");
                    socket.close(1008, "Authentication required.");
                    return;
                }
                if (!(await (0, chat_service_1.canAccessConversation)(socket.actor, conversationId))) {
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
                    if (room && room.size === 0)
                        rooms.delete(conversationId);
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
                const message = await (0, chat_service_1.saveMessage)(socket.actor, conversationId, event.content);
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
                    if (memberSocket.readyState === ws_1.WebSocket.OPEN)
                        memberSocket.send(payload);
                }
            })().catch(() => sendError(socket, "Unable to process the chat event."));
        });
        socket.on("close", leaveAllRooms);
        socket.on("error", leaveAllRooms);
    });
    return wss;
}
