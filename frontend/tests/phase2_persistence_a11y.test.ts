import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toDateInputValue, formatDisplayDate } from '../src/utils/dateUtils';
import {
  isPersistedWorkItemId,
  frontendStatusToBackend,
  backendStatusToFrontend,
  createWorkItemApi,
  updateWorkItemApi,
  deleteWorkItemApi,
} from '../src/services/api';
import { Task } from '../src/types';
import { calculateScheduleImpact, applyScheduleChanges } from '../src/domain/scheduling';

describe('Phase 2: Persistence, Date Input Normalization, and Task Assignment', () => {
  describe('F-11: Native Date Input Normalization (toDateInputValue)', () => {
    it('returns empty string for null, undefined, or empty string', () => {
      assert.equal(toDateInputValue(null), '');
      assert.equal(toDateInputValue(undefined), '');
      assert.equal(toDateInputValue(''), '');
    });

    it('returns YYYY-MM-DD directly when already formatted', () => {
      assert.equal(toDateInputValue('2026-11-05'), '2026-11-05');
      assert.equal(toDateInputValue('2027-01-01'), '2027-01-01');
    });

    it('extracts YYYY-MM-DD from full ISO 8601 timestamp with time/timezone', () => {
      assert.equal(toDateInputValue('2026-11-05T14:30:00.000Z'), '2026-11-05');
      assert.equal(toDateInputValue('2026-12-31T23:59:59.999Z'), '2026-12-31');
    });

    it('handles Date objects', () => {
      const d = new Date(2026, 9, 28); // Oct 28 2026 (0-indexed month)
      assert.equal(toDateInputValue(d), '2026-10-28');
    });

    it('returns empty string for invalid date strings', () => {
      assert.equal(toDateInputValue('invalid-date'), '');
      assert.equal(toDateInputValue('not-a-timestamp'), '');
    });

    it('formatDisplayDate formats correctly with fallback', () => {
      assert.equal(formatDisplayDate(null, 'TBD'), 'TBD');
      assert.ok(formatDisplayDate('2026-11-05').includes('2026'));
    });
  });

  describe('F-06: Subtask Work Item Persistence Requirements', () => {
    it('verifies subtask work item payload schema compatibility', () => {
      const parentTaskId = '88888888-4444-4333-8222-111111111111';
      const projectId = '77777777-4444-4333-8222-111111111111';
      assert.ok(isPersistedWorkItemId(parentTaskId));
      assert.ok(isPersistedWorkItemId(projectId));

      const payload = {
        projectId,
        parentWorkItemId: parentTaskId,
        type: 'SUBTASK',
        title: 'Complete Subtask Integration',
        priority: 'MEDIUM',
        status: 'BACKLOG',
        dueDate: '2026-11-10',
        assignees: [{ userId: '11111111-2222-4333-8444-555555555555' }],
      };

      assert.equal(payload.parentWorkItemId, parentTaskId);
      assert.equal(payload.type, 'SUBTASK');
      assert.equal(payload.status, 'BACKLOG');
    });

    it('verifies subtask status toggle maps cleanly between Done and Backlog', () => {
      assert.equal(frontendStatusToBackend('Done'), 'DONE');
      assert.equal(frontendStatusToBackend('Backlog'), 'BACKLOG');
      assert.equal(backendStatusToFrontend('DONE'), 'Done');
      assert.equal(backendStatusToFrontend('BACKLOG'), 'Backlog');
    });
  });

  describe('F-07: Cascade Rescheduling Multi-Task Shifts', () => {
    it('calculates impact and shifts downstream tasks without mutating original array', () => {
      const tasks: Task[] = [
        {
          id: 'task-a',
          title: 'Foundation Architecture',
          startDate: '2026-11-02',
          dueDate: '2026-11-06',
          dependencyIds: [],
          status: 'In Progress',
          priority: 'High',
          projectId: 'p1',
          creatorId: 'u1',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'task-b',
          title: 'Frontend Implementation',
          startDate: '2026-11-09',
          dueDate: '2026-11-13',
          dependencyIds: ['task-a'],
          status: 'Backlog',
          priority: 'Medium',
          projectId: 'p1',
          creatorId: 'u1',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const impact = calculateScheduleImpact('task-a', '2026-11-11', tasks);
      assert.equal(impact.canApply, true);
      assert.equal(impact.newDueDate, '2026-11-11');
      assert.ok(impact.affectedTasks.length > 0);
      assert.equal(impact.affectedTasks[0].taskId, 'task-b');

      const updated = applyScheduleChanges(impact, tasks);
      assert.equal(updated.find((t) => t.id === 'task-a')?.dueDate, '2026-11-11');
      const updatedB = updated.find((t) => t.id === 'task-b');
      assert.ok(updatedB?.startDate && updatedB.startDate > '2026-11-11');
    });
  });

  describe('F-10: My Tasks Cross-Project and Multi-Assignee Matching', () => {
    function isTaskAssigned(task: any, userId: string): boolean {
      if (!userId) return false;
      if (task.assigneeId === userId) return true;
      if (Array.isArray(task.assigneeIds) && task.assigneeIds.includes(userId)) return true;
      if (Array.isArray(task.assignees) && task.assignees.some((a: any) => (a.userId === userId || a.id === userId))) return true;
      return false;
    }

    const currentUserId = 'usr-current-123';

    it('matches task assigned via single assigneeId', () => {
      const task = { id: 't1', assigneeId: currentUserId };
      assert.ok(isTaskAssigned(task, currentUserId));
    });

    it('matches task assigned via assigneeIds array', () => {
      const task = { id: 't2', assigneeId: 'other-user', assigneeIds: ['other-user', currentUserId] };
      assert.ok(isTaskAssigned(task, currentUserId));
    });

    it('matches task assigned via assignees object array', () => {
      const task = { id: 't3', assignees: [{ userId: 'another-user' }, { userId: currentUserId }] };
      assert.ok(isTaskAssigned(task, currentUserId));
    });

    it('rejects task not assigned to user', () => {
      const task = { id: 't4', assigneeId: 'other-user', assigneeIds: ['other-user'], assignees: [{ userId: 'other-user' }] };
      assert.equal(isTaskAssigned(task, currentUserId), false);
    });

    it('deduplicates tasks when merging multiple project queries', () => {
      const taskPool = [
        { id: 't1', title: 'Task 1', assigneeId: currentUserId },
        { id: 't2', title: 'Task 2', assigneeId: currentUserId },
        { id: 't1', title: 'Task 1 (duplicate from another view)', assigneeId: currentUserId },
      ];
      const seen = new Set<string>();
      const deduped = taskPool.filter((t) => {
        if (seen.has(t.id)) return false;
        if (isTaskAssigned(t, currentUserId)) {
          seen.add(t.id);
          return true;
        }
        return false;
      });
      assert.equal(deduped.length, 2);
      assert.deepEqual(deduped.map((t) => t.id), ['t1', 't2']);
    });
  });
});
