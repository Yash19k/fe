import React from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { useApp } from '../../hooks/useApp';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ConflictModal() {
  const { conflictModalData, setConflictModalData, updateTask, openTaskDrawer } = useApp();

  if (!conflictModalData) return null;

  const { taskId, snapshotVersion, latestTask, pendingUpdates } = conflictModalData;

  function handleReloadLatest() {
    setConflictModalData(null);
    openTaskDrawer(taskId);
  }

  function handleForceOverwrite() {
    // Force save by not passing snapshotVersion
    updateTask(taskId, pendingUpdates, null);
    setConflictModalData(null);
  }

  return (
    <Dialog
      isOpen={Boolean(conflictModalData)}
      onClose={() => setConflictModalData(null)}
      title="Concurrent Edit Collision Detected"
      description="Another teammate or browser session updated this task while your editor was open."
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-200">
          <AlertTriangle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-300">
              Version Conflict (Your edit was based on v{snapshotVersion}, current is v
              {latestTask?.version})
            </p>
            <p className="mt-1 leading-relaxed text-rose-200/80">
              To prevent accidental overwrites of team progress, please choose how you would like to proceed.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-surface-elevated border border-border space-y-2 text-xs">
          <p className="font-semibold text-text-primary">Latest Task State on Server:</p>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-text-secondary">
            <div>
              <span className="text-text-muted">Title:</span> {latestTask?.title}
            </div>
            <div>
              <span className="text-text-muted">Status:</span> {latestTask?.status}
            </div>
            <div>
              <span className="text-text-muted">Priority:</span> {latestTask?.priority}
            </div>
            <div>
              <span className="text-text-muted">Due Date:</span> {latestTask?.dueDate || 'None'}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" size="sm" onClick={() => setConflictModalData(null)}>
            Cancel Edit
          </Button>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleReloadLatest}>
            Reload Latest
          </Button>
          <Button variant="danger" size="sm" onClick={handleForceOverwrite}>
            Overwrite with My Changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
