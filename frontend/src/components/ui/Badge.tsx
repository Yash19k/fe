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
      bg: 'bg-purple-500/15',
      text: 'text-purple-300',
      border: 'border-purple-500/30',
      icon: Layers,
    },
    [WORK_ITEM_TYPES.STORY]: {
      label: 'Story',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      icon: BookOpen,
    },
    [WORK_ITEM_TYPES.TASK]: {
      label: 'Task',
      bg: 'bg-blue-500/15',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      icon: CheckSquare,
    },
    [WORK_ITEM_TYPES.SUBTASK]: {
      label: 'Subtask',
      bg: 'bg-zinc-800/70',
      text: 'text-zinc-400',
      border: 'border-zinc-700/50',
      icon: CornerDownRight,
    },
    [WORK_ITEM_TYPES.BUG]: {
      label: 'Bug',
      bg: 'bg-rose-500/15',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
      icon: Bug,
    },
  };

  const c = configs[type] || configs[WORK_ITEM_TYPES.TASK];
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
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      icon: CheckCircle2,
    },
    'In Progress': {
      label: 'In Progress',
      bg: 'bg-blue-500/15',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      icon: Clock,
    },
    'In Review': {
      label: 'In Review',
      bg: 'bg-purple-500/15',
      text: 'text-purple-300',
      border: 'border-purple-500/30',
      icon: Clock,
    },
    'Testing / QA': {
      label: 'Testing / QA',
      bg: 'bg-cyan-500/15',
      text: 'text-cyan-400',
      border: 'border-cyan-500/30',
      icon: CheckCircle,
    },
    'Blocked': {
      label: 'Blocked',
      bg: 'bg-rose-500/15',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
      icon: Ban,
    },
    'On Hold': {
      label: 'On Hold',
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      icon: PauseCircle,
    },
    'Backlog': {
      label: 'Backlog',
      bg: 'bg-zinc-800/60',
      text: 'text-zinc-400',
      border: 'border-zinc-700/40',
      icon: Circle,
    },
    'To Do': {
      label: 'Backlog',
      bg: 'bg-zinc-800/60',
      text: 'text-zinc-400',
      border: 'border-zinc-700/40',
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
    'High': {
      label: 'High',
      bg: 'bg-rose-500/15',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
      icon: AlertTriangle,
    },
    'Medium': {
      label: 'Medium',
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      icon: Clock,
    },
    'Low': {
      label: 'Low',
      bg: 'bg-zinc-800/80',
      text: 'text-zinc-400',
      border: 'border-zinc-700/50',
      icon: Circle,
    },
    'No priority': {
      label: 'No priority',
      bg: 'bg-zinc-800/40',
      text: 'text-zinc-400',
      border: 'border-zinc-700/40',
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
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border bg-rose-500/20 text-rose-300 border-rose-500/40">
        <ShieldAlert size={12} />
        Escalated
      </span>
    );
  }

  if (slaInfo.isBreached) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border bg-rose-500/15 text-rose-400 border-rose-500/30">
        <AlertTriangle size={11} />
        SLA Breached
      </span>
    );
  }

  if (slaInfo.isApproaching) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30">
        <Clock size={11} />
        SLA Risk
      </span>
    );
  }

  return null;
}
