import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNewDependency,
} from '../src/domain/dependencyGraph.ts';
import {
  calculateScheduleImpact,
  applyScheduleChanges,
} from '../src/domain/scheduling.ts';
import {
  addBusinessDays,
  diffBusinessDays,
  isWeekend,
} from '../src/domain/businessDays.ts';
import { Task } from '../src/types/index.ts';

describe('Dependency Graph & Cycle Detection Tests', () => {
  const baseTasks: Task[] = [
    {
      id: 'task-a',
      title: 'Design System',
      projectId: 'proj-1',
      type: 'Task',
      status: 'Done',
      startDate: '2026-10-12',
      dueDate: '2026-10-14',
      dependencyIds: [],
    } as unknown as Task,
    {
      id: 'task-b',
      title: 'Build API',
      projectId: 'proj-1',
      type: 'Task',
      status: 'In Progress',
      startDate: '2026-10-13',
      dueDate: '2026-10-15', // Thursday
      dependencyIds: ['task-a'],
    } as unknown as Task,
    {
      id: 'task-c',
      title: 'Connect Frontend',
      projectId: 'proj-1',
      type: 'Task',
      status: 'Backlog',
      startDate: '2026-10-16', // Friday
      dueDate: '2026-10-16', // Friday
      dependencyIds: ['task-b'],
    } as unknown as Task,
    {
      id: 'task-d',
      title: 'End-to-End QA',
      projectId: 'proj-1',
      type: 'Task',
      status: 'Backlog',
      startDate: '2026-10-19', // Monday
      dueDate: '2026-10-20', // Tuesday
      dependencyIds: ['task-c'],
    } as unknown as Task,
  ];

  it('rejects self-dependencies', () => {
    const result = validateNewDependency('task-b', 'task-b', baseTasks);
    assert.equal(result.isValid, false);
    assert.match(result.reason!, /cannot depend on itself/i);
  });

  it('rejects nonexistent tasks', () => {
    const result = validateNewDependency('unknown-1', 'task-b', baseTasks);
    assert.equal(result.isValid, false);
    assert.match(result.reason!, /must exist/i);
  });

  it('rejects duplicate dependencies', () => {
    // task-c already depends on task-b
    const result = validateNewDependency('task-b', 'task-c', baseTasks);
    assert.equal(result.isValid, false);
    assert.match(result.reason!, /already depends on/i);
  });

  it('detects simple 2-node cycle and reports cycle path', () => {
    // task-c depends on task-b. Trying to make task-b depend on task-c creates a cycle.
    const result = validateNewDependency('task-c', 'task-b', baseTasks);
    assert.equal(result.isValid, false);
    assert.equal(result.isCycle, true);
    assert.ok(result.cyclePathIds);
    assert.deepEqual(result.cyclePathIds, ['task-b', 'task-c', 'task-b']);
    assert.match(result.reason!, /Circular dependency detected/i);
  });

  it('detects multi-node transitive cycle (task-d -> task-b)', () => {
    // Existing chain: task-b -> task-c -> task-d
    // Trying to add predecessor task-d to successor task-b closes the loop: b -> c -> d -> b
    const result = validateNewDependency('task-d', 'task-b', baseTasks);
    assert.equal(result.isValid, false);
    assert.equal(result.isCycle, true);
    assert.deepEqual(result.cyclePathIds, ['task-b', 'task-c', 'task-d', 'task-b']);
    assert.match(result.reason!, /Build API → Connect Frontend → End-to-End QA → Build API/i);
  });

  it('allows valid independent dependency', () => {
    // task-a -> task-d is valid (adding another predecessor to task-d without cycle)
    const result = validateNewDependency('task-a', 'task-d', baseTasks);
    assert.equal(result.isValid, true);
    assert.equal(result.isCycle, undefined);
  });
});

describe('Business Day & Auto-Scheduling Engine Tests', () => {
  it('correctly identifies weekends and business days', () => {
    assert.equal(isWeekend('2026-10-16'), false); // Friday
    assert.equal(isWeekend('2026-10-17'), true); // Saturday
    assert.equal(isWeekend('2026-10-18'), true); // Sunday
    assert.equal(isWeekend('2026-10-19'), false); // Monday
  });

  it('skips weekends when adding business days from Friday', () => {
    // Friday + 1 business day = Monday
    assert.equal(addBusinessDays('2026-10-16', 1), '2026-10-19');
    // Friday + 2 business days = Tuesday (skipping Saturday and Sunday)
    assert.equal(addBusinessDays('2026-10-16', 2), '2026-10-20');
  });

  it('calculates correct business day diff across weekends', () => {
    // Friday 2026-10-16 to Tuesday 2026-10-20 includes Friday, Monday, Tuesday = 3 days
    assert.equal(diffBusinessDays('2026-10-16', '2026-10-20'), 3);
  });

  it('cascades delay: moving Thursday predecessor to Monday shifts Friday successor to Tuesday', () => {
    const tasks: Task[] = [
      {
        id: 'pred-1',
        title: 'Build API',
        projectId: 'proj-1',
        type: 'Task',
        status: 'In Progress',
        startDate: '2026-10-14',
        dueDate: '2026-10-15', // Thursday
        dependencyIds: [],
      } as unknown as Task,
      {
        id: 'succ-1',
        title: 'Connect frontend',
        projectId: 'proj-1',
        type: 'Task',
        status: 'Backlog',
        startDate: '2026-10-16', // Friday
        dueDate: '2026-10-16', // Friday (1 business day duration)
        dependencyIds: ['pred-1'],
      } as unknown as Task,
    ];

    // Delay predecessor from Thursday 2026-10-15 by 2 business days to Monday 2026-10-19
    const report = calculateScheduleImpact('pred-1', '2026-10-19', tasks);

    assert.equal(report.canApply, true);
    assert.equal(report.taskId, 'pred-1');
    assert.equal(report.newDueDate, '2026-10-19'); // Monday
    assert.equal(report.affectedTasks.length, 1);

    const affectedSucc = report.affectedTasks[0];
    assert.equal(affectedSucc.taskId, 'succ-1');
    assert.equal(affectedSucc.oldStartDate, '2026-10-16'); // Friday
    assert.equal(affectedSucc.oldDueDate, '2026-10-16'); // Friday
    assert.equal(affectedSucc.newStartDate, '2026-10-20'); // Tuesday (skipping weekend Sat/Sun)
    assert.equal(affectedSucc.newDueDate, '2026-10-20'); // Tuesday (preserving 1 day duration)
  });

  it('propagates through multi-tier downstream chains (A -> B -> C)', () => {
    const tasks: Task[] = [
      {
        id: 'task-1',
        title: 'Database Schema',
        projectId: 'proj-1',
        type: 'Task',
        status: 'In Progress',
        startDate: '2026-10-14',
        dueDate: '2026-10-15', // Thursday
        dependencyIds: [],
      } as unknown as Task,
      {
        id: 'task-2',
        title: 'API Endpoints',
        projectId: 'proj-1',
        type: 'Task',
        status: 'Backlog',
        startDate: '2026-10-16', // Friday
        dueDate: '2026-10-16', // Friday
        dependencyIds: ['task-1'],
      } as unknown as Task,
      {
        id: 'task-3',
        title: 'UI Integration',
        projectId: 'proj-1',
        type: 'Task',
        status: 'Backlog',
        startDate: '2026-10-19', // Monday
        dueDate: '2026-10-20', // Tuesday (2 business days: Mon, Tue)
        dependencyIds: ['task-2'],
      } as unknown as Task,
    ];

    // Delay task-1 to Monday 2026-10-19
    const report = calculateScheduleImpact('task-1', '2026-10-19', tasks);
    assert.equal(report.affectedTasks.length, 2);

    const aff2 = report.affectedTasks.find((a) => a.taskId === 'task-2')!;
    assert.equal(aff2.newStartDate, '2026-10-20'); // Tuesday
    assert.equal(aff2.newDueDate, '2026-10-20'); // Tuesday

    const aff3 = report.affectedTasks.find((a) => a.taskId === 'task-3')!;
    assert.equal(aff3.newStartDate, '2026-10-21'); // Wednesday
    assert.equal(aff3.newDueDate, '2026-10-22'); // Thursday (preserves 2-day duration)
  });

  it('applies schedule changes cleanly to task state without mutation', () => {
    const tasks: Task[] = [
      {
        id: 't-1',
        title: 'Alpha',
        dueDate: '2026-10-15',
        version: 1,
      } as Task,
      {
        id: 't-2',
        title: 'Beta',
        startDate: '2026-10-16',
        dueDate: '2026-10-16',
        dependencyIds: ['t-1'],
        version: 2,
      } as Task,
    ];

    const report = calculateScheduleImpact('t-1', '2026-10-19', tasks);
    const updated = applyScheduleChanges(report, tasks);

    assert.notEqual(updated, tasks); // pure, new array
    const updatedT1 = updated.find((t) => t.id === 't-1')!;
    const updatedT2 = updated.find((t) => t.id === 't-2')!;

    assert.equal(updatedT1.dueDate, '2026-10-19');
    assert.equal(updatedT1.version, 2);
    assert.equal(updatedT2.startDate, '2026-10-20');
    assert.equal(updatedT2.dueDate, '2026-10-20');
    assert.equal(updatedT2.version, 3);
  });
});
