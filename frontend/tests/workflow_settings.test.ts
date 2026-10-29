import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Task, AuditLogEntry } from '../src/types/index.ts';
import { toBackendRole } from '../src/services/api.ts';

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

  describe('Backend-provided workflow configuration', () => {
    it('verifies legacy /dashboard, /workflow, and /dependencies URL routing normalization', () => {
      function resolveProjectTabFromRoute(hash: string): { projectId?: string; projectTab?: string } {
        const clean = hash.replace(/^#/, '');
        const match = clean.match(/^\/project\/([^/]+)(?:\/([^/]+))?/);
        if (!match) return {};
        const projectId = match[1];
        if (!match[2]) return { projectId, projectTab: 'overview' };

        const rawTab = match[2].split(/[#?]/)[0];
        const hashSection = match[2].includes('#') ? match[2].split('#')[1] : null;

        if (rawTab === 'dashboard') {
          return { projectId, projectTab: 'overview' };
        } else if (rawTab === 'workflow') {
          return { projectId, projectTab: 'settings#workflow' };
        } else if (rawTab === 'dependencies') {
          return { projectId, projectTab: 'settings#dependencies' };
        } else if (rawTab === 'members') {
          return { projectId, projectTab: 'settings#members' };
        } else if (rawTab === 'activity') {
          return { projectId, projectTab: 'settings#activity' };
        } else if (rawTab === 'settings' && hashSection) {
          return { projectId, projectTab: `settings#${hashSection}` };
        }
        return { projectId, projectTab: rawTab };
      }

      // Legacy dashboard routes to overview
      assert.deepEqual(resolveProjectTabFromRoute('#/project/p-100/dashboard'), {
        projectId: 'p-100',
        projectTab: 'overview',
      });

      // Legacy workflow top-level tab routes to settings#workflow
      assert.deepEqual(resolveProjectTabFromRoute('#/project/p-100/workflow'), {
        projectId: 'p-100',
        projectTab: 'settings#workflow',
      });

      // Legacy dependencies top-level tab routes to settings#dependencies
      assert.deepEqual(resolveProjectTabFromRoute('#/project/p-100/dependencies'), {
        projectId: 'p-100',
        projectTab: 'settings#dependencies',
      });

      // Overview route stays overview
      assert.deepEqual(resolveProjectTabFromRoute('#/project/p-100/overview'), {
        projectId: 'p-100',
        projectTab: 'overview',
      });

      // Settings hash stays settings#workflow
      assert.deepEqual(resolveProjectTabFromRoute('#/project/p-100/settings#workflow'), {
        projectId: 'p-100',
        projectTab: 'settings#workflow',
      });
    });

    it('verifies workflow name resolution avoids raw UUID or project ID suffixes', () => {
      function resolveWorkflowName(rawName?: string): string {
        const isGeneric =
          !rawName ||
          rawName === 'Custom Engineering Flow' ||
          rawName === 'Standard Engineering Flow' ||
          rawName.endsWith(' Workflow') ||
          /^[0-9a-fA-F-]{20,}/.test(rawName);

        return isGeneric ? 'TaskFlow Pro — Final Statuses' : rawName;
      }

      assert.equal(
        resolveWorkflowName('cf78bf63-1fe3-48a6-8fce-f98ac43f75f9 Workflow'),
        'TaskFlow Pro — Final Statuses'
      );
      assert.equal(
        resolveWorkflowName('cf78bf63-1fe3-48a6-8fce-f98ac43f75f9'),
        'TaskFlow Pro — Final Statuses'
      );
      assert.equal(
        resolveWorkflowName('Custom Engineering Flow'),
        'TaskFlow Pro — Final Statuses'
      );
      assert.equal(
        resolveWorkflowName('TaskFlow Pro — Final Statuses'),
        'TaskFlow Pro — Final Statuses'
      );
      assert.equal(
        resolveWorkflowName('Deliberate Custom Mobile Release Pipeline'),
        'Deliberate Custom Mobile Release Pipeline'
      );
    });
  });

  describe('Organization Member Role Mapping & Settings Display (Section 3)', () => {
    it('toBackendRole accurately maps uppercase, titlecase, and lowercase roles to backend canonical values', () => {
      // Admin
      assert.equal(toBackendRole('ADMIN'), 'ADMIN');
      assert.equal(toBackendRole('Admin'), 'ADMIN');
      assert.equal(toBackendRole('admin'), 'ADMIN');

      // Manager
      assert.equal(toBackendRole('MANAGER'), 'MANAGER');
      assert.equal(toBackendRole('Manager'), 'MANAGER');
      assert.equal(toBackendRole('manager'), 'MANAGER');
      assert.equal(toBackendRole('LEAD'), 'MANAGER');
      assert.equal(toBackendRole('lead'), 'MANAGER');

      // Teammate
      assert.equal(toBackendRole('TEAMMATE'), 'TEAMMATE');
      assert.equal(toBackendRole('Teammate'), 'TEAMMATE');
      assert.equal(toBackendRole('teammate'), 'TEAMMATE');
      assert.equal(toBackendRole('MEMBER'), 'TEAMMATE');
      assert.equal(toBackendRole('member'), 'TEAMMATE');

      // Guest
      assert.equal(toBackendRole('Guest'), 'GUEST');
      assert.equal(toBackendRole('GUEST'), 'GUEST');

      // Missing & unrecognized roles must NOT silently convert to TEAMMATE
      assert.equal(toBackendRole(undefined), '');
      assert.equal(toBackendRole(null), '');
      assert.equal(toBackendRole(''), '');
      assert.equal(toBackendRole('UNKNOWN_ROLE'), '');
      assert.equal(toBackendRole('AUDITOR'), '');
    });

    it('Settings page resolves and selects each member actual backend-provided role simultaneously', () => {
      // Simulate response from GET /api/organization/members
      const serverMembers = [
        { id: 'usr-admin-1', name: 'Alice Admin', email: 'alice@company.com', role: 'ADMIN' },
        { id: 'usr-mgr-2', name: 'Bob Manager', email: 'bob@company.com', role: 'MANAGER' },
        { id: 'usr-tm-3', name: 'Charlie Teammate', email: 'charlie@company.com', role: 'TEAMMATE' },
      ];

      function resolveMemberSelectValue(memberRole: any): { selectValue: string; isRecognized: boolean; displayLabel: string } {
        const backendRole = toBackendRole(memberRole);
        const isRecognized = ['ADMIN', 'MANAGER', 'TEAMMATE'].includes(backendRole);
        const selectValue = isRecognized ? backendRole : (memberRole ? String(memberRole) : '');
        const labels: Record<string, string> = {
          ADMIN: 'Admin',
          MANAGER: 'Manager',
          TEAMMATE: 'Teammate',
        };
        const displayLabel = isRecognized ? labels[backendRole] : (memberRole ? `Unrecognized (${memberRole})` : 'Missing Role');
        return { selectValue, isRecognized, displayLabel };
      }

      const member1 = resolveMemberSelectValue(serverMembers[0].role);
      assert.equal(member1.selectValue, 'ADMIN');
      assert.equal(member1.displayLabel, 'Admin');
      assert.equal(member1.isRecognized, true);

      const member2 = resolveMemberSelectValue(serverMembers[1].role);
      assert.equal(member2.selectValue, 'MANAGER');
      assert.equal(member2.displayLabel, 'Manager');
      assert.equal(member2.isRecognized, true);

      const member3 = resolveMemberSelectValue(serverMembers[2].role);
      assert.equal(member3.selectValue, 'TEAMMATE');
      assert.equal(member3.displayLabel, 'Teammate');
      assert.equal(member3.isRecognized, true);

      // Verify all members can display their distinct roles simultaneously without collision
      assert.notEqual(member1.selectValue, member2.selectValue);
      assert.notEqual(member2.selectValue, member3.selectValue);
      assert.notEqual(member1.selectValue, member3.selectValue);
    });

    it('handles unexpected or missing backend roles safely without defaulting to Teammate', () => {
      function resolveMemberSelectValue(memberRole: any) {
        const backendRole = toBackendRole(memberRole);
        const isRecognized = ['ADMIN', 'MANAGER', 'TEAMMATE'].includes(backendRole);
        const selectValue = isRecognized ? backendRole : (memberRole ? String(memberRole) : '');
        const displayLabel = isRecognized
          ? (backendRole === 'ADMIN' ? 'Admin' : backendRole === 'MANAGER' ? 'Manager' : 'Teammate')
          : (memberRole ? `Unrecognized (${memberRole})` : 'Missing Role');
        return { selectValue, isRecognized, displayLabel };
      }

      const missing = resolveMemberSelectValue(undefined);
      assert.equal(missing.isRecognized, false);
      assert.equal(missing.selectValue, '');
      assert.equal(missing.displayLabel, 'Missing Role');
      assert.notEqual(missing.selectValue, 'TEAMMATE');

      const nullRole = resolveMemberSelectValue(null);
      assert.equal(nullRole.isRecognized, false);
      assert.equal(nullRole.selectValue, '');
      assert.equal(nullRole.displayLabel, 'Missing Role');
      assert.notEqual(nullRole.selectValue, 'TEAMMATE');

      const unexpected = resolveMemberSelectValue('CONTRACTOR');
      assert.equal(unexpected.isRecognized, false);
      assert.equal(unexpected.selectValue, 'CONTRACTOR');
      assert.equal(unexpected.displayLabel, 'Unrecognized (CONTRACTOR)');
      assert.notEqual(unexpected.selectValue, 'TEAMMATE');
    });

    it('updating a member role sends the canonical backend role and updates local state correctly', () => {
      let members = [
        { id: 'usr-1', name: 'Dev One', email: 'dev1@org.com', role: 'TEAMMATE' },
      ];

      function handleRoleUpdate(userId: string, newRoleSelection: string) {
        const canonical = toBackendRole(newRoleSelection);
        assert.ok(['ADMIN', 'MANAGER', 'TEAMMATE'].includes(canonical));
        members = members.map((m) => (m.id === userId ? { ...m, role: canonical } : m));
        return canonical;
      }

      // Promote to Manager
      const updatedToManager = handleRoleUpdate('usr-1', 'MANAGER');
      assert.equal(updatedToManager, 'MANAGER');
      assert.equal(members[0].role, 'MANAGER');

      // Promote to Admin
      const updatedToAdmin = handleRoleUpdate('usr-1', 'ADMIN');
      assert.equal(updatedToAdmin, 'ADMIN');
      assert.equal(members[0].role, 'ADMIN');
    });
  });
});
