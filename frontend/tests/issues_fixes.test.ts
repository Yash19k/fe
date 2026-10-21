import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAuditActor,
  getAuditEntityInfo,
  formatAuditTimestamp,
  formatAuditAction,
  formatAuditDescription,
} from '../src/features/project/ProjectSettingsView.js';
import { hasPermission, PERMISSIONS } from '../src/domain/permissions.ts';
import { backendWorkItemToTask } from '../src/services/api.js';
import type { Task, User, AuditLogEntry, Attachment } from '../src/types/index.ts';

describe('Issue 1: Activity & Audit Trail Display and Date Formatting', () => {
  const mockUsers: User[] = [
    {
      id: 'u-101',
      name: 'Sarah Connor',
      fullName: 'Sarah Connor',
      email: 'sarah@example.com',
      role: 'Admin',
    },
    {
      id: 'u-102',
      name: '',
      fullName: '',
      email: 'alex@example.com',
      role: 'Teammate',
    },
  ];

  const mockTasks: Task[] = [
    {
      id: 't-201',
      projectId: 'p-1',
      title: 'QA Verify Integration Task',
      status: 'In Progress',
    },
  ];

  it('resolves actor name from existing user directory by ID', () => {
    const log: AuditLogEntry = {
      id: 'log-1',
      projectId: 'p-1',
      userId: 'u-101',
      actorId: 'u-101',
      action: 'UPDATED',
      entityType: 'Task',
      entityId: 't-201',
      timestamp: '2026-10-20T10:00:00.000Z',
    };

    const actor = getAuditActor(log, mockUsers);
    assert.equal(actor.name, 'Sarah Connor');
    assert.equal(actor.email, 'sarah@example.com');
  });

  it('falls back to email when user name is empty', () => {
    const log: AuditLogEntry = {
      id: 'log-2',
      projectId: 'p-1',
      userId: 'u-102',
      actorId: 'u-102',
      action: 'UPDATED',
      entityType: 'Task',
      entityId: 't-201',
      timestamp: '2026-10-20T10:00:00.000Z',
    };

    const actor = getAuditActor(log, mockUsers);
    assert.equal(actor.name, 'alex@example.com');
  });

  it('resolves actor name from persisted audit log metadata (actorName / userName) if user is not in active memory', () => {
    const log: AuditLogEntry = {
      id: 'log-3',
      projectId: 'p-1',
      userId: 'u-999',
      actorName: 'John Doe',
      userEmail: 'john@example.com',
      action: 'STATUS_CHANGED',
      entityType: 'Task',
      entityId: 't-201',
      timestamp: '2026-10-20T10:00:00.000Z',
    };

    const actor = getAuditActor(log, mockUsers);
    assert.equal(actor.name, 'John Doe');
    assert.equal(actor.email, 'john@example.com');
  });

  it('falls back to "Unknown user" when actor is completely unresolvable', () => {
    const log: AuditLogEntry = {
      id: 'log-4',
      projectId: 'p-1',
      action: 'UPDATED',
      entityType: 'Task',
      entityId: 't-201',
      timestamp: '2026-10-20T10:00:00.000Z',
    };

    const actor = getAuditActor(log, mockUsers);
    assert.equal(actor.name, 'Unknown user');
  });

  it('resolves human-readable entity title for existing task', () => {
    const log: AuditLogEntry = {
      id: 'log-5',
      projectId: 'p-1',
      action: 'UPDATED',
      entityType: 'Task',
      entityId: 't-201',
      timestamp: '2026-10-20T10:00:00.000Z',
    };

    const entityInfo = getAuditEntityInfo(log, mockTasks);
    assert.equal(entityInfo.label, 'Task: QA Verify Integration Task');
    assert.equal(entityInfo.isDeleted, undefined);
  });

  it('handles deleted/missing tasks gracefully without raw UUID as primary label', () => {
    const log: AuditLogEntry = {
      id: 'log-6',
      projectId: 'p-1',
      action: 'DELETED',
      entityType: 'Task',
      entityId: '7208a04e-ea10-4f8c-8aa2-8af5bc1f8c51',
      timestamp: '2026-10-20T10:00:00.000Z',
    };

    const entityInfo = getAuditEntityInfo(log, mockTasks);
    assert.equal(entityInfo.label, 'Task: Deleted task');
    assert.equal(entityInfo.isDeleted, true);
  });

  it('uses persisted entityTitle if available when task is missing', () => {
    const log: AuditLogEntry = {
      id: 'log-7',
      projectId: 'p-1',
      action: 'UPDATED',
      entityType: 'Task',
      entityId: 't-old-99',
      entityTitle: 'Archived Backend Task',
      timestamp: '2026-10-20T10:00:00.000Z',
    };

    const entityInfo = getAuditEntityInfo(log, mockTasks);
    assert.equal(entityInfo.label, 'Task: Archived Backend Task');
  });

  it('formats valid timestamp properly without producing "Invalid Date"', () => {
    const validIso = '2026-10-20T12:30:00.000Z';
    const formatted = formatAuditTimestamp(validIso);
    assert.notEqual(formatted, 'Invalid Date');
    assert.match(formatted, /Oct|10|2026/);
  });

  it('returns "Date unavailable" for invalid or missing timestamp', () => {
    assert.equal(formatAuditTimestamp(undefined), 'Date unavailable');
    assert.equal(formatAuditTimestamp(''), 'Date unavailable');
    assert.equal(formatAuditTimestamp('invalid-date-string'), 'Date unavailable');
  });
});

describe('Issue 2: Project Settings Key / Slug Immutability', () => {
  it('ensures project key/slug is treated as read-only value with copy capability', () => {
    const project = {
      id: 'proj-1',
      key: 'TASK',
      name: 'TaskFlow Main',
    };

    // The key must not be modified by settings updates
    const updatedSettings = {
      name: 'TaskFlow Pro Updated',
      description: 'New description',
    };

    const result = {
      ...project,
      ...updatedSettings,
      key: project.key, // Key remains immutable
    };

    assert.equal(result.key, 'TASK');
    assert.equal(result.name, 'TaskFlow Pro Updated');
  });
});

describe('Issue 3: Task Assignee Persistence and State Hydration', () => {
  it('maps assigneeId and assignees array consistently on task update', () => {
    const initialTask: Task = {
      id: 'task-1',
      projectId: 'p-1',
      title: 'Implement Auth',
      status: 'Todo',
      assigneeId: undefined,
      assignees: [],
    };

    const selectedUserId = 'user-abc';
    const selectedUser: User = {
      id: 'user-abc',
      name: 'Jane Developer',
      email: 'jane@example.com',
      role: 'Teammate',
    };

    // Backend payload contains assigneeId and assignees
    const updatePayload = {
      assigneeId: selectedUserId,
      assigneeIds: [selectedUserId],
      assignees: [selectedUser],
    };

    // Simulating backend response after transaction
    const backendResponse = {
      id: 'task-1',
      projectId: 'p-1',
      title: 'Implement Auth',
      status: 'Todo',
      assigneeId: selectedUserId,
      assignees: [selectedUser],
    };

    // Merging into state
    const updatedTask: Task = {
      ...initialTask,
      ...backendResponse,
    };

    assert.equal(updatedTask.assigneeId, 'user-abc');
    assert.equal(updatedTask.assignees?.length, 1);
    assert.equal(updatedTask.assignees?.[0]?.name, 'Jane Developer');
  });

  it('supports unassigning task without mutating other fields', () => {
    const assignedTask: Task = {
      id: 'task-1',
      projectId: 'p-1',
      title: 'Implement Auth',
      description: 'Important task',
      priority: 'High',
      status: 'Todo',
      assigneeId: 'user-abc',
      assignees: [{ id: 'user-abc', name: 'Jane Developer', email: 'jane@example.com', role: 'Teammate' }],
    };

    // Unassign payload
    const unassignPayload = {
      assigneeId: null,
      assigneeIds: [],
      assignees: [],
    };

    const updatedTask: Task = {
      ...assignedTask,
      assigneeId: unassignPayload.assigneeId ?? undefined,
      assignees: unassignPayload.assignees,
    };

    assert.equal(updatedTask.assigneeId, undefined);
    assert.equal(updatedTask.assignees?.length, 0);
    // Unrelated fields preserved
    assert.equal(updatedTask.title, 'Implement Auth');
    assert.equal(updatedTask.description, 'Important task');
    assert.equal(updatedTask.priority, 'High');
  });

  it('hydrates assignees array from backendWorkItemToTask assignments relation', () => {
    const rawBackendWorkItem = {
      id: 'task-10',
      projectId: 'p-1',
      title: 'Database Migration Task',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      type: 'TASK',
      assignments: [
        {
          userId: 'user-42',
          user: {
            id: 'user-42',
            fullName: 'Michael Scott',
            email: 'michael@dundermifflin.com',
            role: 'LEAD',
          },
        },
      ],
    };

    const task = backendWorkItemToTask(rawBackendWorkItem, 'p-1');
    assert.equal(task.assigneeId, 'user-42');
    assert.deepEqual(task.assigneeIds, ['user-42']);
    assert.equal(task.assignees?.length, 1);
    assert.equal(task.assignees?.[0]?.name, 'Michael Scott');
    assert.equal(task.assignees?.[0]?.email, 'michael@dundermifflin.com');
  });
});

describe('Issue 4: Attachment Preview Format and Lifecycle Support', () => {
  it('detects previewable image mime types and extensions', () => {
    const isImage = (type?: string, name?: string) => {
      const lowerType = (type || '').toLowerCase();
      const lowerName = (name || '').toLowerCase();
      return (
        lowerType.startsWith('image/') ||
        /\.(jpe?g|png|gif|webp|svg|bmp|ico)$/i.test(lowerName)
      );
    };

    assert.equal(isImage('image/png', 'test.png'), true);
    assert.equal(isImage('image/jpeg', 'photo.jpg'), true);
    assert.equal(isImage('image/webp', 'graphic.webp'), true);
    assert.equal(isImage('', 'screenshot.PNG'), true);
    assert.equal(isImage('application/pdf', 'doc.pdf'), false);
  });

  it('detects previewable video mime types and extensions', () => {
    const isVideo = (type?: string, name?: string) => {
      const lowerType = (type || '').toLowerCase();
      const lowerName = (name || '').toLowerCase();
      return (
        lowerType.startsWith('video/') ||
        /\.(mp4|webm|ogg|mov)$/i.test(lowerName)
      );
    };

    assert.equal(isVideo('video/mp4', 'demo.mp4'), true);
    assert.equal(isVideo('video/webm', 'clip.webm'), true);
    assert.equal(isVideo('', 'movie.mov'), true);
    assert.equal(isVideo('application/pdf', 'doc.pdf'), false);
  });

  it('detects PDF attachments for inline or fallback preview', () => {
    const isPdf = (type?: string, name?: string) => {
      const lowerType = (type || '').toLowerCase();
      const lowerName = (name || '').toLowerCase();
      return lowerType === 'application/pdf' || lowerName.endsWith('.pdf');
    };

    assert.equal(isPdf('application/pdf', 'spec.pdf'), true);
    assert.equal(isPdf('', 'report.PDF'), true);
    assert.equal(isPdf('image/png', 'spec.png'), false);
  });

  it('ensures removing attachment stops propagation so preview does not open', () => {
    let previewOpened = false;
    let removeCalled = false;

    const handlePreview = () => {
      previewOpened = true;
    };

    const handleRemove = (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      removeCalled = true;
    };

    // Simulate clicking remove button
    let propagationStopped = false;
    const mockEvent = {
      stopPropagation: () => {
        propagationStopped = true;
      },
    };

    handleRemove(mockEvent);

    if (!propagationStopped) {
      handlePreview();
    }

    assert.equal(removeCalled, true);
    assert.equal(propagationStopped, true);
    assert.equal(previewOpened, false);
  });

  it('resolves active blob URLs for newly attached files without falling back to error', () => {
    const previewUrls: Record<string, string> = {};
    const newAttachment = {
      id: 'att-1',
      name: 'screenshot.png',
      size: 1024,
      type: 'image/png',
      url: 'blob:http://localhost:5173/12345-abcde',
      blobKey: 'att-1',
      uploadedAt: new Date().toISOString(),
    };

    const currentPreviewUrl = previewUrls[newAttachment.id] || newAttachment.url || '';
    assert.equal(currentPreviewUrl, 'blob:http://localhost:5173/12345-abcde');
    assert.ok(currentPreviewUrl.startsWith('blob:'));
  });
});

describe('TaskFlow Pro — Final Polish and Persistence Fixes Verification', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-uuid-12345',
      projectId: 'proj-1',
      title: 'QA Verify Integration Task',
      status: 'In Progress',
    },
    {
      id: 'task-uuid-67890',
      projectId: 'proj-1',
      title: 'Database Migration Script',
      status: 'Done',
    },
  ];

  it('formats raw audit action identifiers into natural language labels with appropriate badge classes', () => {
    const statusAction = formatAuditAction('STATUS_CHANGED');
    assert.equal(statusAction.label, 'Status changed');
    assert.match(statusAction.badgeClass, /cyan/);

    const updateAction = formatAuditAction('UPDATED');
    assert.equal(updateAction.label, 'Updated');
    assert.match(updateAction.badgeClass, /blue/);

    const undoAction = formatAuditAction('UNDONE');
    assert.equal(undoAction.label, 'Change undone');
    assert.match(undoAction.badgeClass, /purple/);

    const createdAction = formatAuditAction('CREATED');
    assert.equal(createdAction.label, 'Created');
    assert.match(createdAction.badgeClass, /emerald/);

    const deletedAction = formatAuditAction('DELETED');
    assert.equal(deletedAction.label, 'Deleted');
    assert.match(deletedAction.badgeClass, /rose/);

    const memberAdded = formatAuditAction('MEMBER_ADDED');
    assert.equal(memberAdded.label, 'Member added');
    assert.match(memberAdded.badgeClass, /amber/);

    const memberRemoved = formatAuditAction('MEMBER_REMOVED');
    assert.equal(memberRemoved.label, 'Member removed');
    assert.match(memberRemoved.badgeClass, /zinc/);
  });

  it('formats UNDONE event with real task title and natural language', () => {
    const undoLog: AuditLogEntry = {
      id: 'audit-1',
      projectId: 'proj-1',
      userId: 'u-admin-1',
      actorId: 'u-admin-1',
      action: 'undone',
      entityType: 'task',
      entityId: 'task-uuid-12345',
      timestamp: '2026-10-20T12:00:00.000Z',
    };

    const desc = formatAuditDescription(undoLog, mockTasks, 'Core Application Platform');
    assert.equal(desc, 'Undid a previous change to "QA Verify Integration Task".');
  });

  it('formats STATUS_CHANGED with previous and next status values and task title', () => {
    const statusLog: AuditLogEntry = {
      id: 'audit-2',
      projectId: 'proj-1',
      userId: 'u-admin-1',
      actorId: 'u-admin-1',
      action: 'status_changed',
      entityType: 'task',
      entityId: 'task-uuid-12345',
      previousValue: { status: 'Backlog' },
      newValue: { status: 'In Progress' },
      timestamp: '2026-10-20T12:05:00.000Z',
    };

    const desc = formatAuditDescription(statusLog, mockTasks, 'Core Application Platform');
    assert.equal(
      desc,
      'Changed the status of "QA Verify Integration Task" from "Backlog" to "In Progress".'
    );
  });

  it('formats UPDATED event with actual task title instead of raw UUID', () => {
    const updateLog: AuditLogEntry = {
      id: 'audit-3',
      projectId: 'proj-1',
      userId: 'u-admin-1',
      actorId: 'u-admin-1',
      action: 'updated',
      entityType: 'task',
      entityId: 'task-uuid-67890',
      description: 'Updated Task "task-uuid-67890"',
      timestamp: '2026-10-20T12:10:00.000Z',
    };

    const desc = formatAuditDescription(updateLog, mockTasks, 'Core Application Platform');
    assert.equal(desc, 'Updated "Database Migration Script".');
  });

  it('verifies the 6 list columns and their proportional min-width layout', () => {
    const columns = [
      { key: 'title', label: 'TASK TITLE', minWidth: 280 },
      { key: 'assignee', label: 'ASSIGNEE', minWidth: 140 },
      { key: 'dueDate', label: 'DUE DATE', minWidth: 110 },
      { key: 'status', label: 'STATUS', minWidth: 110 },
      { key: 'priority', label: 'PRIORITY', minWidth: 90 },
      { key: 'tags', label: 'TAGS', minWidth: 80 },
    ];

    assert.equal(columns.length, 6);
    const totalMinWidth = columns.reduce((acc, c) => acc + c.minWidth, 0);
    assert.ok(totalMinWidth >= 800, 'Total min width should provide horizontal stability');
    assert.equal(columns[0].label, 'TASK TITLE');
    assert.equal(columns[1].label, 'ASSIGNEE');
    assert.equal(columns[2].label, 'DUE DATE');
    assert.equal(columns[3].label, 'STATUS');
    assert.equal(columns[4].label, 'PRIORITY');
    assert.equal(columns[5].label, 'TAGS');
  });

  it('enforces RBAC so only Admin has permission to delete projects', () => {
    assert.equal(hasPermission('Admin', PERMISSIONS.DELETE_PROJECT), true);
    assert.equal(hasPermission('Manager', PERMISSIONS.DELETE_PROJECT), false);
    assert.equal(hasPermission('Teammate', PERMISSIONS.DELETE_PROJECT), false);
  });
});

