import React, { useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { Button } from '../../components/ui/Button';
import { RotateCcw, Activity } from 'lucide-react';
import type { AuditLogEntry, Task } from '../../types';

export function ProjectActivityView() {
  const { currentProject, projectTasks, auditLog, undoAuditEntry, currentUser } = useApp();

  // Project-scoped audit filtering: only events belonging to this project
  const projectAuditLog = useMemo(() => {
    if (!currentProject) return [];
    const projectTaskIds = new Set(projectTasks.map((t: Task) => t.id));

    return auditLog.filter((log: AuditLogEntry) => {
      // 1. Explicitly scoped with projectId
      if (log.projectId) {
        return log.projectId === currentProject.id;
      }
      // 2. Direct project entity
      if (log.entityType === 'project' && log.entityId === currentProject.id) {
        return true;
      }
      // 3. Resolvable via task in this project
      if (log.entityType === 'task' && projectTaskIds.has(log.entityId)) {
        return true;
      }
      return false;
    });
  }, [currentProject, projectTasks, auditLog]);

  if (!currentProject) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-text-primary tracking-tight">
              Activity & Audit Log
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-elevated border border-border text-text-muted">
              {currentProject.name}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Scoped event history of mutations, task edits, schedule updates, and member changes in this project.
          </p>
        </div>
        <div className="text-xs text-text-muted font-mono">
          {projectAuditLog.length} recorded {projectAuditLog.length === 1 ? 'event' : 'events'}
        </div>
      </div>

      {/* Audit Log Table */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="hidden md:grid md:grid-cols-[130px_110px_1fr_160px_90px] gap-3 px-5 py-2.5 border-b border-border bg-surface-elevated text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          <span>Action Type</span>
          <span>Entity</span>
          <span>Description</span>
          <span>Timestamp</span>
          <span className="text-right">Action</span>
        </div>

        <div className="divide-y divide-border/60">
          {projectAuditLog.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted space-y-2">
              <Activity size={24} className="mx-auto text-text-muted/60" />
              <p className="font-medium text-text-secondary">No activity recorded for this project yet</p>
              <p className="text-[11px]">Mutations, task updates, and membership actions in this project will appear here.</p>
            </div>
          ) : (
            projectAuditLog.map((log: AuditLogEntry) => (
              <div
                key={log.id}
                className="grid grid-cols-1 md:grid-cols-[130px_110px_1fr_160px_90px] gap-3 items-center px-5 py-3 hover:bg-surface-hover/70 transition-colors text-xs"
              >
                {/* Action Badge */}
                <div>
                  <span className="font-mono text-[11px] uppercase text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/20">
                    {log.action}
                  </span>
                </div>

                {/* Entity */}
                <div className="text-text-muted capitalize">
                  {log.entityType} ({log.entityId})
                </div>

                {/* Description */}
                <div className="font-medium text-text-primary truncate">
                  {log.description}
                </div>

                {/* Timestamp */}
                <div className="text-[11px] text-text-muted font-mono">
                  {new Date(log.timestamp).toLocaleString()}
                </div>

                {/* Undo Button */}
                <div className="flex justify-end">
                  {log.canUndo && currentUser.role !== 'Teammate' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RotateCcw}
                      onClick={() => undoAuditEntry(log.id)}
                      title="Undo this mutation and revert state"
                    >
                      Undo
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
