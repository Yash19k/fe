import React from 'react';
import { useApp } from '../../hooks/useApp';
import { StatusBadge, PriorityBadge, SlaBadge, WorkItemTypeBadge } from '../ui/Badge';
import { TaskAssignees } from '../ui/Avatar';
import { getRelativeDateLabel } from '../../domain/businessDays';
import { isTaskBlocked } from '../../domain/dependencyGraph';
import { evaluateTaskSla } from '../../domain/sla';
import { Check, Network, ListTodo, CornerDownRight } from 'lucide-react';
import { WORK_ITEM_TYPES } from '../../domain/workItems';
import { Task } from '../../types';
import {
  getCompletedWorkflowStatus,
  getInitialWorkflowStatus,
  findWorkflowStatus,
  getWorkflowForProject,
  getStatusNameForTask,
  isWorkflowStatusComplete,
} from '../../domain/workflow';

export interface TaskRowProps {
  task: Task;
  gridColsClassName?: string;
  className?: string;
}

export function TaskRow({ task, gridColsClassName, className = '' }: TaskRowProps) {
  const {
    openTaskDrawer,
    changeTaskStatus,
    allUsers,
    tasks,
    workflows,
    currentProject,
    currentWorkflow,
    showToast,
  } = useApp();
  const workflow =
    getWorkflowForProject(workflows, task.projectId) ||
    (currentProject?.id === task.projectId ? currentWorkflow : undefined);

  const isDone = isWorkflowStatusComplete(workflow, task.status);
  const isBlocked = isTaskBlocked(task, tasks, workflow);
  const slaInfo = evaluateTaskSla(task, undefined, workflow);
  const dateInfo = getRelativeDateLabel(task.dueDate);

  // Subtasks list
  const childSubtasks = tasks.filter((t) => t.parentId === task.id && t.type === WORK_ITEM_TYPES.SUBTASK);
  const subtasks = childSubtasks.length > 0 ? childSubtasks : (task.subtasks || []);
  const completedSubtasks = subtasks.filter(
    (subtask: any) =>
      (subtask.status && isWorkflowStatusComplete(workflow, subtask.status)) ||
      (!subtask.status && subtask.completed),
  ).length;

  // Parent work item reference
  const parentTask = task.parentId ? tasks.find((t) => t.id === task.parentId) : null;

  function handleToggleDone(e: React.MouseEvent) {
    e.stopPropagation();
    const targetStatus = isDone
      ? getInitialWorkflowStatus(workflow)
      : getCompletedWorkflowStatus(workflow);
    if (!targetStatus) {
      showToast('The project workflow does not define a target status for this action.', 'error');
      return;
    }
    void changeTaskStatus(task.id, targetStatus.name);
  }

  const defaultGrid = 'grid-cols-[minmax(280px,1fr)_140px_110px_110px_90px_80px]';
  const activeGrid = gridColsClassName || defaultGrid;

  return (
    <div
      onClick={() => openTaskDrawer(task.id)}
      className={`group grid ${activeGrid} gap-3 items-center px-4 py-2.5 border-b border-border/60 hover:bg-surface-hover/70 transition-colors text-xs cursor-pointer select-none ${className}`}
    >
      {/* 1. Task Title (checkbox + type icon + parent link + title + indicators) */}
      <div className="flex items-center gap-2 min-w-0 pr-2 overflow-hidden">
        <button
          type="button"
          onClick={handleToggleDone}
          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
            isDone
              ? 'bg-status-success border-status-success text-white'
              : 'border-border-strong hover:border-text-primary text-transparent'
          }`}
          title={isDone ? 'Mark Incomplete' : 'Mark Done'}
          aria-label={isDone ? 'Mark Incomplete' : 'Mark Done'}
        >
          <Check size={10} strokeWidth={3} />
        </button>

        <div className="shrink-0">
          <WorkItemTypeBadge type={task.type || WORK_ITEM_TYPES.TASK} size="sm" showLabel={false} />
        </div>

        {parentTask && (
          <span
            className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-text-muted truncate max-w-[100px] shrink-0"
            title={`Parent: ${parentTask.title}`}
          >
            <CornerDownRight size={10} className="shrink-0" />
            <span className="truncate">{parentTask.title}</span>
            <span className="text-text-muted">/</span>
          </span>
        )}

        <span
          className={`truncate min-w-0 font-medium ${
            isDone ? 'line-through text-text-muted' : 'text-text-primary'
          }`}
          title={task.title}
        >
          {task.title}
        </span>

        {/* Subtask progress count (only for parent items) */}
        {task.type !== WORK_ITEM_TYPES.SUBTASK && subtasks.length > 0 && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-text-muted bg-surface-elevated border border-border px-1.5 py-0.5 rounded font-mono shrink-0">
            <ListTodo size={10} />
            {completedSubtasks}/{subtasks.length}
          </span>
        )}

        {/* Dependency link indicator */}
        {((task.dependencyIds && task.dependencyIds.length > 0) || isBlocked) && (
          <span
            className={`hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
              isBlocked
                ? 'bg-status-danger-bg text-status-danger-text border border-status-danger-border'
                : 'bg-surface-elevated text-text-muted border border-border'
            }`}
            title={isBlocked ? 'Blocked by predecessor' : 'Has dependencies'}
          >
            <Network size={10} />
            {isBlocked ? 'Blocked' : 'Linked'}
          </span>
        )}

        {/* SLA warning badge */}
        <div className="shrink-0">
          <SlaBadge slaInfo={slaInfo} />
        </div>
      </div>

      {/* 2. Assignee */}
      <div className="flex items-center min-w-0 overflow-hidden">
        <TaskAssignees task={task} allUsers={allUsers} size="xs" max={3} showNameForSingle />
      </div>

      {/* 3. Due Date */}
      <div className="flex items-center min-w-0 overflow-hidden" title={task.dueDate ? dateInfo.label : 'No due date'}>
        <span
          className={`truncate text-xs ${
            !task.dueDate || dateInfo.label === '-'
              ? 'text-text-muted/40 font-mono'
              : dateInfo.isOverdue
                ? 'text-rose-400 font-semibold'
                : dateInfo.isDueSoon
                  ? 'text-amber-400 font-medium'
                  : 'text-text-secondary'
          }`}
        >
          {dateInfo.label}
        </span>
      </div>

      {/* 4. Status Badge */}
      <div className="flex items-center justify-center min-w-0">
        <StatusBadge
          status={task.status}
          label={getStatusNameForTask(workflow, task)}
          color={findWorkflowStatus(workflow, task.status)?.color}
          size="sm"
        />
      </div>

      {/* 5. Priority Badge */}
      <div className="flex items-center min-w-0">
        <PriorityBadge priority={task.priority} size="sm" />
      </div>

      {/* 6. Tags */}
      <div className="flex items-center gap-1 justify-end truncate">
        {task.tags && task.tags.length > 0 ? (
          task.tags.slice(0, 1).map((t) => (
            <span
              key={t}
              className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted truncate max-w-[80px]"
              title={t}
            >
              {t}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-text-muted/40 font-mono">-</span>
        )}
      </div>
    </div>
  );
}
