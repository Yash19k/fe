import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../hooks/useApp';
import { hasPermission, PERMISSIONS } from '../../../domain/permissions';
import {
  findWorkflowStatus,
  getWorkflowColumns,
  isWorkflowStatusComplete,
} from '../../../domain/workflow';
import { resolveTaskAssignees } from '../../../components/ui/Avatar';
import { WORK_ITEM_TYPES } from '../../../domain/workItems';
import { formatShortDate, getRelativeDateLabel } from '../../../domain/businessDays';
import type { Task, User } from '../../../types';
import { restoreTaskPosition } from './boardState';
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

const TONE_PALETTE: KanbanLabelTone[] = ['blue', 'green', 'amber', 'rose', 'violet'];
const AVATAR_COLOR_PALETTE = ['#6a7be8', '#3fa66b', '#d9738a', '#d08a2e', '#8b5cf6', '#06b6d4'];

/** Single authoritative mapper from TaskFlow domain Task to KanbanTask */
function toKanbanTask(
  task: Task,
  projectKey: string,
  allUsers: User[],
  allTasks: Task[],
  currentWorkflow: ReturnType<typeof useApp>['currentWorkflow'],
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
  const dueDateStr = formatShortDate(task.dueDate);
  const overdue = Boolean(task.dueDate) &&
    getRelativeDateLabel(task.dueDate).isOverdue &&
    !isWorkflowStatusComplete(currentWorkflow, task.status);

  // Subtasks
  const childSubtasks = allTasks.filter(
    (t) => t.parentId === task.id && t.type === WORK_ITEM_TYPES.SUBTASK,
  );
  const subtasks = childSubtasks.length > 0 ? childSubtasks : task.subtasks || [];
  const subtasksDone = subtasks.filter(
    (subtask: any) =>
      (subtask.status && isWorkflowStatusComplete(currentWorkflow, subtask.status)) ||
      (!subtask.status && subtask.completed),
  ).length;
  const subtasksTotal = subtasks.length;

  return {
    id: task.id,
    key: formattedKey,
    title: task.title,
    columnId: findWorkflowStatus(currentWorkflow, task.status)?.id || `legacy:${task.status}`,
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
    currentWorkflowLoading,
    currentWorkflowError,
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
    return getWorkflowColumns(currentWorkflow, projectTasks).map((column) => ({
      id: column.id,
      name: column.name,
      color: column.color,
    }));
  }, [currentWorkflow, projectTasks]);

  const doneColumnId = useMemo(() => {
    return currentWorkflow?.statuses.find((status) =>
      isWorkflowStatusComplete(currentWorkflow, status.name),
    )?.id;
  }, [currentWorkflow]);

  // Local optimistic task state synchronized with incoming projectTasks
  const [tasks, setTasks] = useState<KanbanTask[]>(() =>
    projectTasks.map((t) => toKanbanTask(t, projectKey, allUsers, allTasks, currentWorkflow)),
  );
  const pendingMoves = useRef(new Set<string>());

  useEffect(() => {
    setTasks(projectTasks.map((t) => toKanbanTask(t, projectKey, allUsers, allTasks, currentWorkflow)));
  }, [projectTasks, projectKey, allUsers, allTasks, currentWorkflow]);

  const commit = useCallback(
    async (change: {
      taskId: string;
      fromColumnId: string;
      toColumnId: string;
      orderedIds: string[];
    }) => {
      if (change.fromColumnId === change.toColumnId) {
        setTasks((current) => applyOrder(current, change));
        return;
      }

      const targetStatus = currentWorkflow?.statuses.find(
        (status) => status.id === change.toColumnId,
      );
      const task = projectTasks.find((item) => item.id === change.taskId);
      if (!targetStatus || !task || !findWorkflowStatus(currentWorkflow, task.status)) {
        showToast('This task status is not part of the current project workflow.', 'error');
        return;
      }
      if (pendingMoves.current.has(change.taskId)) return;

      const previous = tasks;
      pendingMoves.current.add(change.taskId);
      // 1. Immediate optimistic UI update
      setTasks((current) => applyOrder(current, change));

      try {
        // 2. Call TaskFlow status mutation
        const success = await changeTaskStatus(change.taskId, targetStatus.name);
        if (!success) {
          setTasks((current) => restoreTaskPosition(current, previous, change.taskId));
          return;
        }
      } catch (err: any) {
        setTasks((current) => restoreTaskPosition(current, previous, change.taskId));
        showToast(
          err?.message || 'Cannot move this task to the selected status. Check the workflow permissions.',
          'error',
        );
      } finally {
        pendingMoves.current.delete(change.taskId);
      }
    },
    [tasks, projectTasks, currentWorkflow, changeTaskStatus, showToast],
  );

  const handleMove = useCallback(
    (e: TaskMoveEvent) => {
      void commit({
        taskId: e.taskId,
        fromColumnId: e.fromColumnId,
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
        fromColumnId: e.columnId,
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
      isLoading={isLoadingProjectData || currentWorkflowLoading}
      error={currentWorkflowError || projectDataError}
      onRetry={reloadProjectData}
      readOnly={!canEdit}
      onTaskMove={handleMove}
      onTaskReorder={handleReorder}
      onTaskClick={(task) => openTaskDrawer(task.id)}
      onOpenCreateTask={onOpenCreateTask}
    />
  );
}
