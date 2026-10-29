import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../hooks/useApp';
import { hasPermission, PERMISSIONS } from '../../../domain/permissions';
import { resolveTaskAssignees } from '../../../components/ui/Avatar';
import { WORK_ITEM_TYPES } from '../../../domain/workItems';
import type { Task, User } from '../../../types';
import {
  KanbanBoard,
  type KanbanAssignee,
  type KanbanColumnDef,
  type KanbanLabel,
  type KanbanLabelTone,
  type KanbanPriority,
  type KanbanTask,
  type TaskMoveEvent,
  type TaskReorderEvent,
} from './KanbanBoard';

const DEFAULT_STANDARD_STATUSES: KanbanColumnDef[] = [
  { id: 'Backlog', name: 'Backlog', color: 'var(--kb-s-backlog)' },
  { id: 'In Progress', name: 'In Progress', color: 'var(--kb-s-progress)' },
  { id: 'In Review', name: 'In Review', color: 'var(--kb-s-review)' },
  { id: 'Done', name: 'Done', color: 'var(--kb-s-done)' },
];

const TONE_PALETTE: KanbanLabelTone[] = ['blue', 'green', 'amber', 'rose', 'violet'];
const AVATAR_COLOR_PALETTE = ['#6a7be8', '#3fa66b', '#d9738a', '#d08a2e', '#8b5cf6', '#06b6d4'];

/** Single authoritative mapper from TaskFlow domain Task to KanbanTask */
function toKanbanTask(
  task: Task,
  projectKey: string,
  allUsers: User[],
  allTasks: Task[],
): KanbanTask {
  const formattedKey = task.key
    ? task.key
    : `${projectKey || 'TASK'}-${task.id.slice(0, 4).toUpperCase()}`;

  // Priority mapping
  let priority: KanbanPriority = 'low';
  if (task.priority) {
    const p = String(task.priority).toLowerCase();
    if (p.includes('urgent') || p.includes('high')) {
      priority = 'high';
    } else if (p.includes('med')) {
      priority = 'medium';
    } else {
      priority = 'low';
    }
  }

  // Label tones
  const labels: KanbanLabel[] = (task.labels || []).map((lbl, idx) => {
    const name = typeof lbl === 'string' ? lbl : ((lbl as any)?.name ?? 'Label');
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const tone = TONE_PALETTE[Math.abs(hash + idx) % TONE_PALETTE.length];
    return { name, tone };
  });

  // Assignees
  const resolvedUsers = resolveTaskAssignees(task, allUsers);
  const assignees: KanbanAssignee[] = resolvedUsers.map((u, i) => {
    const name = u.displayName || u.fullName || u.name || u.email || 'User';
    const initials =
      u.initials ||
      (name.includes(' ')
        ? name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
        : name.slice(0, 2).toUpperCase());
    const color = u.color || u.avatarColor || AVATAR_COLOR_PALETTE[i % AVATAR_COLOR_PALETTE.length];
    return {
      id: u.id,
      name,
      initials,
      color,
    };
  });

  // Due date & overdue check
  let dueDateStr: string | undefined;
  let overdue = false;
  if (task.dueDate) {
    const d = new Date(task.dueDate);
    if (!isNaN(d.getTime())) {
      dueDateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDateZero = new Date(d);
      dueDateZero.setHours(0, 0, 0, 0);
      overdue = task.status !== 'Done' && dueDateZero.getTime() < today.getTime();
    }
  }

  // Subtasks
  const childSubtasks = allTasks.filter(
    (t) => t.parentId === task.id && t.type === WORK_ITEM_TYPES.SUBTASK,
  );
  const subtasks = childSubtasks.length > 0 ? childSubtasks : task.subtasks || [];
  const subtasksDone = subtasks.filter((s: any) => s.status === 'Done' || s.completed).length;
  const subtasksTotal = subtasks.length;

  return {
    id: task.id,
    key: formattedKey,
    title: task.title,
    columnId: task.status,
    priority,
    labels,
    assignees,
    dueDate: dueDateStr,
    overdue,
    subtasksDone,
    subtasksTotal,
  };
}

/** Applies a move or reorder to a flat task list */
function applyOrder(
  tasks: KanbanTask[],
  change: { taskId: string; toColumnId: string; orderedIds: string[] },
): KanbanTask[] {
  const moved = tasks.map((t) =>
    t.id === change.taskId ? { ...t, columnId: change.toColumnId } : t,
  );
  const byId = new Map(moved.map((t) => [t.id, t]));
  const ordered = change.orderedIds
    .map((id) => byId.get(id))
    .filter((t): t is KanbanTask => t !== undefined);
  const rest = moved.filter((t) => !change.orderedIds.includes(t.id));
  return [...rest, ...ordered];
}

interface TaskFlowKanbanPageProps {
  onOpenCreateTask?: () => void;
}

export function TaskFlowKanbanPage({ onOpenCreateTask }: TaskFlowKanbanPageProps) {
  const {
    currentProject,
    currentWorkflow,
    projectTasks,
    tasks: allTasks,
    allUsers,
    currentUser,
    changeTaskStatus,
    openTaskDrawer,
    showToast,
    isLoadingProjectData,
    projectDataError,
    reloadProjectData,
  } = useApp();

  const projectKey = currentProject?.projectKey || 'BIL';
  const projectTitle = currentProject?.name || 'Board';

  const canEdit = currentUser
    ? hasPermission(currentUser.role, PERMISSIONS.UPDATE_TASK_STATUS)
    : false;

  // Resolve dynamic status columns
  const columns: KanbanColumnDef[] = useMemo(() => {
    const workflowStatuses = currentWorkflow?.statuses || [];
    if (workflowStatuses.length === 0) {
      return DEFAULT_STANDARD_STATUSES;
    }

    if (workflowStatuses.length <= 4) {
      return workflowStatuses.map((s) => ({
        id: s.name,
        name: s.name,
        color: s.color || 'var(--kb-s-backlog)',
      }));
    }

    // If more than 4 statuses exist, prioritize the 4 standard ones, plus any populated statuses
    const activeStatusSet = new Set(projectTasks.map((t) => t.status));
    const coreNames = ['Backlog', 'In Progress', 'In Review', 'Done'];
    const chosenStatuses = workflowStatuses.filter(
      (s) => coreNames.includes(s.name) || activeStatusSet.has(s.name),
    );

    return (chosenStatuses.length > 0 ? chosenStatuses : workflowStatuses.slice(0, 4)).map((s) => ({
      id: s.name,
      name: s.name,
      color: s.color || 'var(--kb-s-backlog)',
    }));
  }, [currentWorkflow, projectTasks]);

  const doneColumnId = useMemo(() => {
    const found = columns.find((c) => c.name.toLowerCase() === 'done');
    return found ? found.id : columns[columns.length - 1]?.id ?? 'Done';
  }, [columns]);

  // Local optimistic task state synchronized with incoming projectTasks
  const [tasks, setTasks] = useState<KanbanTask[]>(() =>
    projectTasks.map((t) => toKanbanTask(t, projectKey, allUsers, allTasks)),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTasks(projectTasks.map((t) => toKanbanTask(t, projectKey, allUsers, allTasks)));
  }, [projectTasks, projectKey, allUsers, allTasks]);

  const commit = useCallback(
    async (change: { taskId: string; toColumnId: string; orderedIds: string[] }) => {
      const previous = tasks;
      // 1. Immediate optimistic UI update
      setTasks((current) => applyOrder(current, change));

      try {
        // 2. Call TaskFlow status mutation
        const success = changeTaskStatus(change.taskId, change.toColumnId);
        if (!success) {
          throw new Error('Status transition is not allowed by workflow or permissions.');
        }
        setError(null);
      } catch (err: any) {
        // 3. Rollback immediately on failure
        setTasks(previous);
        const msg = err?.message || 'Could not update task status. Restored previous board state.';
        setError(msg);
        showToast(msg, 'error');
      }
    },
    [tasks, changeTaskStatus, showToast],
  );

  const handleMove = useCallback(
    (e: TaskMoveEvent) => {
      void commit({
        taskId: e.taskId,
        toColumnId: e.toColumnId,
        orderedIds: e.orderedIds,
      });
    },
    [commit],
  );

  const handleReorder = useCallback(
    (e: TaskReorderEvent) => {
      void commit({
        taskId: e.taskId,
        toColumnId: e.columnId,
        orderedIds: e.orderedIds,
      });
    },
    [commit],
  );

  return (
    <KanbanBoard
      title={projectTitle}
      projectKey={projectKey}
      columns={columns}
      tasks={tasks}
      doneColumnId={doneColumnId}
      isLoading={isLoadingProjectData}
      error={error || projectDataError}
      onRetry={reloadProjectData}
      readOnly={!canEdit}
      onTaskMove={handleMove}
      onTaskReorder={handleReorder}
      onTaskClick={(task) => openTaskDrawer(task.id)}
      onOpenCreateTask={onOpenCreateTask}
    />
  );
}
