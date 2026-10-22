import React from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { History, User as UserIcon, Calendar, CheckCircle2, RotateCcw, FileText, ArrowRight } from 'lucide-react';
import type { AuditLogEntry, User, Task } from '../../types';

export interface AuditEventDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  log: AuditLogEntry | null;
  actor: { name: string; email?: string | null };
  entity: { label: string; isDeleted?: boolean };
  actionInfo: { label: string; badgeClass: string };
  formattedDesc: string;
  formattedTimestamp: string;
}

export function AuditEventDetailsDialog({
  isOpen,
  onClose,
  log,
  actor,
  entity,
  actionInfo,
  formattedDesc,
  formattedTimestamp,
}: AuditEventDetailsDialogProps) {
  if (!log) return null;

  const previousState = log.previousState || (log as any).previousValue;
  const newState = log.newState || (log as any).newValue;

  const hasStateDiff = Boolean(
    previousState &&
    newState &&
    typeof previousState === 'object' &&
    typeof newState === 'object' &&
    Object.keys(previousState).length > 0 &&
    Object.keys(newState).length > 0
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Activity Details"
      description="Authoritative audit event record and change metadata."
      maxWidth="max-w-xl"
    >
      <div className="space-y-4 text-xs">
        {/* Header Summary Card */}
        <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`inline-block font-semibold text-xs px-2.5 py-1 rounded-md border ${actionInfo.badgeClass}`}>
              {actionInfo.label}
            </span>
            <div className="flex items-center gap-1.5 text-text-muted font-mono text-[11px]">
              <Calendar size={13} />
              <span>{formattedTimestamp}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
                Performed By
              </p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center text-brand-primary font-bold text-[10px]">
                  {(actor.name || 'U').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary truncate">{actor.name}</p>
                  {actor.email && (
                    <p className="text-[11px] text-text-muted truncate">{actor.email}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
                Affected Entity
              </p>
              <p className="font-semibold text-text-primary truncate">{entity.label}</p>
              <p className="text-[11px] text-text-muted capitalize">
                Type: {log.entityType || 'Record'}
              </p>
            </div>
          </div>
        </div>

        {/* Full Natural Language Description */}
        <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
          <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={13} className="text-brand-primary" />
            <span>Full Description</span>
          </p>
          <p className="text-text-primary text-xs leading-relaxed break-words whitespace-pre-wrap font-medium">
            {formattedDesc}
          </p>
        </div>

        {/* Reversal / Undo Status */}
        {log.isUndone && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
            <RotateCcw size={15} className="shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-200">Change Undone</p>
              <p className="text-[11px] text-amber-300/80">
                This modification has been reversed.
                {(log as any).undoneAt && ` (${new Date((log as any).undoneAt).toLocaleString()})`}
              </p>
            </div>
          </div>
        )}

        {/* Relevant Previous vs New State Diff (if recorded) */}
        {hasStateDiff && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              Recorded State Change
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Previous State */}
              <div className="p-3 rounded-lg bg-surface border border-border space-y-1.5 overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">
                  Previous Value
                </span>
                <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap break-all max-h-36 overflow-y-auto">
                  {typeof previousState === 'string'
                    ? previousState
                    : JSON.stringify(previousState, null, 2)}
                </pre>
              </div>

              {/* New State */}
              <div className="p-3 rounded-lg bg-surface border border-border space-y-1.5 overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  New Value
                </span>
                <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap break-all max-h-36 overflow-y-auto">
                  {typeof newState === 'string'
                    ? newState
                    : JSON.stringify(newState, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Close Button Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-border">
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
