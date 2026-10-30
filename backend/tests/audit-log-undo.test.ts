import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { EntityManager } from "typeorm";
import { AuditLog } from "../entities/audit.log.entity";
import { ProjectMember, ProjectRole } from "../entities/project.member.entity";
import { User, UserRole, UserStatus } from "../entities/user.entity";
import {
  WorkItem,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType,
} from "../entities/work.item.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import { Sprint } from "../entities/sprint.entities";
import { ProjectLabel } from "../entities/project.label.entity";
import { AppError } from "../errors/app.error";
import {
  executeAuditUndo,
  undoAuditLog,
} from "../controllers/auditlog.controller";
import { AppDataSource } from "../config/data.source";

interface MockDbState {
  auditLogs: AuditLog[];
  workItems: WorkItem[];
  assignments: WorkItemAssignee[];
  projectMembers: ProjectMember[];
  users: User[];
  sprints: Sprint[];
  labels: ProjectLabel[];
}

function cloneDbState(state: MockDbState): MockDbState {
  return {
    auditLogs: state.auditLogs.map((a) => Object.assign(new AuditLog(), JSON.parse(JSON.stringify(a)))),
    workItems: state.workItems.map((w) => Object.assign(new WorkItem(), JSON.parse(JSON.stringify(w)))),
    assignments: state.assignments.map((a) => Object.assign(new WorkItemAssignee(), JSON.parse(JSON.stringify(a)))),
    projectMembers: state.projectMembers.map((m) => Object.assign(new ProjectMember(), JSON.parse(JSON.stringify(m)))),
    users: state.users.map((u) => Object.assign(new User(), JSON.parse(JSON.stringify(u)))),
    sprints: state.sprints.map((s) => Object.assign(new Sprint(), JSON.parse(JSON.stringify(s)))),
    labels: state.labels.map((l) => Object.assign(new ProjectLabel(), JSON.parse(JSON.stringify(l)))),
  };
}

function createMockEntityManager(state: MockDbState): EntityManager {
  return {
    getRepository: (entityClass: any) => {
      if (entityClass === AuditLog) {
        return {
          createQueryBuilder: () => {
            let logId: string | null = null;
            const builder = {
              setLock: () => builder,
              where: (clause: string, params: { logId: string }) => {
                logId = params.logId;
                return builder;
              },
              getOne: async () => {
                return state.auditLogs.find((l) => l.id === logId) ?? null;
              },
            };
            return builder;
          },
          find: async (options?: { where?: any; order?: any }) => {
            let results = [...state.auditLogs];
            if (options?.where) {
              const { entityId, organizationId } = options.where;
              if (entityId) results = results.filter((l) => l.entityId === entityId);
              if (organizationId) results = results.filter((l) => l.organizationId === organizationId);
            }
            if (options?.order?.createdAt === "ASC") {
              results.sort((a, b) => {
                const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                if (diff !== 0) return diff;
                return a.id.localeCompare(b.id);
              });
            }
            return results;
          },
          create: (data: Partial<AuditLog>) => {
            const log = Object.assign(new AuditLog(), data);
            if (!log.id) log.id = `audit-${Math.random().toString(36).substring(2, 9)}`;
            if (!log.createdAt) log.createdAt = new Date();
            return log;
          },
          save: async (log: AuditLog) => {
            const idx = state.auditLogs.findIndex((l) => l.id === log.id);
            if (idx >= 0) {
              state.auditLogs[idx] = log;
            } else {
              state.auditLogs.push(log);
            }
            return log;
          },
        };
      }

      if (entityClass === WorkItem) {
        return {
          createQueryBuilder: () => {
            let workItemId: string | null = null;
            let organizationId: string | null = null;
            const builder = {
              setLock: () => builder,
              where: (clause: string, params: { workItemId: string }) => {
                workItemId = params.workItemId;
                return builder;
              },
              andWhere: (clause: string, params: { organizationId: string }) => {
                organizationId = params.organizationId;
                return builder;
              },
              getOne: async () => {
                const found = state.workItems.find(
                  (w) =>
                    w.id === workItemId &&
                    (!organizationId || w.organizationId === organizationId),
                );
                return found
                  ? Object.assign(new WorkItem(), JSON.parse(JSON.stringify(found)))
                  : null;
              },
            };
            return builder;
          },
          findOne: async (options: { where: any; select?: any }) => {
            const { id, projectId, organizationId } = options.where;
            const found = state.workItems.find(
              (w) =>
                (!id || w.id === id) &&
                (!projectId || w.projectId === projectId) &&
                (!organizationId || w.organizationId === organizationId),
            );
            return found
              ? Object.assign(new WorkItem(), JSON.parse(JSON.stringify(found)))
              : null;
          },
          save: async (item: WorkItem) => {
            const idx = state.workItems.findIndex((w) => w.id === item.id);
            if (idx >= 0) {
              Object.assign(state.workItems[idx], item);
            } else {
              state.workItems.push(item);
            }
            return item;
          },
        };
      }

      if (entityClass === WorkItemAssignee) {
        return {
          find: async (options: { where: { workItemId: string } }) => {
            return state.assignments.filter((a) => a.workItemId === options.where.workItemId);
          },
          delete: async (options: { workItemId: string }) => {
            state.assignments = state.assignments.filter(
              (a) => a.workItemId !== options.workItemId,
            );
            return { affected: 1 };
          },
          create: (data: Partial<WorkItemAssignee>) => {
            return Object.assign(new WorkItemAssignee(), data);
          },
          save: async (assignments: WorkItemAssignee[]) => {
            state.assignments.push(...assignments);
            return assignments;
          },
        };
      }

      if (entityClass === ProjectMember) {
        return {
          findOne: async (options: { where: { projectId: string; userId: string } }) => {
            return (
              state.projectMembers.find(
                (m) =>
                  m.projectId === options.where.projectId &&
                  m.userId === options.where.userId,
              ) ?? null
            );
          },
          find: async (options: { where: { projectId: string; userId: any } }) => {
            const userIds = options.where.userId?._value ?? options.where.userId;
            const idList = Array.isArray(userIds) ? userIds : [userIds];
            return state.projectMembers.filter(
              (m) =>
                m.projectId === options.where.projectId &&
                idList.includes(m.userId),
            );
          },
        };
      }

      if (entityClass === User) {
        return {
          find: async (options: { where: { id: any; organizationId: string; status: any } }) => {
            const userIds = options.where.id?._value ?? options.where.id;
            const idList = Array.isArray(userIds) ? userIds : [userIds];
            return state.users.filter(
              (u) =>
                idList.includes(u.id) &&
                u.organizationId === options.where.organizationId &&
                u.status === options.where.status,
            );
          },
        };
      }

      if (entityClass === Sprint) {
        return {
          findOne: async (options: { where: { id: string; projectId: string } }) => {
            return (
              state.sprints.find(
                (s) =>
                  s.id === options.where.id &&
                  s.projectId === options.where.projectId,
              ) ?? null
            );
          },
        };
      }

      if (entityClass === ProjectLabel) {
        return {
          findOne: async (options: { where: { id: string; projectId: string } }) => {
            return (
              state.labels.find(
                (l) =>
                  l.id === options.where.id &&
                  l.projectId === options.where.projectId,
              ) ?? null
            );
          },
        };
      }

      throw new Error(`Unsupported mock repository for: ${entityClass?.name}`);
    },
  } as unknown as EntityManager;
}

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const PROJECT_ID = "00000000-0000-4000-8000-000000000002";
const ADMIN_ID = "00000000-0000-4000-8000-000000000003";
const LEAD_ID = "00000000-0000-4000-8000-000000000004";
const MEMBER_ID = "00000000-0000-4000-8000-000000000005";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000006";
const TASK_ID = "00000000-0000-4000-8000-000000000010";

function setupInitialState(): MockDbState {
  const users: User[] = [
    Object.assign(new User(), {
      id: ADMIN_ID,
      organizationId: ORG_ID,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    }),
    Object.assign(new User(), {
      id: LEAD_ID,
      organizationId: ORG_ID,
      role: UserRole.TEAMMATE,
      status: UserStatus.ACTIVE,
    }),
    Object.assign(new User(), {
      id: MEMBER_ID,
      organizationId: ORG_ID,
      role: UserRole.TEAMMATE,
      status: UserStatus.ACTIVE,
    }),
    Object.assign(new User(), {
      id: OTHER_USER_ID,
      organizationId: ORG_ID,
      role: UserRole.TEAMMATE,
      status: UserStatus.ACTIVE,
    }),
  ];

  const projectMembers: ProjectMember[] = [
    Object.assign(new ProjectMember(), {
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      role: ProjectRole.LEAD,
    }),
    Object.assign(new ProjectMember(), {
      projectId: PROJECT_ID,
      userId: MEMBER_ID,
      role: ProjectRole.MEMBER,
    }),
  ];

  const workItems: WorkItem[] = [
    Object.assign(new WorkItem(), {
      id: TASK_ID,
      projectId: PROJECT_ID,
      organizationId: ORG_ID,
      createdById: ADMIN_ID,
      title: "Create login page",
      description: "Initial description",
      status: WorkItemStatus.BACKLOG,
      priority: WorkItemPriority.MEDIUM,
      type: WorkItemType.TASK,
      dueDate: null,
      plannedStartDate: null,
      isSchedulePinned: false,
      parentWorkItemId: null,
      sprintId: null,
      labelId: null,
      version: 1,
    }),
  ];

  return {
    auditLogs: [],
    workItems,
    assignments: [],
    projectMembers,
    users,
    sprints: [],
    labels: [],
  };
}

describe("Audit Logs Undo Feature", () => {
  // Case 1: Undo an eligible Backlog -> In Progress event
  test("1. successfully undoes an eligible Backlog -> In Progress event", async () => {
    const state = setupInitialState();
    const task = state.workItems[0];
    task.status = WorkItemStatus.IN_PROGRESS;

    const logA = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: 'Updated work item "Create login page"',
      previousState: { status: WorkItemStatus.BACKLOG, priority: WorkItemPriority.MEDIUM },
      newState: { status: WorkItemStatus.IN_PROGRESS, priority: WorkItemPriority.MEDIUM },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:00:00.000Z"),
    });
    state.auditLogs.push(logA);

    const manager = createMockEntityManager(state);
    const result = await executeAuditUndo(
      manager,
      { id: LEAD_ID, organizationId: ORG_ID },
      logA.id,
      PROJECT_ID,
    );

    assert.equal(result.restoredTask.status, WorkItemStatus.BACKLOG);
    assert.equal(task.status, WorkItemStatus.BACKLOG);
    assert.equal(logA.isUndone, true);
    assert.ok(logA.undoneAt);
    assert.equal(logA.undoneById, LEAD_ID);
    assert.equal(result.reversalLog.action, "undone");
    assert.equal(result.reversalLog.isUndone, false);
  });

  // Case 2: Undo an eligible In Progress -> Done event
  test("2. successfully undoes an eligible In Progress -> Done event", async () => {
    const state = setupInitialState();
    const task = state.workItems[0];
    task.status = WorkItemStatus.DONE;

    const logA = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: 'Updated work item "Create login page"',
      previousState: { status: WorkItemStatus.BACKLOG },
      newState: { status: WorkItemStatus.IN_PROGRESS },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:00:00.000Z"),
    });

    const logB = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000102",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: 'Updated work item "Create login page"',
      previousState: { status: WorkItemStatus.IN_PROGRESS },
      newState: { status: WorkItemStatus.DONE },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:01:00.000Z"),
    });
    state.auditLogs.push(logA, logB);

    const manager = createMockEntityManager(state);
    const result = await executeAuditUndo(
      manager,
      { id: LEAD_ID, organizationId: ORG_ID },
      logB.id,
      PROJECT_ID,
    );

    assert.equal(result.restoredTask.status, WorkItemStatus.IN_PROGRESS);
    assert.equal(task.status, WorkItemStatus.IN_PROGRESS);
    assert.equal(logB.isUndone, true);
    assert.equal(logA.isUndone, false);
  });

  // Case 3: Reject Undo of older event while newer conflicting event remains active
  test("3. rejects Undo of Backlog -> In Progress while newer In Progress -> Done remains active", async () => {
    const state = setupInitialState();
    const task = state.workItems[0];
    task.status = WorkItemStatus.DONE;

    const logA = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: 'Updated work item "Create login page"',
      previousState: { status: WorkItemStatus.BACKLOG },
      newState: { status: WorkItemStatus.IN_PROGRESS },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:00:00.000Z"),
    });

    const logB = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000102",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: 'Updated work item "Create login page"',
      previousState: { status: WorkItemStatus.IN_PROGRESS },
      newState: { status: WorkItemStatus.DONE },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:01:00.000Z"),
    });
    state.auditLogs.push(logA, logB);

    const manager = createMockEntityManager(state);

    await assert.rejects(
      executeAuditUndo(
        manager,
        { id: LEAD_ID, organizationId: ORG_ID },
        logA.id,
        PROJECT_ID,
      ),
      (err: any) =>
        err instanceof AppError &&
        err.statusCode === 400 &&
        err.message.includes("Undo the most recent change first"),
    );

    // Verify task and audit log remain unchanged
    assert.equal(task.status, WorkItemStatus.DONE);
    assert.equal(logA.isUndone, false);
    assert.equal(logB.isUndone, false);
  });

  // Case 4: Allow earlier event to become eligible after newer event has been undone
  test("4. allows earlier event to become eligible after newer event is undone", async () => {
    const state = setupInitialState();
    const task = state.workItems[0];
    task.status = WorkItemStatus.DONE;

    const logA = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: 'Updated work item "Create login page"',
      previousState: { status: WorkItemStatus.BACKLOG },
      newState: { status: WorkItemStatus.IN_PROGRESS },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:00:00.000Z"),
    });

    const logB = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000102",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: 'Updated work item "Create login page"',
      previousState: { status: WorkItemStatus.IN_PROGRESS },
      newState: { status: WorkItemStatus.DONE },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:01:00.000Z"),
    });
    state.auditLogs.push(logA, logB);

    const manager = createMockEntityManager(state);

    // Step 1: Undo Log B
    const resultB = await executeAuditUndo(
      manager,
      { id: LEAD_ID, organizationId: ORG_ID },
      logB.id,
      PROJECT_ID,
    );
    assert.equal(resultB.restoredTask.status, WorkItemStatus.IN_PROGRESS);
    assert.equal(task.status, WorkItemStatus.IN_PROGRESS);
    assert.equal(logB.isUndone, true);

    // Step 2: Log A becomes eligible and can now be undone
    const resultA = await executeAuditUndo(
      manager,
      { id: LEAD_ID, organizationId: ORG_ID },
      logA.id,
      PROJECT_ID,
    );
    assert.equal(resultA.restoredTask.status, WorkItemStatus.BACKLOG);
    assert.equal(task.status, WorkItemStatus.BACKLOG);
    assert.equal(logA.isUndone, true);
  });

  // Case 5: Reject Undo when selected event's resulting field value no longer matches current state
  test("5. rejects Undo when selected event resulting state does not match current task state", async () => {
    const state = setupInitialState();
    const task = state.workItems[0];
    // Task status was modified to BLOCKED out-of-band
    task.status = WorkItemStatus.BLOCKED;

    const logA = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: 'Updated work item "Create login page"',
      previousState: { status: WorkItemStatus.BACKLOG },
      newState: { status: WorkItemStatus.IN_PROGRESS },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:00:00.000Z"),
    });
    state.auditLogs.push(logA);

    const manager = createMockEntityManager(state);

    await assert.rejects(
      executeAuditUndo(
        manager,
        { id: LEAD_ID, organizationId: ORG_ID },
        logA.id,
        PROJECT_ID,
      ),
      (err: any) =>
        err instanceof AppError &&
        err.statusCode === 400 &&
        err.message.includes("Undo the most recent change first"),
    );

    assert.equal(task.status, WorkItemStatus.BLOCKED);
    assert.equal(logA.isUndone, false);
  });

  // Case 6: Preserve newer changes to unrelated fields when safe field-level restoration is supported
  test("6. preserves newer changes to unrelated fields during field-level restoration", async () => {
    const state = setupInitialState();
    const task = state.workItems[0];
    task.status = WorkItemStatus.IN_PROGRESS;
    task.priority = WorkItemPriority.URGENT;

    // Log A changed status from BACKLOG to IN_PROGRESS (priority remained MEDIUM)
    const logA = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: 'Updated work item "Create login page"',
      previousState: {
        status: WorkItemStatus.BACKLOG,
        priority: WorkItemPriority.MEDIUM,
      },
      newState: {
        status: WorkItemStatus.IN_PROGRESS,
        priority: WorkItemPriority.MEDIUM,
      },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:00:00.000Z"),
    });

    // Log B changed priority from MEDIUM to URGENT (status remained IN_PROGRESS)
    const logB = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000102",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: 'Updated work item "Create login page"',
      previousState: {
        status: WorkItemStatus.IN_PROGRESS,
        priority: WorkItemPriority.MEDIUM,
      },
      newState: {
        status: WorkItemStatus.IN_PROGRESS,
        priority: WorkItemPriority.URGENT,
      },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:01:00.000Z"),
    });
    state.auditLogs.push(logA, logB);

    const manager = createMockEntityManager(state);

    // Undoing Log A (status change) should preserve Log B's priority change (URGENT)
    const result = await executeAuditUndo(
      manager,
      { id: LEAD_ID, organizationId: ORG_ID },
      logA.id,
      PROJECT_ID,
    );

    assert.equal(result.restoredTask.status, WorkItemStatus.BACKLOG);
    assert.equal(result.restoredTask.priority, WorkItemPriority.URGENT);
    assert.equal(task.status, WorkItemStatus.BACKLOG);
    assert.equal(task.priority, WorkItemPriority.URGENT);
    assert.equal(logA.isUndone, true);
  });

  // Case 7: Reject already-undone events
  test("7. rejects already-undone audit events", async () => {
    const state = setupInitialState();
    const logA = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: "Test update",
      previousState: { status: WorkItemStatus.BACKLOG },
      newState: { status: WorkItemStatus.IN_PROGRESS },
      isUndone: true,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:00:00.000Z"),
    });
    state.auditLogs.push(logA);

    const manager = createMockEntityManager(state);

    await assert.rejects(
      executeAuditUndo(
        manager,
        { id: LEAD_ID, organizationId: ORG_ID },
        logA.id,
        PROJECT_ID,
      ),
      (err: any) =>
        err instanceof AppError &&
        err.statusCode === 400 &&
        err.code === "ALREADY_UNDONE",
    );
  });

  // Case 8: Reject unsupported event types
  test("8. rejects unsupported event types", async () => {
    const unsupportedActions = [
      "created",
      "deleted",
      "schedule_reflow",
      "dependency_added",
      "dependency_removed",
      "sla_initialized",
      "escalated",
      "sla_breached",
      "undone",
    ];

    for (const action of unsupportedActions) {
      const state = setupInitialState();
      const log = Object.assign(new AuditLog(), {
        id: `00000000-0000-4000-8000-${Math.random().toString(36).substring(2, 14).padEnd(12, "0")}`,
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        userId: LEAD_ID,
        action,
        entityType: "task",
        entityId: TASK_ID,
        description: `Action ${action}`,
        previousState: { status: WorkItemStatus.BACKLOG },
        newState: { status: WorkItemStatus.IN_PROGRESS },
        isUndone: false,
        trustedForUndo: false,
        createdAt: new Date(),
      });
      state.auditLogs.push(log);

      const manager = createMockEntityManager(state);

      await assert.rejects(
        executeAuditUndo(
          manager,
          { id: LEAD_ID, organizationId: ORG_ID },
          log.id,
          PROJECT_ID,
        ),
        (err: any) =>
          err instanceof AppError &&
          err.statusCode === 400 &&
          err.code === "ACTION_NOT_REVERSIBLE",
      );
    }
  });

  // Case 9: Reject missing or malformed historical state
  test("9. rejects missing or malformed historical state", async () => {
    const malformedConfigs = [
      { previousState: null, newState: { status: "DONE" } },
      { previousState: { status: "BACKLOG" }, newState: null },
      { previousState: [1, 2], newState: { status: "DONE" } },
      { previousState: "string", newState: { status: "DONE" } },
      { previousState: { status: "SAME" }, newState: { status: "SAME" } }, // No changes
    ];

    for (const config of malformedConfigs) {
      const state = setupInitialState();
      const log = Object.assign(new AuditLog(), {
        id: "00000000-0000-4000-8000-000000000101",
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        userId: LEAD_ID,
        action: "updated",
        entityType: "task",
        entityId: TASK_ID,
        description: "Test update",
        previousState: config.previousState,
        newState: config.newState,
        isUndone: false,
        trustedForUndo: true,
        createdAt: new Date(),
      });
      state.auditLogs.push(log);

      const manager = createMockEntityManager(state);

      await assert.rejects(
        executeAuditUndo(
          manager,
          { id: LEAD_ID, organizationId: ORG_ID },
          log.id,
          PROJECT_ID,
        ),
        (err: any) =>
          err instanceof AppError &&
          err.statusCode === 400 &&
          err.code === "ACTION_NOT_REVERSIBLE",
      );
    }
  });

  // Case 10: Reject Undo when target work item has been deleted
  test("10. rejects Undo when target work item has been deleted", async () => {
    const state = setupInitialState();
    // Delete the work item
    state.workItems = [];

    const log = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: "Test update",
      previousState: { status: WorkItemStatus.BACKLOG },
      newState: { status: WorkItemStatus.IN_PROGRESS },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date(),
    });
    state.auditLogs.push(log);

    const manager = createMockEntityManager(state);

    await assert.rejects(
      executeAuditUndo(
        manager,
        { id: LEAD_ID, organizationId: ORG_ID },
        log.id,
        PROJECT_ID,
      ),
      (err: any) =>
        err instanceof AppError &&
        err.statusCode === 404 &&
        err.code === "WORK_ITEM_NOT_FOUND",
    );
  });

  // Case 11: Handle missing sprint, label, parent, or assignee references safely
  test("11. rejects Undo when stored sprint, label, parent, or assignee reference is invalid", async () => {
    // Missing Sprint
    {
      const state = setupInitialState();
      const task = state.workItems[0];
      task.sprintId = "00000000-0000-4000-8000-000000000021";
      const log = Object.assign(new AuditLog(), {
        id: "00000000-0000-4000-8000-000000000101",
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        userId: LEAD_ID,
        action: "updated",
        entityType: "task",
        entityId: TASK_ID,
        description: "Test update",
        previousState: { sprintId: "00000000-0000-4000-8000-000000000020" },
        newState: { sprintId: "00000000-0000-4000-8000-000000000021" },
        isUndone: false,
        trustedForUndo: true,
        createdAt: new Date(),
      });
      state.auditLogs.push(log);
      const manager = createMockEntityManager(state);

      await assert.rejects(
        executeAuditUndo(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID),
        (err: any) =>
          err instanceof AppError &&
          err.statusCode === 400 &&
          err.message.includes("stored sprint is unavailable"),
      );
    }

    // Missing Label
    {
      const state = setupInitialState();
      const task = state.workItems[0];
      task.labelId = "00000000-0000-4000-8000-000000000031";
      const log = Object.assign(new AuditLog(), {
        id: "00000000-0000-4000-8000-000000000101",
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        userId: LEAD_ID,
        action: "updated",
        entityType: "task",
        entityId: TASK_ID,
        description: "Test update",
        previousState: { labelId: "00000000-0000-4000-8000-000000000030" },
        newState: { labelId: "00000000-0000-4000-8000-000000000031" },
        isUndone: false,
        trustedForUndo: true,
        createdAt: new Date(),
      });
      state.auditLogs.push(log);
      const manager = createMockEntityManager(state);

      await assert.rejects(
        executeAuditUndo(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID),
        (err: any) =>
          err instanceof AppError &&
          err.statusCode === 400 &&
          err.message.includes("stored label is unavailable"),
      );
    }

    // Missing Parent Work Item
    {
      const state = setupInitialState();
      const task = state.workItems[0];
      task.parentWorkItemId = "00000000-0000-4000-8000-000000000041";
      const log = Object.assign(new AuditLog(), {
        id: "00000000-0000-4000-8000-000000000101",
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        userId: LEAD_ID,
        action: "updated",
        entityType: "task",
        entityId: TASK_ID,
        description: "Test update",
        previousState: { parentWorkItemId: "00000000-0000-4000-8000-000000000040" },
        newState: { parentWorkItemId: "00000000-0000-4000-8000-000000000041" },
        isUndone: false,
        trustedForUndo: true,
        createdAt: new Date(),
      });
      state.auditLogs.push(log);
      const manager = createMockEntityManager(state);

      await assert.rejects(
        executeAuditUndo(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID),
        (err: any) =>
          err instanceof AppError &&
          err.statusCode === 400 &&
          err.message.includes("stored parent work item is unavailable"),
      );
    }

    // Assignee no longer in project
    {
      const state = setupInitialState();
      const task = state.workItems[0];
      // Assignee OTHER_USER_ID is not a member of PROJECT_ID
      const log = Object.assign(new AuditLog(), {
        id: "00000000-0000-4000-8000-000000000101",
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        userId: LEAD_ID,
        action: "updated",
        entityType: "task",
        entityId: TASK_ID,
        description: "Test update",
        previousState: { assigneeIds: [OTHER_USER_ID] },
        newState: { assigneeIds: [] },
        isUndone: false,
        trustedForUndo: true,
        createdAt: new Date(),
      });
      state.auditLogs.push(log);
      const manager = createMockEntityManager(state);

      await assert.rejects(
        executeAuditUndo(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID),
        (err: any) =>
          err instanceof AppError &&
          err.statusCode === 400 &&
          err.code === "INVALID_ASSIGNEE",
      );
    }
  });

  // Case 12: Reject unauthorized and cross-organization requests
  test("12. rejects unauthorized and cross-organization requests", async () => {
    // Cross-organization
    {
      const state = setupInitialState();
      const log = Object.assign(new AuditLog(), {
        id: "00000000-0000-4000-8000-000000000101",
        organizationId: "99999999-9999-4000-8000-999999999999",
        projectId: PROJECT_ID,
        userId: LEAD_ID,
        action: "updated",
        entityType: "task",
        entityId: TASK_ID,
        description: "Test update",
        previousState: { status: WorkItemStatus.BACKLOG },
        newState: { status: WorkItemStatus.IN_PROGRESS },
        isUndone: false,
        trustedForUndo: true,
        createdAt: new Date(),
      });
      state.auditLogs.push(log);
      const manager = createMockEntityManager(state);

      await assert.rejects(
        executeAuditUndo(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID),
        (err: any) => err instanceof AppError && err.statusCode === 403,
      );
    }

    // User is MEMBER (not LEAD or ADMIN)
    {
      const state = setupInitialState();
      const task = state.workItems[0];
      task.status = WorkItemStatus.IN_PROGRESS;
      const log = Object.assign(new AuditLog(), {
        id: "00000000-0000-4000-8000-000000000101",
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        userId: MEMBER_ID,
        action: "updated",
        entityType: "task",
        entityId: TASK_ID,
        description: "Test update",
        previousState: { status: WorkItemStatus.BACKLOG },
        newState: { status: WorkItemStatus.IN_PROGRESS },
        isUndone: false,
        trustedForUndo: true,
        createdAt: new Date(),
      });
      state.auditLogs.push(log);
      const manager = createMockEntityManager(state);

      await assert.rejects(
        executeAuditUndo(manager, { id: MEMBER_ID, organizationId: ORG_ID, role: UserRole.TEAMMATE }, log.id, PROJECT_ID),
        (err: any) => err instanceof AppError && err.statusCode === 403,
      );
    }

    // Target work item belongs to different project than requestedProjectId
    {
      const state = setupInitialState();
      const log = Object.assign(new AuditLog(), {
        id: "00000000-0000-4000-8000-000000000101",
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        userId: LEAD_ID,
        action: "updated",
        entityType: "task",
        entityId: TASK_ID,
        description: "Test update",
        previousState: { status: WorkItemStatus.BACKLOG },
        newState: { status: WorkItemStatus.IN_PROGRESS },
        isUndone: false,
        trustedForUndo: true,
        createdAt: new Date(),
      });
      state.auditLogs.push(log);
      const manager = createMockEntityManager(state);

      await assert.rejects(
        executeAuditUndo(
          manager,
          { id: LEAD_ID, organizationId: ORG_ID },
          log.id,
          "00000000-0000-4000-8000-999999999999", // Different project requested
        ),
        (err: any) => err instanceof AppError && err.statusCode === 403,
      );
    }
  });

  // Case 13: Prevent duplicate concurrent reversals
  test("13. prevents duplicate concurrent reversals", async () => {
    const state = setupInitialState();
    const task = state.workItems[0];
    task.status = WorkItemStatus.IN_PROGRESS;

    const logA = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: "Test update",
      previousState: { status: WorkItemStatus.BACKLOG },
      newState: { status: WorkItemStatus.IN_PROGRESS },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date(),
    });
    state.auditLogs.push(logA);

    const manager = createMockEntityManager(state);

    // First request succeeds
    await executeAuditUndo(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID);
    assert.equal(logA.isUndone, true);

    // Concurrent second request discovers logA is now undone
    await assert.rejects(
      executeAuditUndo(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID),
      (err: any) =>
        err instanceof AppError &&
        err.statusCode === 400 &&
        err.code === "ALREADY_UNDONE",
    );
  });

  // Case 14 & 17: Roll back transaction if restoration fails & task is not modified
  test("14 & 17. rolls back changes and does not modify task or mark audit log when restoration fails", async () => {
    const state = setupInitialState();
    const task = state.workItems[0];
    task.status = WorkItemStatus.IN_PROGRESS;
    const backupState = cloneDbState(state);

    // Stored sprint does not exist
    const logA = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: "Test update",
      previousState: {
        status: WorkItemStatus.BACKLOG,
        sprintId: "00000000-0000-4000-8000-999999999999",
      },
      newState: { status: WorkItemStatus.IN_PROGRESS, sprintId: null },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date(),
    });
    state.auditLogs.push(logA);

    const manager = createMockEntityManager(state);

    let failed = false;
    try {
      await executeAuditUndo(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID);
    } catch {
      failed = true;
    }
    assert.ok(failed, "Expected undo operation to fail");

    // In a real transaction rollback, state remains at backup
    assert.equal(logA.isUndone, false);
    assert.equal(logA.undoneAt, undefined);
    assert.equal(task.status, WorkItemStatus.IN_PROGRESS);
  });

  // Case 15: Reversal-audit creation and original isUndone updates are atomic
  test("15. atomic reversal log creation and targetLog update", async () => {
    const state = setupInitialState();
    const task = state.workItems[0];
    task.status = WorkItemStatus.IN_PROGRESS;

    const logA = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: "Updated title",
      previousState: { title: "Old Title" },
      newState: { title: "Create login page" },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date(),
    });
    state.auditLogs.push(logA);

    const manager = createMockEntityManager(state);
    const result = await executeAuditUndo(
      manager,
      { id: LEAD_ID, organizationId: ORG_ID },
      logA.id,
      PROJECT_ID,
    );

    assert.equal(logA.isUndone, true);
    assert.equal(logA.reversalLogId, result.reversalLog.id);
    assert.equal(result.reversalLog.entityId, TASK_ID);
    assert.equal(result.reversalLog.action, "undone");
    assert.equal(result.reversalLog.isUndone, false);
    assert.deepEqual(result.reversalLog.previousState, { title: "Create login page" });
    assert.deepEqual(result.reversalLog.newState, { title: "Old Title" });
  });

  // Case 16: Ensure an unrelated task's update does not invalidate selected task's Undo
  test("16. update to an unrelated task does not invalidate selected task Undo", async () => {
    const state = setupInitialState();
    const task1 = state.workItems[0];
    task1.status = WorkItemStatus.IN_PROGRESS;

    // Create an unrelated task 2
    const TASK_2_ID = "00000000-0000-4000-8000-000000000020";
    const task2 = Object.assign(new WorkItem(), {
      id: TASK_2_ID,
      projectId: PROJECT_ID,
      organizationId: ORG_ID,
      createdById: ADMIN_ID,
      title: "Unrelated Task 2",
      status: WorkItemStatus.IN_PROGRESS,
    });
    state.workItems.push(task2);

    const log1 = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: "Task 1 update",
      previousState: { status: WorkItemStatus.BACKLOG },
      newState: { status: WorkItemStatus.IN_PROGRESS },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:00:00.000Z"),
    });

    // Log 2 is newer and for Task 2
    const log2 = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000102",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_2_ID,
      description: "Task 2 update",
      previousState: { status: WorkItemStatus.BACKLOG },
      newState: { status: WorkItemStatus.IN_PROGRESS },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date("2026-10-30T00:05:00.000Z"),
    });
    state.auditLogs.push(log1, log2);

    const manager = createMockEntityManager(state);

    // Undoing Task 1's log1 must succeed despite newer log2 for Task 2
    const result = await executeAuditUndo(
      manager,
      { id: LEAD_ID, organizationId: ORG_ID },
      log1.id,
      PROJECT_ID,
    );

    assert.equal(result.restoredTask.status, WorkItemStatus.BACKLOG);
    assert.equal(task1.status, WorkItemStatus.BACKLOG);
    assert.equal(log1.isUndone, true);
    assert.equal(log2.isUndone, false);
  });

  // Test Express controller undoAuditLog contract
  test("undoAuditLog Express handler returns contract expected by frontend", async () => {
    const state = setupInitialState();
    const task = state.workItems[0];
    task.status = WorkItemStatus.IN_PROGRESS;

    const logA = Object.assign(new AuditLog(), {
      id: "00000000-0000-4000-8000-000000000101",
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      userId: LEAD_ID,
      action: "updated",
      entityType: "task",
      entityId: TASK_ID,
      description: "Updated status",
      previousState: { status: WorkItemStatus.BACKLOG },
      newState: { status: WorkItemStatus.IN_PROGRESS },
      isUndone: false,
      trustedForUndo: true,
      createdAt: new Date(),
    });
    state.auditLogs.push(logA);

    // Mock AppDataSource.transaction
    const originalTransaction = AppDataSource.transaction;
    (AppDataSource as any).transaction = async (cb: (m: any) => Promise<any>) => {
      const m = createMockEntityManager(state);
      return cb(m);
    };

    try {
      const req: any = {
        params: { logId: logA.id, projectId: PROJECT_ID },
        user: { id: LEAD_ID, organizationId: ORG_ID, role: UserRole.TEAMMATE },
      };
      let responseStatus = 0;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => {
          responseStatus = code;
          return res;
        },
        json: (data: any) => {
          responseBody = data;
          return res;
        },
      };

      await undoAuditLog(req, res);

      assert.equal(responseStatus, 200);
      assert.equal(responseBody.success, true);
      assert.equal(responseBody.message, "Action undone successfully.");
      assert.equal(responseBody.data.undoneLogId, logA.id);
      assert.ok(responseBody.data.reversalLog);
      assert.equal(responseBody.data.reversalLog.action, "undone");
      assert.ok(responseBody.data.restoredTask);
      assert.equal(responseBody.data.restoredTask.status, WorkItemStatus.BACKLOG);
    } finally {
      AppDataSource.transaction = originalTransaction;
    }
  });
});
