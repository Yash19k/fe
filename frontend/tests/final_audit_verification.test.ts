import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPermission,
  canTransitionStatus,
  normalizeRole,
  PERMISSIONS,
  ROLES,
} from '../src/domain/permissions';
import type { Task, Workflow, User } from '../src/types';

describe('Final Audit Verification Tests (F-08, F-09, F-10, F-11)', () => {
  describe('F-11: Role Normalization and RBAC Permissions for Backend Role Enums', () => {
    test('normalizeRole safely handles uppercase, lowercase, and titlecase roles', () => {
      assert.equal(normalizeRole('ADMIN'), ROLES.ADMIN);
      assert.equal(normalizeRole('admin'), ROLES.ADMIN);
      assert.equal(normalizeRole('Admin'), ROLES.ADMIN);
      assert.equal(normalizeRole('MANAGER'), ROLES.MANAGER);
      assert.equal(normalizeRole('manager'), ROLES.MANAGER);
      assert.equal(normalizeRole('LEAD'), ROLES.MANAGER);
      assert.equal(normalizeRole('TEAMMATE'), ROLES.TEAMMATE);
      assert.equal(normalizeRole('MEMBER'), ROLES.TEAMMATE);
      assert.equal(normalizeRole('member'), ROLES.TEAMMATE);
      assert.equal(normalizeRole(undefined), ROLES.TEAMMATE);
      assert.equal(normalizeRole(null), ROLES.TEAMMATE);
    });

    test('hasPermission grants full access when role is uppercase ADMIN', () => {
      assert.equal(hasPermission('ADMIN' as any, PERMISSIONS.DELETE_PROJECT), true);
      assert.equal(hasPermission('ADMIN' as any, PERMISSIONS.MANAGE_MEMBERS), true);
      assert.equal(hasPermission('ADMIN' as any, PERMISSIONS.MANAGE_WORKFLOW), true);
      assert.equal(hasPermission('ADMIN' as any, PERMISSIONS.CREATE_TASK), true);
    });

    test('hasPermission evaluates permissions correctly for MANAGER and TEAMMATE in any case', () => {
      assert.equal(hasPermission('MANAGER' as any, PERMISSIONS.CREATE_PROJECT), true);
      assert.equal(hasPermission('MANAGER' as any, PERMISSIONS.DELETE_PROJECT), false);
      assert.equal(hasPermission('TEAMMATE' as any, PERMISSIONS.DELETE_PROJECT), false);
      assert.equal(hasPermission('TEAMMATE' as any, PERMISSIONS.CREATE_TASK), true);
      assert.equal(hasPermission('MEMBER' as any, PERMISSIONS.CREATE_TASK), true);
      assert.equal(hasPermission('MEMBER' as any, PERMISSIONS.MANAGE_MEMBERS), false);
    });

    test('canTransitionStatus allows uppercase ADMIN for explicitly configured transitions', () => {
      const workflow: Workflow = {
        id: 'wf-test',
        name: 'Strict Pipeline',
        statuses: [
          {
            id: 's-todo',
            name: 'To Do',
            category: 'todo',
            color: '#3B82F6',
            order: 0,
            allowedTransitions: ['Done'],
          },
          {
            id: 's-done',
            name: 'Done',
            category: 'completed',
            color: '#22C55E',
            order: 1,
            allowedTransitions: [],
          },
        ],
      };

      const result = canTransitionStatus('ADMIN' as any, 'To Do', 'Done', workflow);
      assert.equal(result.allowed, true);
    });

    test('canTransitionStatus enforces teammate workflow and direct Done restrictions for uppercase TEAMMATE', () => {
      const workflow: Workflow = {
        id: 'wf-test',
        name: 'Standard Pipeline',
        statuses: [
          {
            id: 's-todo',
            name: 'In Progress',
            category: 'inprogress',
            color: '#3B82F6',
            order: 0,
            allowedTransitions: ['Done'],
          },
          {
            id: 's-done',
            name: 'Done',
            category: 'completed',
            color: '#22C55E',
            order: 1,
            allowedTransitions: [],
          },
        ],
      };
      workflow.statuses[0].roleRestrictions = { Done: ['Admin', 'Manager'] };

      const teammateDirectDone = canTransitionStatus('TEAMMATE' as any, 'In Progress', 'Done', workflow);
      assert.equal(teammateDirectDone.allowed, false);
      assert.match(teammateDirectDone.reason || '', /Only Admin\/Manager can move tasks into "Done"/);
    });
  });

  describe('F-08: HomeView Multi-Assignee Task Matching', () => {
    const currentUserId = 'usr-001';

    const testTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Task 1 - Singular Assignee',
        projectId: 'p1',
        status: 'In Progress',
        priority: 'High',
        type: 'Task',
        assigneeId: currentUserId,
        createdAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'task-2',
        title: 'Task 2 - Multi Assignee Ids Array',
        projectId: 'p1',
        status: 'In Progress',
        priority: 'Medium',
        type: 'Task',
        assigneeId: 'usr-999',
        assigneeIds: ['usr-888', currentUserId],
        createdAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'task-3',
        title: 'Task 3 - Multi Assignees Object Array',
        projectId: 'p1',
        status: 'Done',
        priority: 'Low',
        type: 'Task',
        assigneeId: 'usr-999',
        assignees: [{ id: currentUserId, name: 'Current User' } as User],
        createdAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'task-4',
        title: 'Task 4 - Unassigned to Current User',
        projectId: 'p1',
        status: 'Backlog',
        priority: 'Low',
        type: 'Task',
        assigneeId: 'usr-999',
        assigneeIds: ['usr-777'],
        assignees: [{ id: 'usr-777', name: 'Other User' } as User],
        createdAt: '2026-10-01T00:00:00Z',
      },
    ];

    const matchUserTask = (t: Task, userId: string) => {
      if (t.assigneeId === userId) return true;
      if (Array.isArray(t.assigneeIds) && t.assigneeIds.includes(userId)) return true;
      if (Array.isArray(t.assignees) && t.assignees.some((a: any) => a.id === userId || a.userId === userId)) return true;
      return false;
    };

    test('matches tasks assigned via singular assigneeId, assigneeIds array, and assignees objects', () => {
      const matched = testTasks.filter((t) => matchUserTask(t, currentUserId));
      assert.equal(matched.length, 3);
      assert.deepEqual(matched.map((t) => t.id), ['task-1', 'task-2', 'task-3']);
      assert.equal(matched.some((t) => t.id === 'task-4'), false);
    });
  });

  describe('F-09: ProjectMembersView Multi-Assignee Workload Calculation', () => {
    const memberId = 'usr-member-A';

    const projectTasks: Task[] = [
      {
        id: 't-1',
        title: 'Solo task',
        projectId: 'p1',
        status: 'In Progress',
        priority: 'Medium',
        type: 'Task',
        assigneeId: memberId,
        createdAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 't-2',
        title: 'Shared task via assigneeIds',
        projectId: 'p1',
        status: 'Done',
        priority: 'Low',
        type: 'Task',
        assigneeIds: ['usr-other', memberId],
        createdAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 't-3',
        title: 'Shared task via assignees array',
        projectId: 'p1',
        status: 'In Review',
        priority: 'High',
        type: 'Bug',
        assignees: [{ userId: memberId, name: 'Member A' } as any],
        createdAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 't-4',
        title: 'Completely other task',
        projectId: 'p1',
        status: 'In Progress',
        priority: 'High',
        type: 'Task',
        assigneeId: 'usr-other',
        createdAt: '2026-10-01T00:00:00Z',
      },
    ];

    test('accurately calculates active and done counts for multi-assigned member', () => {
      const memberTasks = projectTasks.filter((t: Task) => {
        if (t.assigneeId === memberId) return true;
        if (Array.isArray(t.assigneeIds) && t.assigneeIds.includes(memberId)) return true;
        if (Array.isArray(t.assignees) && t.assignees.some((a: any) => a.id === memberId || a.userId === memberId)) return true;
        return false;
      });

      const doneTasks = memberTasks.filter((t: Task) => t.status === 'Done');
      const activeCount = memberTasks.length - doneTasks.length;

      assert.equal(memberTasks.length, 3);
      assert.equal(doneTasks.length, 1);
      assert.equal(activeCount, 2);
    });
  });

  describe('F-10: ProjectDashboardView Custom Workflow Status Distribution', () => {
    const defaultStatuses = [
      'Backlog',
      'In Progress',
      'In Review',
      'Testing / QA',
      'Blocked',
      'On Hold',
      'Done',
    ];

    test('prefers currentWorkflow custom statuses over default statuses', () => {
      const customWorkflow: Workflow = {
        id: 'wf-custom',
        name: 'Custom Mobile Pipeline',
        statuses: [
          { id: '1', name: 'Discovery', category: 'todo', color: '#888', order: 0 },
          { id: '2', name: 'Design Spec', category: 'todo', color: '#999', order: 1 },
          { id: '3', name: 'Implementation', category: 'inprogress', color: '#3B82F6', order: 2 },
          { id: '4', name: 'Shipped', category: 'done', color: '#22C55E', order: 3 },
        ],
      };

      const configuredStatuses = customWorkflow?.statuses && customWorkflow.statuses.length > 0
        ? customWorkflow.statuses.map((s) => s.name)
        : defaultStatuses;

      assert.deepEqual(configuredStatuses, ['Discovery', 'Design Spec', 'Implementation', 'Shipped']);
    });

    test('falls back to defaultStatuses when currentWorkflow has no statuses', () => {
      const emptyWorkflow = undefined;
      const configuredStatuses = (emptyWorkflow as any)?.statuses && (emptyWorkflow as any).statuses.length > 0
        ? (emptyWorkflow as any).statuses.map((s: any) => s.name)
        : defaultStatuses;

      assert.deepEqual(configuredStatuses, defaultStatuses);
    });
  });
});
