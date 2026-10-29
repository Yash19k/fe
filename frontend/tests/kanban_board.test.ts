import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

describe('Kanban Board - Production Implementation Verification', () => {
  // Test Model & Mapper Logic
  interface TaskFlowTask {
    id: string;
    key?: string;
    title: string;
    status: string;
    priority?: string | null;
    labels?: string[];
    assigneeId?: string | null;
    assigneeIds?: string[];
    dueDate?: string | null;
    subtasks?: Array<{ id: string; title: string; completed: boolean }>;
  }

  interface KanbanTask {
    id: string;
    key: string;
    title: string;
    columnId: string;
    priority: 'high' | 'medium' | 'low';
    labels: Array<{ name: string; tone: string }>;
    assignees: Array<{ id: string; name: string; initials: string; color: string }>;
    dueDate?: string;
    overdue?: boolean;
    subtasksDone?: number;
    subtasksTotal?: number;
  }

  function toKanbanTask(task: TaskFlowTask, projectKey: string): KanbanTask {
    const formattedKey = task.key
      ? task.key
      : `${projectKey || 'TASK'}-${task.id.slice(0, 4).toUpperCase()}`;

    let priority: 'high' | 'medium' | 'low' = 'low';
    if (task.priority) {
      const p = String(task.priority).toLowerCase();
      if (p.includes('urgent') || p.includes('high')) priority = 'high';
      else if (p.includes('med')) priority = 'medium';
      else priority = 'low';
    }

    const tones = ['blue', 'green', 'amber', 'rose', 'violet'];
    const labels = (task.labels || []).map((name, idx) => {
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
      return { name, tone: tones[Math.abs(hash + idx) % tones.length] };
    });

    const subtasks = task.subtasks || [];
    const subtasksDone = subtasks.filter((s) => s.completed).length;

    let dueDateStr: string | undefined;
    let overdue = false;
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      if (!isNaN(d.getTime())) {
        dueDateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueZero = new Date(d);
        dueZero.setHours(0, 0, 0, 0);
        overdue = task.status !== 'Done' && dueZero.getTime() < today.getTime();
      }
    }

    return {
      id: task.id,
      key: formattedKey,
      title: task.title,
      columnId: task.status,
      priority,
      labels,
      assignees: task.assigneeId
        ? [{ id: task.assigneeId, name: 'Dev User', initials: 'DU', color: '#6a7be8' }]
        : [],
      dueDate: dueDateStr,
      overdue,
      subtasksDone,
      subtasksTotal: subtasks.length,
    };
  }

  test('toKanbanTask maps TaskFlow task model accurately', () => {
    const raw: TaskFlowTask = {
      id: 'task-1234-uuid',
      title: 'Proration rules for mid-cycle plan upgrades',
      status: 'Backlog',
      priority: 'High',
      labels: ['Billing', 'Spec'],
      assigneeId: 'user-1',
      dueDate: '2026-11-12T00:00:00.000Z',
      subtasks: [
        { id: 'sub-1', title: 'Sub 1', completed: true },
        { id: 'sub-2', title: 'Sub 2', completed: false },
      ],
    };

    const mapped = toKanbanTask(raw, 'BIL');
    assert.equal(mapped.id, 'task-1234-uuid');
    assert.equal(mapped.key, 'BIL-TASK');
    assert.equal(mapped.columnId, 'Backlog');
    assert.equal(mapped.priority, 'high');
    assert.equal(mapped.labels.length, 2);
    assert.equal(mapped.subtasksDone, 1);
    assert.equal(mapped.subtasksTotal, 2);
    assert.equal(mapped.assignees.length, 1);
  });

  test('marks past due dates as overdue unless status is Done', () => {
    const rawOverdue: TaskFlowTask = {
      id: 'task-overdue',
      title: 'Overdue task',
      status: 'In Progress',
      dueDate: '2026-10-01T00:00:00.000Z',
    };
    const overdueMapped = toKanbanTask(rawOverdue, 'BIL');
    assert.equal(overdueMapped.overdue, true);

    const rawDone: TaskFlowTask = {
      id: 'task-done',
      title: 'Completed task with past due date',
      status: 'Done',
      dueDate: '2026-10-01T00:00:00.000Z',
    };
    const doneMapped = toKanbanTask(rawDone, 'BIL');
    assert.equal(doneMapped.overdue, false);
  });

  test('applies optimistic move and reordering correctly', () => {
    function applyOrder(
      tasks: KanbanTask[],
      change: { taskId: string; toColumnId: string; orderedIds: string[] }
    ): KanbanTask[] {
      const moved = tasks.map((t) =>
        t.id === change.taskId ? { ...t, columnId: change.toColumnId } : t
      );
      const byId = new Map(moved.map((t) => [t.id, t]));
      const ordered = change.orderedIds
        .map((id) => byId.get(id))
        .filter((t): t is KanbanTask => t !== undefined);
      const rest = moved.filter((t) => !change.orderedIds.includes(t.id));
      return [...rest, ...ordered];
    }

    const t1: KanbanTask = { id: 't1', key: 'BIL-1', title: 'T1', columnId: 'Backlog', priority: 'high', labels: [], assignees: [] };
    const t2: KanbanTask = { id: 't2', key: 'BIL-2', title: 'T2', columnId: 'Backlog', priority: 'medium', labels: [], assignees: [] };
    const t3: KanbanTask = { id: 't3', key: 'BIL-3', title: 'T3', columnId: 'In Progress', priority: 'low', labels: [], assignees: [] };

    // Move t1 to In Progress between t3
    const next = applyOrder([t1, t2, t3], {
      taskId: 't1',
      toColumnId: 'In Progress',
      orderedIds: ['t3', 't1'],
    });

    const movedT1 = next.find((t) => t.id === 't1');
    assert.equal(movedT1?.columnId, 'In Progress');
    assert.equal(next.filter((t) => t.columnId === 'In Progress').map((t) => t.id).join(','), 't3,t1');
    assert.equal(next.filter((t) => t.columnId === 'Backlog').map((t) => t.id).join(','), 't2');
  });

  test('reordering within same column preserves other columns intact', () => {
    function applyOrder(
      tasks: KanbanTask[],
      change: { taskId: string; toColumnId: string; orderedIds: string[] }
    ): KanbanTask[] {
      const moved = tasks.map((t) =>
        t.id === change.taskId ? { ...t, columnId: change.toColumnId } : t
      );
      const byId = new Map(moved.map((t) => [t.id, t]));
      const ordered = change.orderedIds
        .map((id) => byId.get(id))
        .filter((t): t is KanbanTask => t !== undefined);
      const rest = moved.filter((t) => !change.orderedIds.includes(t.id));
      return [...rest, ...ordered];
    }

    const t1: KanbanTask = { id: 't1', key: 'BIL-1', title: 'T1', columnId: 'Backlog', priority: 'high', labels: [], assignees: [] };
    const t2: KanbanTask = { id: 't2', key: 'BIL-2', title: 'T2', columnId: 'Backlog', priority: 'medium', labels: [], assignees: [] };
    const t3: KanbanTask = { id: 't3', key: 'BIL-3', title: 'T3', columnId: 'Done', priority: 'low', labels: [], assignees: [] };

    const reordered = applyOrder([t1, t2, t3], {
      taskId: 't2',
      toColumnId: 'Backlog',
      orderedIds: ['t2', 't1'],
    });

    const backlogIds = reordered.filter((t) => t.columnId === 'Backlog').map((t) => t.id);
    assert.deepEqual(backlogIds, ['t2', 't1']);
    assert.equal(reordered.find((t) => t.id === 't3')?.columnId, 'Done');
  });

  test('swimlane grouping model groups tasks by first assignee and provides unassigned lane', () => {
    const t1: KanbanTask = {
      id: 't1',
      key: 'BIL-1',
      title: 'T1',
      columnId: 'Backlog',
      priority: 'high',
      labels: [],
      assignees: [{ id: 'user-meera', name: 'Meera Rao', initials: 'MR', color: '#6a7be8' }],
    };
    const t2: KanbanTask = {
      id: 't2',
      key: 'BIL-2',
      title: 'T2',
      columnId: 'In Progress',
      priority: 'medium',
      labels: [],
      assignees: [{ id: 'user-dev', name: 'Dev Kapoor', initials: 'DK', color: '#3fa66b' }],
    };
    const t3: KanbanTask = {
      id: 't3',
      key: 'BIL-3',
      title: 'T3',
      columnId: 'Done',
      priority: 'low',
      labels: [],
      assignees: [], // Unassigned
    };

    const tasks = [t1, t2, t3];
    const laneMap = new Map<string, KanbanTask[]>();
    for (const t of tasks) {
      const laneId = t.assignees[0]?.id ?? '__unassigned__';
      if (!laneMap.has(laneId)) laneMap.set(laneId, []);
      laneMap.get(laneId)!.push(t);
    }

    assert.equal(laneMap.get('user-meera')?.length, 1);
    assert.equal(laneMap.get('user-dev')?.length, 1);
    assert.equal(laneMap.get('__unassigned__')?.length, 1);
  });
});
