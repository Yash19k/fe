export interface WhiteboardScenePayload {
  elements: readonly Record<string, unknown>[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WhiteboardJoinPayload {
  whiteboardId: string;
}

export interface WhiteboardSceneUpdatePayload {
  whiteboardId: string;
  updateId: string;
  revision: number;
  sceneData: WhiteboardScenePayload;
}

export interface WhiteboardCursorPayload {
  whiteboardId: string;
  x: number;
  y: number;
  pressed?: boolean;
}

export interface WhiteboardPresence {
  userId: string;
  displayName: string;
}
