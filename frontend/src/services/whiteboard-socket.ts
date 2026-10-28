import { io, type Socket } from "socket.io-client";
import { API_BASE_URL, getAuthToken } from "./api";
import type { WhiteboardScene } from "./api";

export interface WhiteboardPresence {
  userId: string;
  displayName: string;
}

export interface WhiteboardCursor {
  whiteboardId: string;
  userId: string;
  displayName: string;
  x: number;
  y: number;
  pressed?: boolean;
}

export interface WhiteboardSceneUpdate {
  whiteboardId: string;
  updateId: string;
  revision: number;
  sceneData: WhiteboardScene;
  senderId?: string;
}

export interface WhiteboardInitialScene {
  whiteboardId: string;
  revision: number;
  sceneData: WhiteboardScene;
}

export type WhiteboardSocket = Socket;

export function createWhiteboardSocket(): WhiteboardSocket {
  const endpoint = API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  return io(endpoint, {
    autoConnect: false,
    withCredentials: true,
    auth: { token: getAuthToken() },
    transports: ["websocket", "polling"],
  });
}

export function createUpdateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
