import React from 'react';
import { useApp } from '../../hooks/useApp';
import { PriorityBadge, SlaBadge, WorkItemTypeBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { getRelativeDateLabel } from '../../domain/businessDays';
import { isTaskBlocked } from '../../domain/dependencyGraph';
import { evaluateTaskSla } from '../../domain/sla';
import { Network, ListTodo, Calendar, CornerDownRight } from 'lucide-react';
import { WORK_ITEM_TYPES } from '../../domain/workItems';
import { Task } from '../../types';

export interface TaskCardProps {
  task: Task;
  onDragStart: (e: React.DragEvent, id: string) => void;
}

export function TaskCard({ task, onDragStart }: TaskCardProps) {
  const { openTaskDrawer, changeTaskStatus, allUsers, currentWorkflow, tasks } = useApp();

  const assignee = allUsers.find((u) => u.id === task.assigneeId);
  const isBlocked = isTaskBlocked(task, tasks);
  const slaInfo = evaluateTaskSla(task);
  const dateInfo = getRelativeDateLabel(task.dueDate);

  // Find parent task if item has a parent
  const parentTask = task.parentId ? tasks.find((t) => t.id === task.parentId) : null;

  // Subtasks list
  const childSubtasks = tasks.filter((t) => t.parentId === task.id && t.type === WORK_ITEM_TYPES.SUBTASK);
  const subtasks = childSubtasks.length > 0 ? childSubtasks : (task.subtasks || []);
  const completedSubtasks = subtasks.filter((s: any) => s.status === 'Done' || s.completed).length;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => openTaskDrawer(task.id)}
      className="p-3 rounded-lg bg-surface border border-border hover:border-border-strong hover:bg-surface-hover/80 transition-all cursor-grab active:cursor-grabbing shadow-xs select-none space-y-2 group"
    >
      {/* Top badges: Work Item Type, Priority & SLA */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <WorkItemTypeBadge type={task.type || WORK_ITEM_TYPES.TASK} size="sm" />
          <PriorityBadge priority={task.priority} size="sm" />
        </div>
        <div className="flex items-center gap-1">
          <SlaBadge slaInfo={slaInfo} />
          {isBlocked && (
            <span
              className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1"
              title="Blocked by incomplete predecessor"
            >
              <Network size={10} />
              Blocked
            </span>
          )}
        </div>
      </div>

      {/* Parent indicator if subtask or child */}
      {parentTask && (
        <div className="flex items-center gap-1 text-[10px] text-text-muted truncate">
          <CornerDownRight size={10} className="flex-shrink-0" />
          <span className="truncate hover:text-text-primary" title={`Parent: ${parentTask.title}`}>
            {parentTask.title}
          </span>
        </div>
      )}

      {/* Title */}
      <h4 className="text-xs font-semibold text-text-primary leading-snug line-clamp-2">
        {task.title}
      </h4>

      {/* Bottom metadata row: Due date, Subtasks, Assignee */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-text-muted">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span
              className={`flex items-center gap-1 ${
                dateInfo.isOverdue
                  ? 'text-rose-400 font-semibold'
                  : dateInfo.isDueSoon
                    ? 'text-amber-400 font-medium'
                    : 'text-text-muted'
              }`}
            >
              <Calendar size={11} />
              {dateInfo.label}
            </span>
          )}

          {task.type !== WORK_ITEM_TYPES.SUBTASK && subtasks.length > 0 && (
            <span className="flex items-center gap-1 font-mono">
              <ListTodo size={11} />
              {completedSubtasks}/{subtasks.length}
            </span>
          )}
        </div>

        <Avatar user={assignee} size="xs" />
      </div>

      {/* Accessible status changer dropdown (hidden until hover or focus) */}
      <div
        className="opacity-0 group-hover:opacity-100 transition-opacity pt-1 flex justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        <select
          value={task.status}
          onChange={(e) => changeTaskStatus(task.id, e.target.value)}
          className="text-[10px] bg-surface-elevated border border-border rounded px-1.5 py-0.5 text-text-secondary focus:outline-none"
          title="Move status"
        >
          {currentWorkflow?.statuses?.map((st) => (
            <option key={st.id} value={st.name}>
              Move to: {st.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
