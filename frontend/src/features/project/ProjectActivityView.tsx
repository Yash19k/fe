import React, { useState, useMemo } from 'react';
import { useApp } from '../../hooks/useApp';
import { Button } from '../../components/ui/Button';
import { RotateCcw, Activity, Search, Eye } from 'lucide-react';
import type { AuditLogEntry, Task } from '../../types';
import { AuditEventDetailsDialog } from '../../components/activity/AuditEventDetailsDialog';
import {
  getAuditActor,
  getAuditEntityInfo,
  formatAuditAction,
  formatAuditDescription,
  formatAuditTimestamp,
} from './ProjectSettingsView';

export function ProjectActivityView() {
  const { currentProject, projectTasks, auditLog, undoAuditEntry, currentUser, allUsers } = useApp();
  const [auditFilter, setAuditFilter] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogEntry | null>(null);

  // Project-scoped audit filtering: only events belonging to this project
  const projectAuditLog = useMemo(() => {
    if (!currentProject) return [];
    const projectTaskIds = new Set(projectTasks.map((t: Task) => t.id));

    return auditLog.filter((log: AuditLogEntry) => {
      // 1. Explicitly scoped with projectId
      const matchesScope =
        (log.projectId && log.projectId === currentProject.id) ||
        (log.entityType === 'project' && log.entityId === currentProject.id) ||
        (log.entityType === 'task' && (projectTaskIds.has(log.entityId) || log.projectId === currentProject.id));

      if (!matchesScope) return false;
      if (!auditFilter.trim()) return true;

      const q = auditFilter.toLowerCase();
      const actor = getAuditActor(log, allUsers);
      const entity = getAuditEntityInfo(log, projectTasks, currentProject.name);
      const actionInfo = formatAuditAction(log.action);
      const desc = formatAuditDescription(log, projectTasks, currentProject.name);

      return (
        actionInfo.label.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q) ||
        log.description.toLowerCase().includes(q) ||
        actor.name.toLowerCase().includes(q) ||
        entity.label.toLowerCase().includes(q)
      );
    });
  }, [currentProject, projectTasks, auditLog, auditFilter, allUsers]);

  if (!currentProject) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight">
            Activity &amp; Audit Log
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Scoped event history of mutations, task edits, schedule updates, and member changes in this project.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <input
              type="search"
              placeholder="Search audit trail..."
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>

          <div className="text-xs text-text-muted font-mono whitespace-nowrap">
            {projectAuditLog.length} {projectAuditLog.length === 1 ? 'event' : 'events'}
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      {/* Audit Log Table */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="w-full">
          <div className="hidden md:grid md:grid-cols-[100px_120px_120px_minmax(0,1fr)_125px_105px] gap-2.5 px-4 py-2.5 border-b border-border bg-surface-elevated text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            <span>Action</span>
            <span>Performed By</span>
            <span>Entity</span>
            <span>Description</span>
            <span>Timestamp</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-border/60">
            {projectAuditLog.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted space-y-2">
                <Activity size={24} className="mx-auto text-text-muted/60" />
                <p className="font-medium text-text-secondary">No activity recorded for this project yet</p>
                <p className="text-[11px]">Mutations, task updates, and membership actions in this project will appear here.</p>
              </div>
            ) : (
              projectAuditLog.map((log: AuditLogEntry) => {
                const actor = getAuditActor(log, allUsers);
                const entity = getAuditEntityInfo(log, projectTasks, currentProject.name);
                const initials = (actor.name || 'U').slice(0, 2).toUpperCase();
                const actionInfo = formatAuditAction(log.action);
                const formattedDesc = formatAuditDescription(log, projectTasks, currentProject.name);

                return (
                  <div
                    key={log.id}
                    className="grid grid-cols-1 md:grid-cols-[100px_120px_120px_minmax(0,1fr)_125px_105px] gap-2.5 items-center px-4 py-2.5 hover:bg-surface-hover/70 transition-colors text-xs"
                  >
                    {/* Action Badge */}
                    <div className="min-w-0">
                      <span className={`inline-block font-medium text-[10px] px-2 py-0.5 rounded-md border truncate max-w-full ${actionInfo.badgeClass}`}>
                        {actionInfo.label}
                      </span>
                    </div>

                    {/* Performed By */}
                    <div className="flex items-center gap-1.5 min-w-0" title={actor.email ? `${actor.name} (${actor.email})` : actor.name}>
                      <div className="w-5 h-5 rounded-full bg-surface-elevated border border-border flex items-center justify-center text-[9px] font-semibold text-text-secondary shrink-0">
                        {initials}
                      </div>
                      <span className="font-medium text-text-primary truncate">
                        {actor.name}
                      </span>
                    </div>

                    {/* Entity */}
                    <div
                      className={`truncate font-medium ${
                        entity.isDeleted ? 'text-text-muted italic' : 'text-text-secondary'
                      }`}
                      title={entity.label}
                    >
                      {entity.label}
                    </div>

                    {/* Description with Clickable Preview */}
                    <button
                      type="button"
                      onClick={() => setSelectedAuditLog(log)}
                      className="font-medium text-text-primary text-left truncate hover:text-brand-primary group flex items-center gap-1.5 focus:outline-none focus:underline cursor-pointer min-w-0"
                      title="Click to view full event details"
                    >
                      <span className="truncate">{formattedDesc}</span>
                      <Eye size={12} className="opacity-0 group-hover:opacity-100 text-brand-primary shrink-0 transition-opacity" />
                    </button>

                    {/* Timestamp */}
                    <div className="text-[11px] text-text-muted font-mono whitespace-nowrap">
                      {formatAuditTimestamp(log.timestamp)}
                    </div>

                    {/* Actions Column */}
                    <div className="flex justify-end items-center">
                      {log.isUndone ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-surface-elevated text-text-muted border border-border whitespace-nowrap">
                          Change undone
                        </span>
                      ) : log.canUndo && currentUser.role !== 'Teammate' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={RotateCcw}
                          onClick={() => undoAuditEntry(log.id)}
                          title="Undo this mutation and revert state"
                          className="whitespace-nowrap h-7 text-xs px-2"
                        >
                          Undo
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Audit Event Details Dialog */}
      <AuditEventDetailsDialog
        isOpen={Boolean(selectedAuditLog)}
        onClose={() => setSelectedAuditLog(null)}
        log={selectedAuditLog}
        allUsers={allUsers}
        projectTasks={projectTasks}
        projectName={currentProject.name}
      />
    </div>
  );
}
