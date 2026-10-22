import React from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import {
  Clock,
  User as UserIcon,
  Layers,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  History,
} from 'lucide-react';
import type { AuditLogEntry, User, Task } from '../../types';
import {
  getAuditActor,
  getAuditEntityInfo,
  formatAuditAction,
  formatAuditDescription,
  formatAuditTimestamp,
} from '../../features/project/ProjectSettingsView';

export interface AuditEventDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  log: AuditLogEntry | null;
  allUsers?: User[];
  projectTasks?: Task[];
  projectName?: string;
}

export function AuditEventDetailsDialog({
  isOpen,
  onClose,
  log,
  allUsers = [],
  projectTasks = [],
  projectName = 'Project',
}: AuditEventDetailsDialogProps) {
  if (!log) return null;

  const actor = getAuditActor(log, allUsers);
  const entity = getAuditEntityInfo(log, projectTasks, projectName);
  const actionInfo = formatAuditAction(log.action);
  const formattedDesc = formatAuditDescription(log, projectTasks, projectName);

  const formattedFullDate = (() => {
    try {
      const d = new Date(log.timestamp);
      if (isNaN(d.getTime())) return log.timestamp;
      return d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
    } catch {
      return log.timestamp;
    }
  })();

  const hasPrevious =
    log.previousValue !== undefined &&
    log.previousValue !== null &&
    (typeof log.previousValue !== 'object' || Object.keys(log.previousValue).length > 0);

  const hasNew =
    log.newValue !== undefined &&
    log.newValue !== null &&
    (typeof log.newValue !== 'object' || Object.keys(log.newValue).length > 0);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Audit Event Details"
      description="Authoritative ledger record of workspace activity."
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 text-xs">
        {/* Header Action & Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-surface-elevated border border-border">
          <div className="flex items-center gap-2">
            <span className={`inline-block font-medium text-xs px-2.5 py-1 rounded-md border ${actionInfo.badgeClass}`}>
              {actionInfo.label}
            </span>
            <span className="font-mono text-[11px] text-text-muted">
              ID: {log.id}
            </span>
          </div>

          <div>
            {log.isUndone ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                <CheckCircle2 size={12} />
                Change undone
              </span>
            ) : log.canUndo ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Eligible for Undo
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface text-text-muted border border-border">
                Standard record
              </span>
            )}
          </div>
        </div>

        {/* Primary Meta Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Performed By */}
          <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <UserIcon size={12} className="text-text-muted" />
              Performed By
            </span>
            <p className="font-semibold text-text-primary text-sm truncate">
              {actor.name}
            </p>
            {actor.email && (
              <p className="text-[11px] text-text-muted font-mono truncate">
                {actor.email}
              </p>
            )}
          </div>

          {/* Affected Entity */}
          <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={12} className="text-text-muted" />
              Affected Entity
            </span>
            <p className="font-semibold text-text-primary text-sm truncate">
              {entity.label}
            </p>
            <p className="text-[11px] text-text-muted capitalize">
              Type: {log.entityType || 'General'}
            </p>
          </div>
        </div>

        {/* Description Section */}
        <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1.5">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={12} className="text-text-muted" />
            Full Event Description
          </span>
          <p className="text-text-primary leading-relaxed text-xs break-words whitespace-pre-wrap">
            {formattedDesc}
          </p>
        </div>

        {/* Timestamp */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border text-[11px]">
          <span className="text-text-muted flex items-center gap-1.5">
            <Clock size={13} className="text-text-muted" />
            Timestamp
          </span>
          <span className="font-mono text-text-primary font-medium">
            {formattedFullDate}
          </span>
        </div>

        {/* Previous and New Values (if available) */}
        {(hasPrevious || hasNew) && (
          <div className="space-y-2">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">
              State Mutation Payload
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
              {hasPrevious && (
                <div className="p-3 rounded-xl bg-surface-elevated border border-border space-y-1 overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-rose-400 block">
                    Previous Value
                  </span>
                  <pre className="text-text-secondary overflow-x-auto max-h-32 p-1 bg-surface rounded">
                    {typeof log.previousValue === 'object'
                      ? JSON.stringify(log.previousValue, null, 2)
                      : String(log.previousValue)}
                  </pre>
                </div>
              )}
              {hasNew && (
                <div className="p-3 rounded-xl bg-surface-elevated border border-border space-y-1 overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                    New Value
                  </span>
                  <pre className="text-text-secondary overflow-x-auto max-h-32 p-1 bg-surface rounded">
                    {typeof log.newValue === 'object'
                      ? JSON.stringify(log.newValue, null, 2)
                      : String(log.newValue)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
