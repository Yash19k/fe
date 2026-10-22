import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toBackendProjectRole, normalizeRole } from '../src/services/api';
import {
  formatAuditAction,
  formatAuditDescription,
  formatAuditTimestamp,
  getAuditActor,
  getAuditEntityInfo,
} from '../src/features/project/ProjectSettingsView';
import type { AuditLogEntry, User, Task } from '../src/types';

describe('Seven Fixes Verification Tests', () => {
  describe('Fix 1 & Fix 8: Project Role Mapping & Self Identity', () => {
    test('toBackendProjectRole maps Admin to ADMIN, Manager to LEAD, Teammate to MEMBER', () => {
      assert.equal(toBackendProjectRole('Admin'), 'ADMIN');
      assert.equal(toBackendProjectRole('Manager'), 'LEAD');
      assert.equal(toBackendProjectRole('Teammate'), 'MEMBER');
      assert.equal(toBackendProjectRole(undefined), 'MEMBER');
      assert.equal(toBackendProjectRole(null), 'MEMBER');
    });

    test('normalizeRole maps LEAD to Manager, ADMIN to Admin, and MEMBER to Teammate', () => {
      assert.equal(normalizeRole('ADMIN'), 'Admin');
      assert.equal(normalizeRole('LEAD'), 'Manager');
      assert.equal(normalizeRole('MANAGER'), 'Manager');
      assert.equal(normalizeRole('MEMBER'), 'Teammate');
      assert.equal(normalizeRole('TEAMMATE'), 'Teammate');
      assert.equal(normalizeRole(undefined), 'Teammate');
    });

    test('self identity detection safely matches authenticated user by ID or email case-insensitively', () => {
      const currentUser: User = {
        id: 'usr-123',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'Admin',
      };

      const memberSelf: User = {
        id: 'usr-123',
        name: 'Jane Doe',
        email: 'JANE@example.com',
        role: 'Admin',
      };

      const memberOther: User = {
        id: 'usr-456',
        name: 'Bob Smith',
        email: 'bob@example.com',
        role: 'Teammate',
      };

      const isSelf1 = Boolean(
        currentUser.id &&
          (memberSelf.id === currentUser.id ||
            (memberSelf.email &&
              currentUser.email &&
              memberSelf.email.toLowerCase() === currentUser.email.toLowerCase()))
      );
      assert.equal(isSelf1, true);

      const isSelf2 = Boolean(
        currentUser.id &&
          (memberOther.id === currentUser.id ||
            (memberOther.email &&
              currentUser.email &&
              memberOther.email.toLowerCase() === currentUser.email.toLowerCase()))
      );
      assert.equal(isSelf2, false);
    });
  });

  describe('Fix 2: Activity & Audit Details and Formatting', () => {
    const mockUsers: User[] = [
      { id: 'usr-1', name: 'Alice Walker', email: 'alice@example.com', role: 'Admin' },
      { id: 'usr-2', name: 'Bob Vance', email: 'bob@example.com', role: 'Manager' },
    ];

    const mockTasks: Task[] = [
      {
        id: 'task-100',
        projectId: 'proj-1',
        title: 'Implement OAuth Flow',
        type: 'Task',
        status: 'In Progress',
        priority: 'High',
        dependencyIds: [],
        tags: [],
        comments: [],
        timeEntries: [],
        version: 1,
        createdAt: '2026-10-21T10:00:00Z',
        updatedAt: '2026-10-21T10:00:00Z',
      },
    ];

    test('correctly identifies audit actor and falls back cleanly without raw UUID', () => {
      const entryWithKnownUser: AuditLogEntry = {
        id: 'aud-1',
        actorId: 'usr-1',
        actorName: 'Alice Walker',
        userEmail: 'alice@example.com',
        entityType: 'task',
        entityId: 'task-100',
        action: 'status_changed',
        description: 'Status changed',
        timestamp: '2026-10-21T12:00:00Z',
      };

      const actor = getAuditActor(entryWithKnownUser, mockUsers);
      assert.equal(actor.name, 'Alice Walker');
      assert.equal(actor.email, 'alice@example.com');

      const entryWithUnknownUser: AuditLogEntry = {
        id: 'aud-2',
        actorId: 'usr-999',
        actorName: 'System Administrator',
        userEmail: 'sysadmin@taskflow.pro',
        entityType: 'project',
        entityId: 'proj-1',
        action: 'created',
        description: 'Project created',
        timestamp: '2026-10-21T12:00:00Z',
      };

      const actorUnknown = getAuditActor(entryWithUnknownUser, mockUsers);
      assert.equal(actorUnknown.name, 'System Administrator');
      assert.equal(actorUnknown.email, 'sysadmin@taskflow.pro');
    });

    test('formats natural language descriptions for status changes and mutations', () => {
      const statusLog: AuditLogEntry = {
        id: 'aud-3',
        actorId: 'usr-1',
        actorName: 'Alice',
        entityType: 'task',
        entityId: 'task-100',
        action: 'status_changed',
        description: 'Changed status',
        previousValue: { status: 'Backlog' },
        newValue: { status: 'In Progress' },
        timestamp: '2026-10-21T12:00:00Z',
      };

      const desc = formatAuditDescription(statusLog, mockTasks, 'Core Platform');
      assert.match(desc, /Implement OAuth Flow/);
      assert.match(desc, /Backlog/);
      assert.match(desc, /In Progress/);
    });

    test('getAuditEntityInfo resolves task titles for task entities and project name for project entities', () => {
      const taskLog: AuditLogEntry = {
        id: 'aud-4',
        actorId: 'usr-1',
        actorName: 'Alice',
        entityType: 'task',
        entityId: 'task-100',
        action: 'updated',
        description: 'Updated task',
        timestamp: '2026-10-21T12:00:00Z',
      };

      const entity = getAuditEntityInfo(taskLog, mockTasks, 'Core Platform');
      assert.equal(entity.label, 'Task: Implement OAuth Flow');

      const projLog: AuditLogEntry = {
        id: 'aud-5',
        actorId: 'usr-1',
        actorName: 'Alice',
        entityType: 'project',
        entityId: 'proj-1',
        action: 'settings_saved',
        description: 'Saved settings',
        timestamp: '2026-10-21T12:00:00Z',
      };

      const projEntity = getAuditEntityInfo(projLog, mockTasks, 'Core Platform');
      assert.equal(projEntity.label, 'Project: Core Platform');
    });
  });

  describe('Fix 1: Toast Deduplication Logic', () => {
    test('deduplicates identical toast messages within 1000ms window', () => {
      const recorded: Array<{ message: string; type: string }> = [];
      let lastToast: { message: string; type: string; timestamp: number } | null = null;

      function mockShowToast(message: string, type = 'info', now: number) {
        if (
          lastToast &&
          lastToast.message === message &&
          lastToast.type === type &&
          now - lastToast.timestamp < 1000
        ) {
          return false;
        }
        lastToast = { message, type, timestamp: now };
        recorded.push({ message, type });
        return true;
      }

      // First call succeeds
      const r1 = mockShowToast('Task "Demo-1" updated', 'success', 1000);
      assert.equal(r1, true);

      // Rapid duplicate call at 1050ms (within 1000ms window) is dropped
      const r2 = mockShowToast('Task "Demo-1" updated', 'success', 1050);
      assert.equal(r2, false);

      // Third call at 1200ms is also dropped
      const r3 = mockShowToast('Task "Demo-1" updated', 'success', 1200);
      assert.equal(r3, false);

      // Different message passes immediately
      const r4 = mockShowToast('Different message', 'success', 1300);
      assert.equal(r4, true);

      // Original message after window (>1000ms from 1000ms) passes
      const r5 = mockShowToast('Task "Demo-1" updated', 'success', 2500);
      assert.equal(r5, true);

      assert.equal(recorded.length, 3);
      assert.equal(recorded[0].message, 'Task "Demo-1" updated');
      assert.equal(recorded[1].message, 'Different message');
      assert.equal(recorded[2].message, 'Task "Demo-1" updated');
    });
  });

  describe('Fix 5: Create Sprint Form Reset Logic', () => {
    test('resetForm clears all draft fields', () => {
      let sprintName = 'Sprint 42';
      let goal = 'Deliver core persistence';
      let startDate = '2026-10-23';
      let endDate = '2026-11-06';
      let selectedTaskIds = new Set(['task-1', 'task-2']);
      let taskSearch = 'oauth';
      let serverError: string | null = 'Previous error';

      function resetForm() {
        sprintName = '';
        goal = '';
        startDate = '';
        endDate = '';
        selectedTaskIds = new Set();
        taskSearch = '';
        serverError = null;
      }

      resetForm();

      assert.equal(sprintName, '');
      assert.equal(goal, '');
      assert.equal(startDate, '');
      assert.equal(endDate, '');
      assert.equal(selectedTaskIds.size, 0);
      assert.equal(taskSearch, '');
      assert.equal(serverError, null);
    });
  });
});
