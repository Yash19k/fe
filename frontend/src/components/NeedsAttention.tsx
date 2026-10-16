import React from 'react';
import { AlertTriangle, Clock, Circle, ArrowRight, Minus } from 'lucide-react';
import { formatDueDate } from '../data/appDefaults';

export interface NeedsAttentionTask {
  id: string | number;
  title: string;
  project?: string;
  priority: string;
  status: string;
  dueDate: string;
  assignee: {
    name: string;
    initials: string;
    avatarColor?: string;
  };
}

export interface NeedsAttentionProps {
  tasks: NeedsAttentionTask[];
}

export default function NeedsAttention({ tasks }: NeedsAttentionProps) {
  if (tasks.length === 0) {
    return (
      <section>
        <SectionHeader />
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <p className="text-sm text-text-secondary">No tasks need attention right now.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader count={tasks.length} />
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {/* Column headers — hidden on small screens */}
        <div className="hidden md:grid md:grid-cols-[1fr_100px_110px_100px_44px] gap-3 px-5 py-2.5 border-b border-border-light bg-canvas/60 text-xs font-medium text-text-tertiary uppercase tracking-wider">
          <span>Task</span>
          <span>Priority</span>
          <span>Status</span>
          <span>Due</span>
          <span />
        </div>
        <div role="list">
          {tasks.map((task, i) => (
            <TaskRow key={task.id} task={task} isLast={i === tasks.length - 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ count }: { count?: number }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <h2 className="text-base font-semibold text-text-primary">
          Needs Attention
          {count != null && (
            <span className="ml-2 text-xs font-medium text-text-tertiary bg-surface-active rounded-full px-2 py-0.5">
              {count}
            </span>
          )}
        </h2>
        <p className="text-sm text-text-secondary mt-0.5">Tasks that may require your attention.</p>
      </div>
    </div>
  );
}

function TaskRow({ task, isLast }: { task: NeedsAttentionTask; isLast: boolean }) {
  const due = formatDueDate(task.dueDate);

  return (
    <div
      role="listitem"
      tabIndex={0}
      className={`
        group grid grid-cols-1 md:grid-cols-[1fr_100px_110px_100px_44px] gap-2 md:gap-3 items-center
        px-4 md:px-5 py-3.5
        hover:bg-surface-hover focus-visible:bg-surface-hover cursor-pointer
        transition-colors duration-75
        ${!isLast ? 'border-b border-border-light' : ''}
      `}
    >
      {/* Task info */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
          style={{ backgroundColor: task.assignee.avatarColor }}
          title={task.assignee.name}
          aria-label={`Assigned to ${task.assignee.name}`}
        >
          {task.assignee.initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {task.title}
          </p>
          <p className="text-xs text-text-tertiary truncate md:mt-0.5">
            {task.project}
          </p>
        </div>
      </div>

      {/* Priority */}
      <div className="flex items-center md:justify-start">
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Status */}
      <div className="flex items-center md:justify-start">
        <StatusBadge status={task.status} />
      </div>

      {/* Due date */}
      <div className="flex items-center">
        <span
          className={`text-sm ${
            due.isOverdue
              ? 'text-status-danger font-medium'
              : due.isDueSoon
                ? 'text-status-warning-text font-medium'
                : 'text-text-secondary'
          }`}
        >
          {due.text}
        </span>
      </div>

      {/* Arrow */}
      <div className="hidden md:flex justify-end">
        <ArrowRight
          size={14}
          className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ComponentType<{ size?: number }> }> = {
    [PRIORITY.HIGH]: { label: 'High', className: 'text-status-danger-text bg-status-danger-bg', icon: AlertTriangle },
    [PRIORITY.MEDIUM]: { label: 'Medium', className: 'text-status-warning-text bg-status-warning-bg', icon: Minus },
    [PRIORITY.LOW]: { label: 'Low', className: 'text-text-secondary bg-surface-active', icon: Minus },
  };
  const c = config[priority] || config[PRIORITY.MEDIUM];
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${c.className}`}>
      <Icon size={11} />
      {c.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; icon: React.ComponentType<{ size?: number }> }> = {
    [STATUS.TODO]: { className: 'text-status-neutral-text bg-status-neutral-bg', icon: Circle },
    [STATUS.IN_PROGRESS]: { className: 'text-status-info-text bg-status-info-bg', icon: Clock },
    [STATUS.IN_REVIEW]: { className: 'text-brand-700 bg-brand-50', icon: Clock },
    [STATUS.BLOCKED]: { className: 'text-status-danger-text bg-status-danger-bg', icon: AlertTriangle },
    [STATUS.DONE]: { className: 'text-status-success-text bg-status-success-bg', icon: Circle },
  };
  const c = config[status] || config[STATUS.TODO];
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${c.className}`}>
      <Icon size={11} />
      {status}
    </span>
  );
}
