import React from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  CheckCircle2,
  Circle,
  Ban,
  PauseCircle,
  ShieldAlert,
  Layers,
  BookOpen,
  CheckSquare,
  CornerDownRight,
  Bug,
  Minus,
  LucideIcon,
} from 'lucide-react';
import { WORK_ITEM_TYPES } from '../../domain/workItems';
import { WorkItemType, TaskStatus, Priority, SlaInfo } from '../../types';

export interface WorkItemTypeBadgeProps {
  type?: WorkItemType | string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function WorkItemTypeBadge({
  type = WORK_ITEM_TYPES.TASK,
  size = 'sm',
  showLabel = true,
}: WorkItemTypeBadgeProps) {
  const configs: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: LucideIcon }
  > = {
    [WORK_ITEM_TYPES.EPIC]: {
      label: 'Epic',
      bg: 'bg-status-purple-bg',
      text: 'text-status-purple-text',
      border: 'border-status-purple-border',
      icon: Layers,
    },
    [WORK_ITEM_TYPES.STORY]: {
      label: 'Story',
      bg: 'bg-status-success-bg',
      text: 'text-status-success-text',
      border: 'border-status-success-border',
      icon: BookOpen,
    },
    [WORK_ITEM_TYPES.TASK]: {
      label: 'Task',
      bg: 'bg-status-info-bg',
      text: 'text-status-info-text',
      border: 'border-status-info-border',
      icon: CheckSquare,
    },
    [WORK_ITEM_TYPES.SUBTASK]: {
      label: 'Subtask',
      bg: 'bg-surface-elevated',
      text: 'text-text-muted',
      border: 'border-border',
      icon: CornerDownRight,
    },
    [WORK_ITEM_TYPES.BUG]: {
      label: 'Bug',
      bg: 'bg-status-danger-bg',
      text: 'text-status-danger-text',
      border: 'border-status-danger-border',
      icon: Bug,
    },
  };

  const normalizedKey = (() => {
    if (!type) return WORK_ITEM_TYPES.TASK;
    const lower = String(type).toLowerCase().trim();
    if (lower === 'epic') return WORK_ITEM_TYPES.EPIC;
    if (lower === 'story') return WORK_ITEM_TYPES.STORY;
    if (lower === 'subtask') return WORK_ITEM_TYPES.SUBTASK;
    if (lower === 'bug') return WORK_ITEM_TYPES.BUG;
    return WORK_ITEM_TYPES.TASK;
  })();

  const c = configs[normalizedKey] || configs[type] || configs[WORK_ITEM_TYPES.TASK];
  const Icon = c.icon;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium border rounded-md whitespace-nowrap ${c.bg} ${c.text} ${c.border} ${
        isSm ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      }`}
      title={`Work Item Type: ${c.label}`}
    >
      <Icon size={isSm ? 11 : 13} strokeWidth={2.2} />
      {showLabel && <span>{c.label}</span>}
    </span>
  );
}

export interface StatusBadgeProps {
  status?: TaskStatus | string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const configs: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: LucideIcon }
  > = {
    'Done': {
      label: 'Done',
      bg: 'bg-status-success-bg',
      text: 'text-status-success-text',
      border: 'border-status-success-border',
      icon: CheckCircle2,
    },
    'In Progress': {
      label: 'In Progress',
      bg: 'bg-brand-subtle',
      text: 'text-brand-text',
      border: 'border-brand-border',
      icon: Clock,
    },
    'In Review': {
      label: 'In Review',
      bg: 'bg-status-purple-bg',
      text: 'text-status-purple-text',
      border: 'border-status-purple-border',
      icon: Clock,
    },
    'Testing / QA': {
      label: 'Testing / QA',
      bg: 'bg-status-info-bg',
      text: 'text-status-info-text',
      border: 'border-status-info-border',
      icon: CheckCircle,
    },
    'Blocked': {
      label: 'Blocked',
      bg: 'bg-status-danger-bg',
      text: 'text-status-danger-text',
      border: 'border-status-danger-border',
      icon: Ban,
    },
    'On Hold': {
      label: 'On Hold',
      bg: 'bg-status-warning-bg',
      text: 'text-status-warning-text',
      border: 'border-status-warning-border',
      icon: PauseCircle,
    },
    'Backlog': {
      label: 'Backlog',
      bg: 'bg-surface-elevated',
      text: 'text-text-muted',
      border: 'border-border',
      icon: Circle,
    },
    'To Do': {
      label: 'Backlog',
      bg: 'bg-surface-elevated',
      text: 'text-text-muted',
      border: 'border-border',
      icon: Circle,
    },
  };

  const key = status || 'Backlog';
  const c = configs[key] || configs['Backlog'];
  const Icon = c.icon;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded-md whitespace-nowrap ${c.bg} ${c.text} ${c.border} ${
        isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Icon size={isSm ? 12 : 14} strokeWidth={2} />
      <span>{c.label}</span>
    </span>
  );
}

export interface PriorityBadgeProps {
  priority?: Priority | string | null;
  size?: 'sm' | 'md';
}

export function PriorityBadge({ priority, size = 'sm' }: PriorityBadgeProps) {
  const configs: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: LucideIcon }
  > = {
    'Urgent': {
      label: 'Urgent',
      bg: 'bg-status-danger-bg',
      text: 'text-status-danger-text',
      border: 'border-status-danger-border',
      icon: AlertTriangle,
    },
    'High': {
      label: 'High',
      bg: 'bg-status-danger-bg',
      text: 'text-status-danger-text',
      border: 'border-status-danger-border',
      icon: AlertTriangle,
    },
    'Medium': {
      label: 'Medium',
      bg: 'bg-status-warning-bg',
      text: 'text-status-warning-text',
      border: 'border-status-warning-border',
      icon: Clock,
    },
    'Low': {
      label: 'Low',
      bg: 'bg-surface-elevated',
      text: 'text-text-secondary',
      border: 'border-border',
      icon: Circle,
    },
    'No priority': {
      label: 'No priority',
      bg: 'bg-surface',
      text: 'text-text-muted',
      border: 'border-border',
      icon: Minus,
    },
  };

  const key = (!priority || priority === 'None' || priority === 'No priority') ? 'No priority' : priority;
  const c = configs[key] || configs['No priority'];
  const Icon = c.icon;
  const isSm = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded-md whitespace-nowrap ${c.bg} ${c.text} ${c.border} ${
        isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Icon size={isSm ? 11 : 13} strokeWidth={2} />
      <span>{c.label}</span>
    </span>
  );
}

export interface SlaBadgeProps {
  slaInfo?: Partial<SlaInfo> | null;
}

export function SlaBadge({ slaInfo }: SlaBadgeProps) {
  if (!slaInfo || (!slaInfo.isBreached && !slaInfo.isApproaching && !slaInfo.isEscalated)) {
    return null;
  }

  if (slaInfo.isEscalated) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border bg-status-danger-bg text-status-danger-text border-status-danger-border">
        <ShieldAlert size={12} />
        Escalated
      </span>
    );
  }

  if (slaInfo.isBreached) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border bg-status-danger-bg text-status-danger-text border-status-danger-border">
        <AlertTriangle size={11} />
        SLA Breached
      </span>
    );
  }

  if (slaInfo.isApproaching) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border bg-status-warning-bg text-status-warning-text border-status-warning-border">
        <Clock size={11} />
        SLA Risk
      </span>
    );
  }

  return null;
}
