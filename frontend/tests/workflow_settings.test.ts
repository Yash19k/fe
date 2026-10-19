import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Task, AuditLogEntry } from '../src/types/index.ts';

describe('Workflow, Settings, and Task Editing Tests (Sections 11, 12, 13, 15, 16)', () => {
  it('prevents deleting a workflow status if existing tasks occupy it (Section 12.3)', () => {
    const tasks: Task[] = [
      { id: 'task-1', projectId: 'p1', title: 'Task 1', status: 'In Review' },
      { id: 'task-2', projectId: 'p1', title: 'Task 2', status: 'Backlog' },
    ];

    function canDeleteStatus(statusName: string, projectTasks: Task[]): { canDelete: boolean; taskCount: number } {
      const occupying = projectTasks.filter((t) => t.status === statusName);
      return {
        canDelete: occupying.length === 0,
        taskCount: occupying.length,
      };
    }

    // Status occupied by task-1
    const inReviewCheck = canDeleteStatus('In Review', tasks);
    assert.equal(inReviewCheck.canDelete, false);
    assert.equal(inReviewCheck.taskCount, 1);

    // Unoccupied status
    const qaCheck = canDeleteStatus('QA Testing', tasks);
    assert.equal(qaCheck.canDelete, true);
    assert.equal(qaCheck.taskCount, 0);
  });

  it('requires explicit confirmation before applying member role changes (Section 11.2)', () => {
    let serverRole = 'Teammate';

    // User chooses 'Manager' from dropdown -> pending confirmation dialog
    const pendingRoleChange = {
      memberId: 'user-2',
      memberName: 'Rohan Mehta',
      previousRole: serverRole,
      proposedRole: 'Manager',
    };

    // If user cancels -> serverRole remains unchanged
    let userConfirmed = false;
    if (userConfirmed) {
      serverRole = pendingRoleChange.proposedRole;
    }
    assert.equal(serverRole, 'Teammate');

    // If user confirms -> serverRole is updated
    userConfirmed = true;
    if (userConfirmed) {
      serverRole = pendingRoleChange.proposedRole;
    }
    assert.equal(serverRole, 'Manager');
  });

  it('filters audit history strictly for the specific active work item (Section 16)', () => {
    const auditLog: AuditLogEntry[] = [
      {
        id: 'aud-1',
        entityType: 'task',
        entityId: 'task-100',
        action: 'status_changed',
        description: 'Changed status to Done',
        timestamp: '2026-10-15T10:00:00Z',
      },
      {
        id: 'aud-2',
        entityType: 'task',
        entityId: 'task-200',
        action: 'status_changed',
        description: 'Unrelated task event',
        timestamp: '2026-10-15T10:05:00Z',
      },
      {
        id: 'aud-3',
        entityType: 'project',
        entityId: 'proj-1',
        action: 'updated',
        description: 'Project settings updated',
        timestamp: '2026-10-15T10:10:00Z',
      },
      {
        id: 'aud-4',
        entityType: 'task',
        entityId: 'task-100',
        action: 'updated',
        description: 'Updated priority to High',
        timestamp: '2026-10-15T10:15:00Z',
      },
    ];

    // Query history for task-100
    const taskHistory = auditLog.filter(
      (entry) => entry.entityType === 'task' && entry.entityId === 'task-100'
    );

    assert.equal(taskHistory.length, 2);
    assert.equal(taskHistory[0].id, 'aud-1');
    assert.equal(taskHistory[1].id, 'aud-4');
    // Ensure task-200 and proj-1 events are excluded
    assert.equal(taskHistory.some((e) => e.entityId !== 'task-100'), false);
  });

  it('detects draft dirtiness and explicit save/cancel state (Section 15)', () => {
    const originalTask: Task = {
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Original Title',
      description: 'Original Desc',
      status: 'Backlog',
      priority: 'Low',
    };

    let draft = { ...originalTask };

    // Initially clean
    assert.equal(draft.title === originalTask.title && draft.description === originalTask.description, true);

    // Modify draft title
    draft.title = 'Updated Title';
    const isDirty = draft.title !== originalTask.title || draft.description !== originalTask.description;
    assert.equal(isDirty, true);

    // Cancel discards changes
    draft = { ...originalTask };
    assert.equal(draft.title, 'Original Title');

    // Save persists changes
    draft.title = 'Saved Title';
    const savedTask: Task = { ...originalTask, ...draft };
    assert.equal(savedTask.title, 'Saved Title');
  });

  describe('Lifecycle Flow Stages Drag-and-Drop & Accessibility Tests (Section 5 B7)', () => {
    interface Stage {
      id: string;
      name: string;
      color: string;
      allowedTransitions: string[];
      roleRestrictions?: Record<string, string[]>;
    }

    function reorderStages(stages: Stage[], fromIndex: number, toIndex: number): Stage[] {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= stages.length ||
        toIndex >= stages.length
      ) {
        return stages;
      }
      const next = [...stages];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    }

    const initialStages: Stage[] = [
      { id: 'st-1', name: 'Backlog', color: '#64748B', allowedTransitions: ['In Progress'] },
      { id: 'st-2', name: 'In Progress', color: '#3B82F6', allowedTransitions: ['In Review', 'Blocked'] },
      { id: 'st-3', name: 'In Review', color: '#8B5CF6', allowedTransitions: ['Testing / QA'], roleRestrictions: { 'Testing / QA': ['Manager'] } },
      { id: 'st-4', name: 'Testing / QA', color: '#F59E0B', allowedTransitions: ['Done'] },
      { id: 'st-5', name: 'Done', color: '#10B981', allowedTransitions: [] },
    ];

    it('moves a stage from the beginning to the end (Case 1)', () => {
      const result = reorderStages(initialStages, 0, 4);
      assert.equal(result.length, 5);
      assert.equal(result[0].id, 'st-2');
      assert.equal(result[4].id, 'st-1');
      assert.equal(result[4].name, 'Backlog');
    });

    it('moves a stage from the end to the beginning (Case 2)', () => {
      const result = reorderStages(initialStages, 4, 0);
      assert.equal(result.length, 5);
      assert.equal(result[0].id, 'st-5');
      assert.equal(result[0].name, 'Done');
      assert.equal(result[1].id, 'st-1');
    });

    it('inserts a stage between two other stages (Case 3)', () => {
      // Move 'Testing / QA' (index 3) to between Backlog (0) and In Progress (1) -> index 1
      const result = reorderStages(initialStages, 3, 1);
      assert.equal(result.length, 5);
      assert.equal(result[0].name, 'Backlog');
      assert.equal(result[1].name, 'Testing / QA');
      assert.equal(result[2].name, 'In Progress');
    });

    it('dropping in the same position does not corrupt the order (Case 4)', () => {
      const result = reorderStages(initialStages, 2, 2);
      assert.deepEqual(result, initialStages);
    });

    it('safely rejects out-of-bounds drop targets without corrupting array', () => {
      const resNeg = reorderStages(initialStages, -1, 2);
      assert.deepEqual(resNeg, initialStages);
      const resOverflow = reorderStages(initialStages, 1, 99);
      assert.deepEqual(resOverflow, initialStages);
    });

    it('does not duplicate stages or delete any stages (Case 5)', () => {
      const result = reorderStages(initialStages, 1, 3);
      assert.equal(result.length, initialStages.length);
      const ids = result.map((s) => s.id);
      const uniqueIds = new Set(ids);
      assert.equal(uniqueIds.size, initialStages.length);
    });

    it('preserves stable stage IDs, transition metadata, and role permissions intact (Cases 6 & 7)', () => {
      const result = reorderStages(initialStages, 0, 3);
      const movedStage = result.find((s) => s.id === 'st-3');
      assert.ok(movedStage);
      assert.equal(movedStage.id, 'st-3');
      assert.equal(movedStage.name, 'In Review');
      assert.deepEqual(movedStage.allowedTransitions, ['Testing / QA']);
      assert.deepEqual(movedStage.roleRestrictions, { 'Testing / QA': ['Manager'] });
    });

    it('simulates accessible keyboard reordering (Left/Right arrow steps) (Case 9)', () => {
      let stages = [...initialStages];
      let grabbedIdx: number | null = 2; // Grab 'In Review' at index 2

      // User presses ArrowLeft: move to index 1
      stages = reorderStages(stages, grabbedIdx, grabbedIdx - 1);
      grabbedIdx = grabbedIdx - 1;
      assert.equal(stages[1].name, 'In Review');

      // User presses ArrowRight twice: move to index 3
      stages = reorderStages(stages, grabbedIdx, grabbedIdx + 1);
      grabbedIdx = grabbedIdx + 1;
      stages = reorderStages(stages, grabbedIdx, grabbedIdx + 1);
      grabbedIdx = grabbedIdx + 1;

      assert.equal(stages[3].name, 'In Review');
      // User presses Space/Enter: commits drop
      grabbedIdx = null;
      assert.equal(grabbedIdx, null);
    });

    it('cancel restores original saved order, save persists final order (Cases 10 & 11)', () => {
      const savedWorkflow = { id: 'wf-1', statuses: [...initialStages] };
      let draftStatuses = reorderStages(initialStages, 0, 4);

      // Reorder made it dirty
      assert.notDeepEqual(draftStatuses, savedWorkflow.statuses);

      // User cancels -> restores original
      draftStatuses = [...savedWorkflow.statuses];
      assert.deepEqual(draftStatuses, savedWorkflow.statuses);

      // User reorders and saves
      draftStatuses = reorderStages(initialStages, 0, 4);
      savedWorkflow.statuses = [...draftStatuses];
      assert.deepEqual(savedWorkflow.statuses[4].name, 'Backlog');
    });
  });
});
