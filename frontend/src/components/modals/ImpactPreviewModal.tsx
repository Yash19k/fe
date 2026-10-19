import React from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { useApp } from '../../hooks/useApp';
import { formatShortDate } from '../../domain/businessDays';
import { Calendar, ArrowRight } from 'lucide-react';

export function ImpactPreviewModal() {
  const { impactModalData, setImpactModalData, confirmRescheduleImpact } = useApp();

  if (!impactModalData) return null;

  const {
    taskTitle,
    oldDueDate,
    newDueDate,
    shiftBusinessDays,
    affectedTasks = [],
    currentProjectEnd,
    newProjectEnd,
    projectExtended,
  } = impactModalData;

  return (
    <Dialog
      isOpen={Boolean(impactModalData)}
      onClose={() => setImpactModalData(null)}
      title="Reschedule Impact Preview"
      description="Downstream dependent tasks will automatically shift to respect finish-to-start constraints."
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Primary task movement */}
        <div className="p-3 rounded-lg bg-surface-elevated border border-border">
          <p className="text-xs text-text-muted">Target Task Rescheduled</p>
          <p className="text-sm font-semibold text-text-primary mt-0.5">{taskTitle}</p>
          <div className="flex items-center gap-2 mt-2 text-xs font-medium text-text-secondary">
            <span>{formatShortDate(oldDueDate)}</span>
            <ArrowRight size={13} className="text-brand-primary" />
            <span className="text-brand-primary">{formatShortDate(newDueDate)}</span>
            <span className="text-text-muted">
              ({shiftBusinessDays >= 0 ? `+${shiftBusinessDays}` : shiftBusinessDays} business days)
            </span>
          </div>
        </div>

        {/* Affected downstream successors */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Affected Downstream Tasks ({affectedTasks.length})
            </h4>
            <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              Skipping Weekends
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {affectedTasks.map((aff: any) => (
              <div
                key={aff.taskId}
                className="p-2.5 rounded-lg bg-surface-elevated border border-border text-xs flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-medium text-text-primary truncate">{aff.title}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Start: {formatShortDate(aff.newStartDate)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 text-text-secondary">
                  <span>{formatShortDate(aff.oldDueDate)}</span>
                  <ArrowRight size={12} className="text-brand-primary" />
                  <span className="text-amber-400 font-medium">
                    {formatShortDate(aff.newDueDate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Project completion impact banner */}
        <div
          className={`p-3 rounded-lg border flex items-start gap-2.5 ${
            projectExtended
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
          }`}
        >
          <Calendar size={18} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold">
              Project Target Completion Date:{' '}
              <span className="font-bold">
                {formatShortDate(currentProjectEnd)} → {formatShortDate(newProjectEnd)}
              </span>
            </p>
            {projectExtended ? (
              <p className="text-amber-300/80 mt-0.5">
                Note: Overall project delivery date will be extended due to dependencies on the critical path.
              </p>
            ) : (
              <p className="text-emerald-300/80 mt-0.5">
                Downstream buffer absorbed the delay without extending the overall project deadline.
              </p>
            )}
          </div>
        </div>

        {/* Modal actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" size="sm" onClick={() => setImpactModalData(null)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={confirmRescheduleImpact}>
            Apply Schedule Changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
