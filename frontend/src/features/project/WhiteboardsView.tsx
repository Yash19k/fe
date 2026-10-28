import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Edit3, FilePlus2, PenTool, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { useApp } from "../../hooks/useApp";
import {
  createWhiteboardApi,
  deleteWhiteboardApi,
  listWhiteboardsApi,
  renameWhiteboardApi,
  type WhiteboardSummary,
} from "../../services/api";

export function WhiteboardsView() {
  const { currentProject, navigate, showToast } = useApp();
  const [items, setItems] = useState<WhiteboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  // References
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Rename Dialog State
  const [itemToRename, setItemToRename] = useState<WhiteboardSummary | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState("");

  // Delete Dialog State
  const [itemToDelete, setItemToDelete] = useState<WhiteboardSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  useEffect(() => {
    void load();
  }, [currentProject?.id]);

  async function create() {
    if (!currentProject || !name.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const response = await createWhiteboardApi(currentProject.id, name.trim());
      navigate(`/project/${currentProject.id}/whiteboards/${response.data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to create whiteboard.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setCreating(false);
    }
  }

  function openRenameDialog(item: WhiteboardSummary) {
    setItemToRename(item);
    setRenameName(item.name);
    setRenameError("");
  }

  async function confirmRename() {
    if (!itemToRename || renaming) return;
    const trimmed = renameName.trim();
    if (!trimmed) {
      setRenameError("Whiteboard name cannot be empty.");
      return;
    }
    if (trimmed === itemToRename.name) {
      setItemToRename(null);
      return;
    }
    setRenaming(true);
    setRenameError("");
    try {
      const response = await renameWhiteboardApi(itemToRename.id, trimmed);
      setItems((current) =>
        current.map((entry) => (entry.id === itemToRename.id ? { ...entry, ...response.data } : entry))
      );
      showToast(`Whiteboard renamed to "${response.data.name}".`, "success");
      setItemToRename(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to rename whiteboard.";
      setRenameError(msg);
      showToast(msg, "error");
    } finally {
      setRenaming(false);
    }
  }

  function openDeleteDialog(item: WhiteboardSummary) {
    setItemToDelete(item);
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!itemToDelete || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteWhiteboardApi(itemToDelete.id);
      setItems((current) => current.filter((entry) => entry.id !== itemToDelete.id));
      showToast(`Whiteboard "${itemToDelete.name}" deleted.`, "success");
      setItemToDelete(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to delete whiteboard.";
      setDeleteError(msg);
      showToast(msg, "error");
    } finally {
      setDeleting(false);
    }
  }

  function handleStartCreate() {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
      nameInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  if (!currentProject) return null;

  return (
    <section className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6">
      {/* Header and Creation Controls */}
      <div className="space-y-4 border-b border-border pb-5">
        <button
          onClick={() => navigate(`/project/${currentProject.id}/overview`)}
          className="text-xs font-medium text-text-muted hover:text-text-primary inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
        >
          <ArrowLeft size={13} /> Back to project
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">Whiteboards</h2>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Persistent visual spaces and architecture sketches for {currentProject.name}.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto"
          >
            <input
              ref={nameInputRef}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError("");
              }}
              placeholder="New whiteboard name"
              maxLength={150}
              disabled={creating}
              className="h-9 px-3 rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-brand-primary w-full sm:w-64 transition-colors disabled:opacity-50"
              aria-label="New whiteboard name"
            />
            <Button
              variant="primary"
              size="md"
              icon={FilePlus2}
              type="submit"
              disabled={!name.trim() || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </form>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger-text text-xs flex items-center justify-between gap-2"
        >
          <span>{error}</span>
          <button className="underline font-medium hover:opacity-80 shrink-0" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="text-sm text-text-muted p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
          <span>Loading whiteboards...</span>
        </div>
      ) : items.length === 0 ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleStartCreate}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleStartCreate();
            }
          }}
          className="group flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-surface/40 hover:bg-surface/80 hover:border-brand-primary/50 transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          aria-label="Create your first whiteboard"
        >
          <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-muted group-hover:text-brand-primary group-hover:border-brand-primary/30 transition-colors mb-3.5 shadow-xs">
            <FilePlus2 size={24} />
          </div>
          <h3 className="text-base font-semibold text-text-primary">No whiteboards yet</h3>
          <p className="text-xs text-text-secondary mt-1.5 max-w-sm leading-relaxed">
            Create one to start sketching architecture diagrams, workflows, and ideas with Excalidraw.
          </p>
          <div className="mt-5">
            <Button
              variant="primary"
              size="sm"
              icon={FilePlus2}
              onClick={(e) => {
                e.stopPropagation();
                handleStartCreate();
              }}
            >
              Create your first whiteboard
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="group rounded-xl border border-border bg-surface hover:bg-surface-elevated/40 hover:border-border-strong p-5 shadow-xs transition-all duration-150 flex flex-col justify-between focus-within:ring-2 focus-within:ring-brand-primary/30"
            >
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-surface-elevated border border-border flex items-center justify-center text-text-muted shrink-0 group-hover:text-brand-primary group-hover:border-brand-primary/30 transition-colors">
                    <PenTool size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-text-primary truncate" title={item.name}>
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
                      <Clock size={12} className="shrink-0" />
                      <span>Updated {new Date(item.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 mt-5 pt-3.5 border-t border-border">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => navigate(`/project/${currentProject.id}/whiteboards/${item.id}`)}
                >
                  Open
                </Button>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon-sm"
                    variant="secondary"
                    title="Rename whiteboard"
                    ariaLabel={`Rename ${item.name}`}
                    icon={Edit3}
                    onClick={() => openRenameDialog(item)}
                  />
                  <Button
                    size="icon-sm"
                    variant="danger"
                    title="Delete whiteboard"
                    ariaLabel={`Delete ${item.name}`}
                    icon={Trash2}
                    onClick={() => openDeleteDialog(item)}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* In-App Rename Dialog */}
      <Dialog
        isOpen={Boolean(itemToRename)}
        onClose={() => {
          if (!renaming) {
            setItemToRename(null);
            setRenameError("");
          }
        }}
        title="Rename Whiteboard"
        description="Enter a new name for this whiteboard."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void confirmRename();
          }}
          className="space-y-4"
        >
          <Input
            label="Whiteboard Name"
            value={renameName}
            onChange={(e) => {
              setRenameName(e.target.value);
              if (renameError) setRenameError("");
            }}
            placeholder="Whiteboard name"
            maxLength={150}
            error={renameError}
            disabled={renaming}
            autoFocus
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              disabled={renaming}
              type="button"
              onClick={() => {
                setItemToRename(null);
                setRenameError("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!renameName.trim() || renaming}
            >
              {renaming ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* In-App Delete Confirmation Dialog */}
      <Dialog
        isOpen={Boolean(itemToDelete)}
        onClose={() => {
          if (!deleting) {
            setItemToDelete(null);
            setDeleteError("");
          }
        }}
        title="Delete Whiteboard"
        description="This action cannot be undone."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <Trash2 size={20} />
            </div>
            <div className="text-xs text-text-secondary space-y-1">
              <p>
                Are you sure you want to delete <span className="font-semibold text-text-primary">"{itemToDelete?.name}"</span>?
              </p>
              <p className="text-[11px] text-text-muted leading-relaxed">
                All drawings, shapes, and collaborative revisions on this whiteboard will be permanently deleted.
              </p>
            </div>
          </div>

          {deleteError && (
            <div role="alert" className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger-text text-xs">
              {deleteError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => {
                setItemToDelete(null);
                setDeleteError("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? "Deleting..." : "Delete Whiteboard"}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
