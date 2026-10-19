import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLastFridayOfMonth,
  computeNextOccurrenceDate,
  formatRecurrenceRule,
  generateNextOccurrences,
  createNextRecurringTask,
} from '../src/domain/recurrence.ts';
import { Task } from '../src/types/index.ts';

describe('Recurrence Engine Tests', () => {
  it('computes last Friday of October 2026 (Oct 30)', () => {
    // Oct 2026: month index 9
    const lastFriday = getLastFridayOfMonth(2026, 9);
    assert.equal(lastFriday.getFullYear(), 2026);
    assert.equal(lastFriday.getMonth(), 9);
    assert.equal(lastFriday.getDate(), 30);
    assert.equal(lastFriday.getDay(), 5); // Friday
  });

  it('computes last Friday for leap year February 2024 (Feb 23)', () => {
    // Feb 2024: month index 1
    const lastFriday = getLastFridayOfMonth(2024, 1);
    assert.equal(lastFriday.getFullYear(), 2024);
    assert.equal(lastFriday.getMonth(), 1);
    assert.equal(lastFriday.getDate(), 23);
    assert.equal(lastFriday.getDay(), 5);
  });

  it('computes last Friday when month ends on a Friday (Feb 28, 2025)', () => {
    // Feb 2025: month index 1
    const lastFriday = getLastFridayOfMonth(2025, 1);
    assert.equal(lastFriday.getFullYear(), 2025);
    assert.equal(lastFriday.getMonth(), 1);
    assert.equal(lastFriday.getDate(), 28);
    assert.equal(lastFriday.getDay(), 5);
  });

  it('computes next occurrence for weekly_monday', () => {
    const rule = { frequency: 'weekly_monday' };
    // Monday 2026-10-12 -> Next Monday 2026-10-19
    const next1 = computeNextOccurrenceDate('2026-10-12', rule);
    assert.equal(next1, '2026-10-19');

    // Friday 2026-10-16 -> Next Monday 2026-10-19
    const next2 = computeNextOccurrenceDate('2026-10-16', rule);
    assert.equal(next2, '2026-10-19');
  });

  it('computes next occurrence for monthly_first_day including year rollover', () => {
    const rule = { frequency: 'monthly_first_day' };
    // Oct 1 -> Nov 1
    assert.equal(computeNextOccurrenceDate('2026-10-01', rule), '2026-11-01');
    // Oct 15 -> Nov 1
    assert.equal(computeNextOccurrenceDate('2026-10-15', rule), '2026-11-01');
    // Dec 1 -> Jan 1 next year
    assert.equal(computeNextOccurrenceDate('2026-12-01', rule), '2027-01-01');
  });

  it('computes next occurrence for monthly_last_friday', () => {
    const rule = { frequency: 'monthly_last_friday' };
    // Oct 14, 2026 -> Oct 30, 2026 (this month's last Friday)
    assert.equal(computeNextOccurrenceDate('2026-10-14', rule), '2026-10-30');

    // Oct 30, 2026 (on last Friday) -> Nov 27, 2026 (next month's last Friday)
    assert.equal(computeNextOccurrenceDate('2026-10-30', rule), '2026-11-27');
  });

  it('bounds preview occurrences to specified count', () => {
    const mockTask = {
      id: 'task-1',
      title: 'Server Backup',
      projectId: 'proj-1',
      type: 'Task',
      status: 'Backlog',
      dueDate: '2026-10-30',
      recurrenceRule: { frequency: 'monthly_last_friday' },
    } as Task;

    const preview = generateNextOccurrences(mockTask, 5);
    assert.equal(preview.length, 5);
    assert.equal(preview[0].date, '2026-11-27');
    assert.equal(preview[1].date, '2026-12-25');
  });

  it('creates next recurring task with reset Backlog status and uncompleted subtasks', () => {
    const completedTask = {
      id: 'task-10',
      title: 'Monthly Review',
      projectId: 'proj-1',
      type: 'Task',
      status: 'Done',
      startDate: '2026-10-01',
      dueDate: '2026-10-05',
      recurrenceRule: { frequency: 'monthly_first_day' },
      subtasks: [
        { id: 'sub-1', title: 'Prep slides', completed: true },
      ],
      dependencyIds: ['task-9'],
    } as unknown as Task;

    const nextTask = createNextRecurringTask(completedTask);
    assert.ok(nextTask);
    assert.notEqual(nextTask.id, 'task-10');
    assert.equal(nextTask.status, 'Backlog');
    assert.equal(nextTask.dueDate, '2026-11-01');
    assert.equal(nextTask.startDate, '2026-10-28'); // preserved 4-day duration
    assert.equal(nextTask.subtasks?.[0].completed, false);
    assert.deepEqual(nextTask.dependencyIds, []);
  });

  it('formats human-readable descriptions', () => {
    assert.equal(formatRecurrenceRule({ frequency: 'weekly_monday' }), 'Repeats weekly on Monday');
    assert.equal(formatRecurrenceRule({ frequency: 'monthly_first_day' }), 'Repeats monthly on the 1st day');
    assert.equal(formatRecurrenceRule({ frequency: 'monthly_last_friday' }), 'Repeats monthly on the last Friday');
    assert.equal(formatRecurrenceRule({ frequency: 'daily', interval: 1, weekdaysOnly: true }), 'Repeats every weekday');
  });
});
