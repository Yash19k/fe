import React, { useEffect, useRef, useState } from "react";
import { Excalidraw, exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useApp } from "../../hooks/useApp";
import { deleteWhiteboardApi, getWhiteboardApi, updateWhiteboardApi, type Whiteboard, type WhiteboardScene } from "../../services/api";
import { createUpdateId, createWhiteboardSocket, type WhiteboardInitialScene, type WhiteboardPresence, type WhiteboardSceneUpdate } from "../../services/whiteboard-socket";

function isScene(value: unknown): value is WhiteboardScene {
  return Boolean(value && typeof value === "object" && Array.isArray((value as WhiteboardScene).elements));
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
    client.on("whiteboard:presence", (users: WhiteboardPresence[]) => setCollaborators(users));
    client.on("whiteboard:initial-scene", (payload: WhiteboardInitialScene) => {
      if (payload.whiteboardId !== whiteboardId) return;
      setWhiteboard((current) => current ? { ...current, revision: payload.revision } : current);
      revision.current = payload.revision;
      if (!latest.current && editorApi.current && isScene(payload.sceneData)) {
        remoteUpdate.current = true;
        editorApi.current.updateScene({
          elements: payload.sceneData.elements as readonly ExcalidrawElement[],
          appState: payload.sceneData.appState as unknown as AppState,
        });
        editorApi.current.addFiles(Object.values(payload.sceneData.files as BinaryFiles));
        setWhiteboard((current) => current ? { ...current, sceneData: payload.sceneData } : current);
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
      if (latest.current) {
        setWhiteboard((current) => current ? { ...current, revision: payload.revision } : current);
        revision.current = payload.revision;
        return;
      }
      remoteUpdate.current = true;
      editorApi.current.updateScene({
        elements: payload.sceneData.elements as readonly ExcalidrawElement[],
        appState: payload.sceneData.appState as unknown as AppState,
      });
      editorApi.current.addFiles(Object.values(payload.sceneData.files as BinaryFiles));
      setWhiteboard((current) => current ? { ...current, revision: payload.revision, sceneData: payload.sceneData } : current);
      window.setTimeout(() => { remoteUpdate.current = false; }, 0);
    });
    client.on("whiteboard:sync-required", (payload: WhiteboardInitialScene) => {
      if (payload.whiteboardId !== whiteboardId) return;
      setWhiteboard((current) => current ? { ...current, revision: payload.revision } : current);
      revision.current = payload.revision;
      if (latest.current) latest.current.revision = payload.revision;
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
          setWhiteboard(current.data);
          revision.current = current.data.revision;
          latest.current.revision = current.data.revision;
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
    latest.current = { revision: revision.current || whiteboard.revision, scene: { elements, appState: { ...appState, collaborators: undefined }, files } };
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
      <div className="flex items-center gap-3 min-w-0"><Button size="icon-sm" title="Back to whiteboards" icon={ArrowLeft} onClick={() => navigate(`/project/${currentProject.id}/whiteboards`)} /><h2 className="font-semibold truncate">{whiteboard?.name || "Whiteboard"}</h2><span className="text-xs text-text-muted">{connection} · {status}</span>{collaborators.length > 0 && <span className="text-xs text-text-muted">{collaborators.length} collaborator{collaborators.length === 1 ? "" : "s"}</span>}</div>
      <div className="flex gap-2"><Button size="sm" icon={Download} onClick={() => void exportScene("png")}>PNG</Button><Button size="sm" onClick={() => void exportScene("svg")}>SVG</Button><Button size="icon-sm" variant="danger" title="Delete whiteboard" icon={Trash2} onClick={async () => { if (!window.confirm("Delete this whiteboard?")) return; try { await deleteWhiteboardApi(whiteboardId); navigate(`/project/${currentProject.id}/whiteboards`); } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete whiteboard."); } }} /></div>
    </header>
    {error && <div role="alert" className="px-4 py-2 text-xs text-status-danger-text bg-status-danger-bg">{error}</div>}
    <div className="flex-1 min-h-0"><Excalidraw excalidrawAPI={(api) => { editorApi.current = api; }} initialData={isScene(scene) ? { elements: scene.elements as readonly ExcalidrawElement[], appState: scene.appState as Partial<AppState>, files: scene.files as BinaryFiles } : undefined} onChange={onChange} /></div>
  </section>;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
}
