import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDueDate,
  isTaskDueOnCalendarDate,
} from '../src/domain/calendar.ts';
import type { Task } from '../src/types/index.ts';

describe('Calendar Due-Date Placement Tests (Section 10)', () => {
  const baseTask: Task = {
    id: 'task-test-1',
    projectId: 'proj-1',
    title: 'Test Work Item',
    type: 'Task',
    status: 'In Progress',
    priority: 'High',
    assigneeId: 'user-1',
    startDate: '2026-10-01',
    dueDate: '2026-10-20',
  };

  it('normalizes YYYY-MM-DD date strings accurately', () => {
    assert.equal(normalizeDueDate('2026-10-20'), '2026-10-20');
    assert.equal(normalizeDueDate('  2026-10-20  '), '2026-10-20');
    assert.equal(normalizeDueDate(''), null);
    assert.equal(normalizeDueDate(null), null);
    assert.equal(normalizeDueDate(undefined), null);
  });

  it('normalizes ISO timestamp strings to UTC date string', () => {
    assert.equal(normalizeDueDate('2026-10-20T00:00:00.000Z'), '2026-10-20');
    assert.equal(normalizeDueDate('2026-10-20T14:30:00Z'), '2026-10-20');
  });

  it('places a work item STRICTLY on its actual due date', () => {
    // Task with dueDate = 2026-10-20 must appear on 2026-10-20
    assert.equal(isTaskDueOnCalendarDate(baseTask, '2026-10-20'), true);
  });

  it('does NOT place a work item on other calendar dates', () => {
    // Must not appear on other arbitrary dates
    assert.equal(isTaskDueOnCalendarDate(baseTask, '2026-10-19'), false);
    assert.equal(isTaskDueOnCalendarDate(baseTask, '2026-10-21'), false);
    assert.equal(isTaskDueOnCalendarDate(baseTask, '2026-11-20'), false);
  });

  it('does NOT span a work item across date range between startDate and dueDate', () => {
    // Despite startDate being 2026-10-01, the item must NOT appear on 2026-10-05, 2026-10-10, or 2026-10-15
    assert.equal(isTaskDueOnCalendarDate(baseTask, '2026-10-01'), false);
    assert.equal(isTaskDueOnCalendarDate(baseTask, '2026-10-05'), false);
    assert.equal(isTaskDueOnCalendarDate(baseTask, '2026-10-15'), false);
  });

  it('does NOT place undated work items on arbitrary calendar dates', () => {
    const undatedTask: Task = {
      ...baseTask,
      dueDate: undefined,
    };
    assert.equal(isTaskDueOnCalendarDate(undatedTask, '2026-10-20'), false);
    assert.equal(isTaskDueOnCalendarDate(undatedTask, '2026-10-01'), false);

    const nullDueDateTask: Task = {
      ...baseTask,
      dueDate: null as any,
    };
    assert.equal(isTaskDueOnCalendarDate(nullDueDateTask, '2026-10-20'), false);
  });

  it('correctly handles updated due date', () => {
    const updatedTask: Task = {
      ...baseTask,
      dueDate: '2026-10-28',
    };
    // No longer matches previous date
    assert.equal(isTaskDueOnCalendarDate(updatedTask, '2026-10-20'), false);
    // Matches new date
    assert.equal(isTaskDueOnCalendarDate(updatedTask, '2026-10-28'), true);
  });
});
