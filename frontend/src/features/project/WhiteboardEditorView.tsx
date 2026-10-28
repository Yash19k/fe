import React, { useEffect, useRef, useState } from "react";
import { Excalidraw, exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useApp } from "../../hooks/useApp";
import { deleteWhiteboardApi, getWhiteboardApi, updateWhiteboardApi, type Whiteboard, type WhiteboardScene } from "../../services/api";
import { CollaboratorCursor, collaboratorColor } from "./CollaboratorCursor";
import { createUpdateId, createWhiteboardSocket, type WhiteboardCursor, type WhiteboardInitialScene, type WhiteboardPresence, type WhiteboardSceneUpdate } from "../../services/whiteboard-socket";

function isScene(value: unknown): value is WhiteboardScene {
  return Boolean(value && typeof value === "object" && Array.isArray((value as WhiteboardScene).elements));
}

function initialAppState(scene: WhiteboardScene): Partial<AppState> {
  const { collaborators: _collaborators, ...rest } = scene.appState;
  return rest as Partial<AppState>;
}

function mergeScenes(remote: WhiteboardScene, local: WhiteboardScene): WhiteboardScene {
  const localById = new Map(
    local.elements
      .filter((element): element is Record<string, unknown> => Boolean(element && typeof element === "object"))
      .map((element) => [String(element.id), element]),
  );
  const remoteElements = remote.elements.filter(
    (element): element is Record<string, unknown> => Boolean(element && typeof element === "object"),
  );
  const merged = remoteElements.map((remoteElement) => {
    const localElement = localById.get(String(remoteElement.id));
    if (!localElement) return remoteElement;
    const remoteVersion = typeof remoteElement.version === "number" ? remoteElement.version : 0;
    const localVersion = typeof localElement.version === "number" ? localElement.version : 0;
    return localVersion >= remoteVersion ? localElement : remoteElement;
  });
  const remoteIds = new Set(remoteElements.map((element) => String(element.id)));
  for (const localElement of localById.values()) {
    if (!remoteIds.has(String(localElement.id))) merged.push(localElement);
  }
  return {
    ...remote,
    elements: merged,
    appState: local.appState,
    files: { ...remote.files, ...local.files },
  };
}

export function WhiteboardEditorView({ whiteboardId }: { whiteboardId: string }) {
  const { currentProject, navigate } = useApp();
  const [whiteboard, setWhiteboard] = useState<Whiteboard | null>(null);
  const [status, setStatus] = useState("Loading...");
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ scene: WhiteboardScene; revision: number } | null>(null);
  const revision = useRef(0);
  const saving = useRef(false);
  const editorApi = useRef<ExcalidrawImperativeAPI | null>(null);
  const socket = useRef<ReturnType<typeof createWhiteboardSocket> | null>(null);
  const remoteUpdate = useRef(false);
  const [connection, setConnection] = useState<"Connecting" | "Connected" | "Reconnecting" | "Offline">("Connecting");
  const [collaborators, setCollaborators] = useState<WhiteboardPresence[]>([]);
  const [cursors, setCursors] = useState<Record<string, WhiteboardCursor>>({});
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const lastCursor = useRef<{ x: number; y: number; sentAt: number } | null>(null);

  useEffect(() => {
    let active = true;
    void getWhiteboardApi(whiteboardId).then((response) => {
      if (!active) return;
      setWhiteboard(response.data);
      revision.current = response.data.revision;
      setStatus("Saved");
    }).catch((err) => {
      if (active) { setError(err instanceof Error ? err.message : "Unable to load whiteboard."); setStatus(""); }
    });
    return () => { active = false; if (timer.current) clearTimeout(timer.current); };
  }, [whiteboardId]);

  useEffect(() => {
    if (!whiteboard) return;
    const client = createWhiteboardSocket();
    socket.current = client;
    const join = () => client.emit("whiteboard:join", { whiteboardId }, (result: { ok?: boolean; message?: string }) => {
      if (!result?.ok) setError(result?.message || "Unable to join whiteboard collaboration.");
    });
    client.on("connect", () => { setConnection("Connected"); join(); });
    client.on("connect_error", () => { setConnection("Offline"); setError("Collaboration is unavailable. Changes will be saved through HTTP."); });
    client.io.on("reconnect_attempt", () => setConnection("Reconnecting"));
    client.on("disconnect", () => setConnection("Reconnecting"));
    client.on("whiteboard:presence", (users: WhiteboardPresence[]) => {
      setCollaborators(users);
      const activeIds = new Set(users.map((user) => user.userId));
      setCursors((current) => Object.fromEntries(Object.entries(current).filter(([userId]) => activeIds.has(userId))));
    });
    client.on("whiteboard:user-left", ({ userId }: { userId: string }) => {
      setCursors((current) => { const next = { ...current }; delete next[userId]; return next; });
      setCollaborators((current) => current.filter((user) => user.userId !== userId));
    });
    client.on("whiteboard:cursor-update", (cursor: WhiteboardCursor) => {
      if (cursor.whiteboardId !== whiteboardId) return;
      setCursors((current) => ({ ...current, [cursor.userId]: cursor }));
    });
    client.on("whiteboard:initial-scene", (payload: WhiteboardInitialScene) => {
      if (payload.whiteboardId !== whiteboardId) return;
      setWhiteboard((current) => current ? { ...current, revision: payload.revision } : current);
      revision.current = payload.revision;
      if (editorApi.current && isScene(payload.sceneData)) {
        const scene = latest.current ? mergeScenes(payload.sceneData, latest.current.scene) : payload.sceneData;
        remoteUpdate.current = true;
        editorApi.current.updateScene({
          elements: scene.elements as readonly ExcalidrawElement[],
          ...(latest.current ? {} : { appState: scene.appState as unknown as AppState }),
        });
        editorApi.current.addFiles(Object.values(scene.files as BinaryFiles));
        if (latest.current) latest.current = { scene, revision: payload.revision };
        setWhiteboard((current) => current ? { ...current, sceneData: scene } : current);
        window.setTimeout(() => { remoteUpdate.current = false; }, 0);
      }
    });
    client.on("whiteboard:scene-saved", (payload: { whiteboardId: string; revision: number }) => {
      if (payload.whiteboardId !== whiteboardId) return;
      setWhiteboard((current) => current ? { ...current, revision: payload.revision } : current);
      revision.current = payload.revision;
      setStatus("Saved");
      setError("");
    });
    client.on("whiteboard:scene-update", (payload: WhiteboardSceneUpdate) => {
      if (payload.whiteboardId !== whiteboardId || !isScene(payload.sceneData) || !editorApi.current) return;
      const scene = latest.current ? mergeScenes(payload.sceneData, latest.current.scene) : payload.sceneData;
      remoteUpdate.current = true;
      editorApi.current.updateScene({
        elements: scene.elements as readonly ExcalidrawElement[],
      });
      editorApi.current.addFiles(Object.values(scene.files as BinaryFiles));
      revision.current = payload.revision;
      if (latest.current) latest.current = { scene, revision: payload.revision };
      setWhiteboard((current) => current ? { ...current, revision: payload.revision, sceneData: scene } : current);
      window.setTimeout(() => { remoteUpdate.current = false; }, 0);
    });
    client.on("whiteboard:sync-required", (payload: WhiteboardInitialScene) => {
      if (payload.whiteboardId !== whiteboardId) return;
      if (!isScene(payload.sceneData)) return;
      const scene = latest.current ? mergeScenes(payload.sceneData, latest.current.scene) : payload.sceneData;
      if (editorApi.current) {
        remoteUpdate.current = true;
        editorApi.current.updateScene({
          elements: scene.elements as readonly ExcalidrawElement[],
        });
        editorApi.current.addFiles(Object.values(scene.files as BinaryFiles));
        window.setTimeout(() => { remoteUpdate.current = false; }, 0);
      }
      setWhiteboard((current) => current ? { ...current, revision: payload.revision, sceneData: scene } : current);
      revision.current = payload.revision;
      if (latest.current) latest.current = { scene, revision: payload.revision };
      setError("");
      setStatus("Unsaved");
      window.setTimeout(() => { void save(); }, 250);
    });
    client.connect();
    return () => {
      client.emit("whiteboard:leave", { whiteboardId });
      client.removeAllListeners();
      client.disconnect();
      socket.current = null;
      setCollaborators([]);
      setCursors({});
    };
  }, [whiteboardId, Boolean(whiteboard)]);

  async function save() {
    const pending = latest.current;
    if (!pending || saving.current) return;
    saving.current = true;
    setStatus("Saving...");
    try {
      const response = await updateWhiteboardApi(whiteboardId, { sceneData: pending.scene, revision: pending.revision });
      setWhiteboard(response.data);
      revision.current = response.data.revision;
      if (latest.current === pending) latest.current = null;
      else if (latest.current) latest.current.revision = response.data.revision;
      setStatus("Saved");
      setError("");
    } catch (err) {
      if (err && typeof err === "object" && "status" in err && err.status === 409 && latest.current) {
        try {
          const current = await getWhiteboardApi(whiteboardId);
          const scene = latest.current ? mergeScenes(current.data.sceneData, latest.current.scene) : current.data.sceneData;
          if (editorApi.current) {
            remoteUpdate.current = true;
            editorApi.current.updateScene({ elements: scene.elements as readonly ExcalidrawElement[] });
            editorApi.current.addFiles(Object.values(scene.files as BinaryFiles));
            window.setTimeout(() => { remoteUpdate.current = false; }, 0);
          }
          setWhiteboard({ ...current.data, sceneData: scene });
          revision.current = current.data.revision;
          if (latest.current) latest.current = { scene, revision: current.data.revision };
          setError("");
          setStatus("Unsaved");
          window.setTimeout(() => { void save(); }, 250);
        } catch (refreshError) {
          setError(refreshError instanceof Error ? refreshError.message : "Unable to reconcile the latest whiteboard revision.");
        }
      } else {
      setError(err instanceof Error ? err.message : "Unable to save changes.");
      setStatus("Save failed");
      }
    } finally {
      saving.current = false;
    }
  }

  function onChange(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) {
    if (!whiteboard || remoteUpdate.current) return;
    const { collaborators: _collaborators, ...persistedAppState } = appState;
    latest.current = { revision: revision.current || whiteboard.revision, scene: { elements, appState: persistedAppState, files } };
    setStatus("Unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const pending = latest.current;
      if (!pending) return;
      if (socket.current?.connected) {
        socket.current.emit("whiteboard:scene-update", {
          whiteboardId,
          updateId: createUpdateId(),
          revision: pending.revision,
          sceneData: pending.scene,
        }, (result: { ok?: boolean }) => {
          if (!result?.ok) void save();
          else if (latest.current === pending) latest.current = null;
        });
      } else {
        void save();
      }
    }, 1000);
  }

  function onPointerUpdate(payload: { pointer: { x: number; y: number }; button: "up" | "down" }) {
    const now = Date.now();
    const previous = lastCursor.current;
    if (previous && now - previous.sentAt < 33 && previous.x === payload.pointer.x && previous.y === payload.pointer.y) return;
    if (previous && now - previous.sentAt < 33) return;
    lastCursor.current = { x: payload.pointer.x, y: payload.pointer.y, sentAt: now };
    const pressed = payload.button === "down";
    socket.current?.emit("whiteboard:cursor-move", { whiteboardId, x: payload.pointer.x, y: payload.pointer.y, pressed });
  }

  async function exportScene(format: "png" | "svg") {
    const api = editorApi.current;
    if (!api) return;
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();
    if (format === "png") {
      const blob = await exportToBlob({ elements, appState, files, mimeType: "image/png" });
      download(blob, `${whiteboard?.name || "whiteboard"}.png`);
    } else {
      const svg = await exportToSvg({ elements, appState, files });
      download(new Blob([svg.outerHTML], { type: "image/svg+xml" }), `${whiteboard?.name || "whiteboard"}.svg`);
    }
  }

  if (!currentProject) return null;
  if (error && !whiteboard) return <div className="p-8 text-center text-sm text-status-danger-text">{error} <button className="underline" onClick={() => window.location.reload()}>Retry</button></div>;
  if (!whiteboard) return <div className="p-8 text-center text-sm text-text-muted">Loading whiteboard...</div>;
  const scene = whiteboard?.sceneData;
  return <section className="h-full min-h-[600px] flex flex-col">
    <header className="h-14 px-4 flex items-center justify-between gap-3 border-b border-border bg-surface">
      <div className="flex items-center gap-3 min-w-0"><Button size="icon-sm" title="Back to whiteboards" icon={ArrowLeft} onClick={() => navigate(`/project/${currentProject.id}/whiteboards`)} /><h2 className="font-semibold truncate">{whiteboard?.name || "Whiteboard"}</h2><span className="text-xs text-text-muted">{connection} · {status}</span>{collaborators.length > 0 && <div className="flex items-center gap-2" aria-label={`${collaborators.length} users online`}><div className="flex -space-x-1">{collaborators.slice(0, 5).map((user) => <span key={user.userId} title={user.displayName} className="h-6 w-6 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-semibold text-white" style={{ backgroundColor: collaboratorColor(user.userId) }}>{user.displayName.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>)}</div><span className="text-xs text-text-muted">{collaborators.length} online</span></div>}</div>
      <div className="flex gap-2"><Button size="sm" icon={Download} onClick={() => void exportScene("png")}>PNG</Button><Button size="sm" onClick={() => void exportScene("svg")}>SVG</Button><Button size="icon-sm" variant="danger" title="Delete whiteboard" icon={Trash2} onClick={async () => { if (!window.confirm("Delete this whiteboard?")) return; try { await deleteWhiteboardApi(whiteboardId); navigate(`/project/${currentProject.id}/whiteboards`); } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete whiteboard."); } }} /></div>
    </header>
    {error && <div role="alert" className="px-4 py-2 text-xs text-status-danger-text bg-status-danger-bg">{error}</div>}
    <div ref={canvasRef} className="flex-1 min-h-0 relative">
      <Excalidraw
        excalidrawAPI={(api) => { editorApi.current = api; }}
        initialData={isScene(scene) ? { elements: scene.elements as readonly ExcalidrawElement[], appState: initialAppState(scene), files: scene.files as BinaryFiles } : undefined}
        onChange={onChange}
        onPointerUpdate={onPointerUpdate}
      />
      {Object.values(cursors).map((cursor) => {
        const appState = editorApi.current?.getAppState();
        return <CollaboratorCursor key={cursor.userId} cursor={cursor} color={collaboratorColor(cursor.userId)} zoom={appState?.zoom.value ?? 1} scrollX={appState?.scrollX ?? 0} scrollY={appState?.scrollY ?? 0} />;
      })}
    </div>
  </section>;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}
