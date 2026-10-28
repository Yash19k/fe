"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachWhiteboardSocket = attachWhiteboardSocket;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const socket_io_1 = require("socket.io");
const config_1 = require("../config/config");
const data_source_1 = require("../config/data.source");
const user_entity_1 = require("../entities/user.entity");
const whiteboard_service_1 = require("../services/whiteboard.service");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roomName = (whiteboardId) => `whiteboard:${whiteboardId}`;
const recentUpdates = new Map();
const writeQueues = new Map();
const cursorTimestamps = new Map();
const MAX_SCENE_BYTES = 900000;
const CURSOR_INTERVAL_MS = 50;
function isRecord(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function validScene(value) {
    return (isRecord(value) &&
        Array.isArray(value.elements) &&
        isRecord(value.appState) &&
        isRecord(value.files) &&
        Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_SCENE_BYTES);
}
function validJoin(value) {
    return isRecord(value) && typeof value.whiteboardId === "string" && uuidPattern.test(value.whiteboardId);
}
function validUpdate(value) {
    return (isRecord(value) &&
        typeof value.whiteboardId === "string" &&
        uuidPattern.test(value.whiteboardId) &&
        typeof value.updateId === "string" &&
        value.updateId.length > 0 &&
        value.updateId.length <= 100 &&
        Number.isInteger(value.revision) &&
        Number(value.revision) >= 1 &&
        validScene(value.sceneData));
}
function validCursor(value) {
    return (isRecord(value) &&
        typeof value.whiteboardId === "string" &&
        uuidPattern.test(value.whiteboardId) &&
        typeof value.x === "number" &&
        Number.isFinite(value.x) &&
        typeof value.y === "number" &&
        Number.isFinite(value.y) &&
        Math.abs(value.x) <= 1000000 &&
        Math.abs(value.y) <= 1000000);
}
function tokenFromSocket(socket) {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.length > 0)
        return authToken;
    const authorization = socket.handshake.headers.authorization;
    if (authorization?.startsWith("Bearer "))
        return authorization.slice(7).trim();
    const cookie = socket.handshake.headers.cookie
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("token="));
    return cookie ? decodeURIComponent(cookie.slice("token=".length)) : undefined;
}
async function authenticateSocket(socket) {
    const token = tokenFromSocket(socket);
    if (!token)
        throw new Error("UNAUTHORIZED");
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, config_1.config.accessTokenSecret, { algorithms: ["HS256"] });
    }
    catch {
        throw new Error("UNAUTHORIZED");
    }
    if (typeof decoded === "string" || decoded.type !== "ACCESS" || typeof decoded.userId !== "string") {
        throw new Error("UNAUTHORIZED");
    }
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: decoded.userId },
        select: { id: true, organizationId: true, fullName: true, email: true, status: true },
    });
    if (!user || user.status !== user_entity_1.UserStatus.ACTIVE)
        throw new Error("UNAUTHORIZED");
    return {
        id: user.id,
        organizationId: user.organizationId ?? undefined,
        displayName: user.fullName?.trim() || user.email.split("@")[0],
    };
}
function presence(io, whiteboardId) {
    const users = new Map();
    for (const socket of io.sockets.adapter.rooms.get(roomName(whiteboardId)) ?? []) {
        const member = io.sockets.sockets.get(socket);
        if (member?.actor)
            users.set(member.actor.id, { userId: member.actor.id, displayName: member.actor.displayName });
    }
    return [...users.values()];
}
function attachWhiteboardSocket(server) {
    const io = new socket_io_1.Server(server, {
        maxHttpBufferSize: 1000000,
        cors: {
            origin: (origin, callback) => {
                if (!origin || config_1.config.corsOrigins.includes(origin))
                    callback(null, true);
                else
                    callback(new Error("Origin is not allowed by CORS"));
            },
            credentials: true,
        },
    });
    io.use(async (socket, next) => {
        try {
            socket.actor = await authenticateSocket(socket);
            socket.whiteboards = new Set();
            next();
        }
        catch {
            next(new Error("Authentication required."));
        }
    });
    io.on("connection", (rawSocket) => {
        const socket = rawSocket;
        const leave = (whiteboardId) => {
            if (!socket.whiteboards.delete(whiteboardId))
                return;
            socket.leave(roomName(whiteboardId));
            io.to(roomName(whiteboardId)).emit("whiteboard:presence", presence(io, whiteboardId));
            io.to(roomName(whiteboardId)).emit("whiteboard:user-left", {
                userId: socket.actor.id,
                displayName: socket.actor.displayName,
            });
        };
        socket.on("whiteboard:join", async (payload, acknowledge) => {
            if (!validJoin(payload)) {
                acknowledge?.({ ok: false, message: "A valid whiteboard ID is required." });
                return;
            }
            try {
                const whiteboard = await (0, whiteboard_service_1.getWhiteboard)(payload.whiteboardId, socket.actor.id, socket.actor.organizationId);
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
            }
            catch {
                acknowledge?.({ ok: false, message: "You do not have access to this whiteboard." });
            }
        });
        socket.on("whiteboard:leave", (payload) => {
            if (validJoin(payload))
                leave(payload.whiteboardId);
        });
        socket.on("whiteboard:scene-update", async (payload, acknowledge) => {
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
                if (Date.now() - timestamp > 60000)
                    recentUpdates.delete(key);
            }
            let saved;
            let resolveWrite;
            let rejectWrite;
            const previousWrite = writeQueues.get(payload.whiteboardId) ?? Promise.resolve();
            const currentWrite = new Promise((resolve, reject) => {
                resolveWrite = resolve;
                rejectWrite = reject;
            });
            writeQueues.set(payload.whiteboardId, currentWrite);
            try {
                await previousWrite;
                saved = await (0, whiteboard_service_1.updateWhiteboard)(payload.whiteboardId, socket.actor.id, socket.actor.organizationId, payload.sceneData, payload.revision);
                resolveWrite();
                socket.to(roomName(payload.whiteboardId)).emit("whiteboard:scene-update", {
                    whiteboardId: saved.id,
                    updateId: payload.updateId,
                    revision: saved.revision,
                    sceneData: saved.sceneData,
                    senderId: socket.actor.id,
                });
                socket.emit("whiteboard:scene-saved", { whiteboardId: saved.id, revision: saved.revision, updateId: payload.updateId });
                acknowledge?.({ ok: true, revision: saved.revision });
            }
            catch (error) {
                rejectWrite(error);
                if (error instanceof Error && "statusCode" in error && error.statusCode === 409) {
                    const current = await (0, whiteboard_service_1.getWhiteboard)(payload.whiteboardId, socket.actor.id, socket.actor.organizationId);
                    socket.emit("whiteboard:sync-required", current);
                }
                else {
                    socket.emit("whiteboard:error", { message: "Unable to save whiteboard changes." });
                }
                acknowledge?.({ ok: false, message: "Whiteboard update was rejected." });
            }
            finally {
                if (writeQueues.get(payload.whiteboardId) === currentWrite)
                    writeQueues.delete(payload.whiteboardId);
            }
        });
        socket.on("whiteboard:cursor-move", (payload) => {
            if (!validCursor(payload) || !socket.whiteboards.has(payload.whiteboardId))
                return;
            const cursorKey = `${socket.id}:${payload.whiteboardId}`;
            const now = Date.now();
            if (now - (cursorTimestamps.get(cursorKey) ?? 0) < CURSOR_INTERVAL_MS)
                return;
            cursorTimestamps.set(cursorKey, now);
            socket.to(roomName(payload.whiteboardId)).emit("whiteboard:cursor-update", {
                whiteboardId: payload.whiteboardId,
                userId: socket.actor.id,
                displayName: socket.actor.displayName,
                x: payload.x,
                y: payload.y,
            });
        });
        socket.on("disconnect", () => {
            for (const whiteboardId of [...socket.whiteboards])
                leave(whiteboardId);
            for (const key of cursorTimestamps.keys()) {
                if (key.startsWith(`${socket.id}:`))
                    cursorTimestamps.delete(key);
            }
        });
    });
    return io;
}
