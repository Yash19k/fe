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

import { parseDateValue } from '../../utils/dateUtils';

const AUDIT_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  type: 'Type',
  status: 'Status',
  dueDate: 'Due Date',
  startDate: 'Start Date',
  priority: 'Priority',
  severity: 'Severity',
  description: 'Description',
  name: 'Name',
  role: 'Role',
  goal: 'Goal',
  labelId: 'Label',
  labelIds: 'Labels',
  assigneeId: 'Assignee',
  assigneeIds: 'Assignees',
  sprintId: 'Sprint',
  parentId: 'Parent Task',
  estimatedHours: 'Estimated Hours',
  actualHours: 'Actual Hours',
  plannedDurationWorkingDays: 'Planned Duration (Working Days)',
  recurrenceRule: 'Recurrence Rule',
  isBlocked: 'Is Blocked',
  blockReason: 'Block Reason',
  dependencyIds: 'Dependencies',
  key: 'Project Key',
  projectKey: 'Project Key',
  email: 'Email',
};

const AUDIT_ENUM_LABELS: Record<string, string> = {
  SUBTASK: 'Subtask',
  TASK: 'Task',
  STORY: 'Story',
  BUG: 'Bug',
  EPIC: 'Epic',
  MILESTONE: 'Milestone',

  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  TESTING_QA: 'Testing / QA',
  TESTING: 'Testing / QA',
  QA: 'Testing / QA',
  TODO: 'To Do',
  TO_DO: 'To Do',
  DONE: 'Done',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ACTIVE: 'Active',
  PLANNED: 'Planned',

  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
  CRITICAL: 'Critical',

  MINOR: 'Minor',
  MAJOR: 'Major',
  BLOCKER: 'Blocker',

  ADMIN: 'Admin',
  MANAGER: 'Manager',
  TEAMMATE: 'Teammate',
  VIEWER: 'Viewer',
  LEAD: 'Lead',
  MEMBER: 'Member',

  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

export function formatAuditFieldLabel(key: string): string {
  if (AUDIT_FIELD_LABELS[key]) return AUDIT_FIELD_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatAuditFieldValue(
  key: string,
  val: any,
  allUsers: User[] = [],
  projectTasks: Task[] = []
): string {
  if (val === null || val === undefined || val === '') {
    return 'Not set';
  }

  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No';
  }

  if (typeof val === 'number') {
    return String(val);
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return 'None';
    if (key.toLowerCase().includes('assignee')) {
      return val
        .map((id) => allUsers.find((u) => u.id === id)?.name || allUsers.find((u) => u.id === id)?.fullName || id)
        .join(', ');
    }
    if (key.toLowerCase().includes('dependenc')) {
      return val
        .map((id) => projectTasks.find((t) => t.id === id)?.title || id)
        .join(', ');
    }
    return val.map((item) => formatAuditFieldValue(key, item, allUsers, projectTasks)).join(', ');
  }

  if (typeof val === 'object') {
    if (val.frequency) {
      const freq = AUDIT_ENUM_LABELS[String(val.frequency).toUpperCase()] || val.frequency;
      const interval = val.interval ? ` (every ${val.interval})` : '';
      const weekdays = val.weekdaysOnly ? ' - Weekdays only' : '';
      return `${freq}${interval}${weekdays}`;
    }
    if (val.name) return String(val.name);
    if (val.title) return String(val.title);
    if (val.label) return String(val.label);

    try {
      const subEntries = Object.entries(val);
      if (subEntries.length === 0) return 'Empty';
      return subEntries
        .map(([k, v]) => `${formatAuditFieldLabel(k)}: ${formatAuditFieldValue(k, v, allUsers, projectTasks)}`)
        .join(', ');
    } catch {
      return 'Complex data';
    }
  }

  const strVal = String(val).trim();
  const upperVal = strVal.toUpperCase();

  if (AUDIT_ENUM_LABELS[upperVal]) {
    return AUDIT_ENUM_LABELS[upperVal];
  }

  if (key.toLowerCase().includes('user') || key.toLowerCase().includes('assignee')) {
    const matchedUser = allUsers.find((u) => u.id === strVal);
    if (matchedUser) {
      return matchedUser.name || matchedUser.fullName || matchedUser.email || strVal;
    }
  }

  if (key === 'parentId') {
    const matchedTask = projectTasks.find((t) => t.id === strVal);
    if (matchedTask) {
      return matchedTask.title || strVal;
    }
  }

  if (
    key.toLowerCase().includes('date') ||
    key.toLowerCase().includes('deadline') ||
    /^\d{4}-\d{2}-\d{2}/.test(strVal)
  ) {
    const d = parseDateValue(strVal);
    if (d) {
      return d.toLocaleDateString();
    }
  }

  if (/^[A-Z0-9_]{2,}$/.test(strVal)) {
    return strVal
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  return strVal;
}

export function renderStructuredPayload(
  payload: any,
  allUsers: User[] = [],
  projectTasks: Task[] = []
) {
  if (payload === null || payload === undefined) {
    return <p className="text-text-muted italic text-xs py-1">No value recorded</p>;
  }

  if (typeof payload !== 'object') {
    return (
      <div className="space-y-0.5">
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">
          Value
        </span>
        <p className="text-text-primary text-xs font-medium break-words">
          {formatAuditFieldValue('value', payload, allUsers, projectTasks)}
        </p>
      </div>
    );
  }

  const entries = Object.entries(payload).filter(([k]) => {
    if (Object.keys(payload).length > 1 && (k === 'version' || k === 'id')) {
      return false;
    }
    return true;
  });

  if (entries.length === 0) {
    return <p className="text-text-muted italic text-xs py-1">Not set</p>;
  }

  return (
    <div className="space-y-2.5">
      {entries.map(([key, value]) => {
        const displayLabel = formatAuditFieldLabel(key);
        const displayValue = formatAuditFieldValue(key, value, allUsers, projectTasks);

        return (
          <div key={key} className="space-y-0.5">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">
              {displayLabel}
            </span>
            <p className="text-text-primary text-xs font-medium break-words">
              {displayValue}
            </p>
          </div>
        );
      })}
    </div>
  );
}

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {hasPrevious && (
                <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-2 overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-rose-400 block border-b border-border/60 pb-1.5">
                    Previous Value
                  </span>
                  <div className="max-h-56 overflow-y-auto pr-1">
                    {renderStructuredPayload(log.previousValue, allUsers, projectTasks)}
                  </div>
                </div>
              )}
              {hasNew && (
                <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-2 overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block border-b border-border/60 pb-1.5">
                    New Value
                  </span>
                  <div className="max-h-56 overflow-y-auto pr-1">
                    {renderStructuredPayload(log.newValue, allUsers, projectTasks)}
                  </div>
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
