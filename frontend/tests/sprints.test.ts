import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Task } from '../src/types/index.ts';
import { isPersistedWorkItemId } from '../src/services/api.ts';

describe('Sprint Domain & Validation Tests (Section 9)', () => {
  it('validates sprint required fields correctly', () => {
    function validateSprintInput(input: {
      name: string;
      startDate: string;
      endDate: string;
    }): { valid: boolean; errors: Record<string, string> } {
      const errors: Record<string, string> = {};
      if (!input.name.trim()) {
        errors.name = 'Sprint name is required';
      }
      if (input.startDate && input.endDate && input.endDate < input.startDate) {
        errors.endDate = 'End date cannot be earlier than start date';
      }
      return { valid: Object.keys(errors).length === 0, errors };
    }

    // Missing name
    const invalidName = validateSprintInput({
      name: '',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
    });
    assert.equal(invalidName.valid, false);
    assert.equal(invalidName.errors.name, 'Sprint name is required');

    // Invalid date order
    const invalidDates = validateSprintInput({
      name: 'Sprint 1',
      startDate: '2026-10-15',
      endDate: '2026-10-01',
    });
    assert.equal(invalidDates.valid, false);
    assert.equal(invalidDates.errors.endDate, 'End date cannot be earlier than start date');

    // Valid sprint
    const valid = validateSprintInput({
      name: 'Sprint 1 - Core MVP',
      startDate: '2026-10-01',
      endDate: '2026-10-14',
    });
    assert.equal(valid.valid, true);
    assert.deepEqual(valid.errors, {});
  });

  it('correctly associates selected backlog tasks to a new sprint', () => {
    const projectBacklogTasks: Task[] = [
      { id: 'task-1', projectId: 'proj-1', title: 'Task 1', status: 'Backlog' },
      { id: 'task-2', projectId: 'proj-1', title: 'Task 2', status: 'Backlog' },
      { id: 'task-3', projectId: 'proj-1', title: 'Task 3', status: 'In Progress', sprintId: 'existing-sprint' },
    ];

    // Filter eligible backlog tasks for project
    const eligibleBacklog = projectBacklogTasks.filter(
      (t) => t.projectId === 'proj-1' && !t.sprintId
    );
    assert.equal(eligibleBacklog.length, 2);
    assert.equal(eligibleBacklog[0].id, 'task-1');
    assert.equal(eligibleBacklog[1].id, 'task-2');

    // Simulate sprint creation and task assignment
    const sprintId = 'sprint-new-1';
    const selectedTaskIds = ['task-1'];

    const updatedTasks = projectBacklogTasks.map((t) =>
      selectedTaskIds.includes(t.id) ? { ...t, sprintId } : t
    );

    const associated = updatedTasks.find((t) => t.id === 'task-1');
    assert.equal(associated?.sprintId, sprintId);

    const unassociated = updatedTasks.find((t) => t.id === 'task-2');
    assert.equal(unassociated?.sprintId, undefined);
  });

  it('excludes temporary frontend task IDs from sprint payloads', () => {
    const persistedId = '550e8400-e29b-41d4-a716-446655440000';

    assert.equal(isPersistedWorkItemId(persistedId), true);
    assert.equal(isPersistedWorkItemId('tf-1792576074881'), false);
    assert.equal(isPersistedWorkItemId('task-1'), false);
  });
});
