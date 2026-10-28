import React, { useEffect, useState } from "react";
import { ArrowLeft, Edit3, FilePlus2, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useApp } from "../../hooks/useApp";
import {
  createWhiteboardApi,
  deleteWhiteboardApi,
  listWhiteboardsApi,
  renameWhiteboardApi,
  type WhiteboardSummary,
} from "../../services/api";

export function WhiteboardsView() {
  const { currentProject, navigate } = useApp();
  const [items, setItems] = useState<WhiteboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!currentProject) return;
    setLoading(true);
    setError("");
    try {
      const response = await listWhiteboardsApi(currentProject.id);
      setItems(response.data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load whiteboards.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [currentProject?.id]);

  async function create() {
    if (!currentProject || !name.trim() || creating) return;
    setCreating(true);
    try {
      const response = await createWhiteboardApi(currentProject.id, name.trim());
      navigate(`/project/${currentProject.id}/whiteboards/${response.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create whiteboard.");
    } finally {
      setCreating(false);
    }
  }

  async function rename(item: WhiteboardSummary) {
    const nextName = window.prompt("Whiteboard name", item.name)?.trim();
    if (!nextName || nextName === item.name) return;
    try {
      const response = await renameWhiteboardApi(item.id, nextName);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...response.data } : entry));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename whiteboard.");
    }
  }

  async function remove(item: WhiteboardSummary) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await deleteWhiteboardApi(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete whiteboard.");
    }
  }

  if (!currentProject) return null;
  return (
    <section className="p-6 sm:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <button onClick={() => navigate(`/project/${currentProject.id}/overview`)} className="text-xs text-text-muted hover:text-text-primary inline-flex items-center gap-1 mb-2">
            <ArrowLeft size={13} /> Back to project
          </button>
          <h2 className="text-xl font-semibold text-text-primary">Whiteboards</h2>
          <p className="text-sm text-text-muted mt-1">Persistent visual spaces for this project.</p>
        </div>
        <div className="flex gap-2">
          <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void create(); }} placeholder="New whiteboard name" maxLength={150} className="h-9 px-3 rounded-lg border border-border bg-surface text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand-primary" aria-label="New whiteboard name" />
          <Button variant="primary" size="sm" icon={FilePlus2} disabled={!name.trim() || creating} onClick={() => void create()}>{creating ? "Creating..." : "Create"}</Button>
        </div>
      </div>
      {error && <div role="alert" className="mb-4 p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger-text text-sm">{error} <button className="underline ml-2" onClick={() => void load()}>Retry</button></div>}
      {loading ? <div className="text-sm text-text-muted p-8 text-center">Loading whiteboards...</div> : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-text-muted"><FilePlus2 className="mx-auto mb-3" size={28} /><p className="text-sm">No whiteboards yet.</p><p className="text-xs mt-1">Create one to start sketching with Excalidraw.</p></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => <article key={item.id} className="rounded-xl border border-border bg-surface p-4 hover:border-border-strong transition-colors">
            <div className="flex justify-between gap-2"><h3 className="font-medium text-text-primary truncate">{item.name}</h3><MoreHorizontal size={17} className="text-text-muted" /></div>
            <p className="text-xs text-text-muted mt-2">Updated {new Date(item.updatedAt).toLocaleString()}</p>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="primary" onClick={() => navigate(`/project/${currentProject.id}/whiteboards/${item.id}`)}>Open</Button>
              <Button size="icon-sm" title="Rename whiteboard" ariaLabel={`Rename ${item.name}`} icon={Edit3} onClick={() => void rename(item)} />
              <Button size="icon-sm" variant="danger" title="Delete whiteboard" ariaLabel={`Delete ${item.name}`} icon={Trash2} onClick={() => void remove(item)} />
            </div>
          </article>)}
        </div>
      )}
    </section>
  );
}
