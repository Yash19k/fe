"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const audit_log_entity_1 = require("../entities/audit.log.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const user_entity_1 = require("../entities/user.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const work_item_assignee_entity_1 = require("../entities/work.item-assignee.entity");
const sprint_entities_1 = require("../entities/sprint.entities");
const project_label_entity_1 = require("../entities/project.label.entity");
const app_error_1 = require("../errors/app.error");
const auditlog_controller_1 = require("../controllers/auditlog.controller");
const data_source_1 = require("../config/data.source");
function cloneDbState(state) {
    return {
        auditLogs: state.auditLogs.map((a) => Object.assign(new audit_log_entity_1.AuditLog(), JSON.parse(JSON.stringify(a)))),
        workItems: state.workItems.map((w) => Object.assign(new work_item_entity_1.WorkItem(), JSON.parse(JSON.stringify(w)))),
        assignments: state.assignments.map((a) => Object.assign(new work_item_assignee_entity_1.WorkItemAssignee(), JSON.parse(JSON.stringify(a)))),
        projectMembers: state.projectMembers.map((m) => Object.assign(new project_member_entity_1.ProjectMember(), JSON.parse(JSON.stringify(m)))),
        users: state.users.map((u) => Object.assign(new user_entity_1.User(), JSON.parse(JSON.stringify(u)))),
        sprints: state.sprints.map((s) => Object.assign(new sprint_entities_1.Sprint(), JSON.parse(JSON.stringify(s)))),
        labels: state.labels.map((l) => Object.assign(new project_label_entity_1.ProjectLabel(), JSON.parse(JSON.stringify(l)))),
    };
}
function createMockEntityManager(state) {
    return {
        getRepository: (entityClass) => {
            if (entityClass === audit_log_entity_1.AuditLog) {
                return {
                    createQueryBuilder: () => {
                        let logId = null;
                        const builder = {
                            setLock: () => builder,
                            where: (clause, params) => {
                                logId = params.logId;
                                return builder;
                            },
                            getOne: async () => {
                                return state.auditLogs.find((l) => l.id === logId) ?? null;
                            },
                        };
                        return builder;
                    },
                    find: async (options) => {
                        let results = [...state.auditLogs];
                        if (options?.where) {
                            const { entityId, organizationId } = options.where;
                            if (entityId)
                                results = results.filter((l) => l.entityId === entityId);
                            if (organizationId)
                                results = results.filter((l) => l.organizationId === organizationId);
                        }
                        if (options?.order?.createdAt === "ASC") {
                            results.sort((a, b) => {
                                const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                                if (diff !== 0)
                                    return diff;
                                return a.id.localeCompare(b.id);
                            });
                        }
                        return results;
                    },
                    create: (data) => {
                        const log = Object.assign(new audit_log_entity_1.AuditLog(), data);
                        if (!log.id)
                            log.id = `audit-${Math.random().toString(36).substring(2, 9)}`;
                        if (!log.createdAt)
                            log.createdAt = new Date();
                        return log;
                    },
                    save: async (log) => {
                        const idx = state.auditLogs.findIndex((l) => l.id === log.id);
                        if (idx >= 0) {
                            state.auditLogs[idx] = log;
                        }
                        else {
                            state.auditLogs.push(log);
                        }
                        return log;
                    },
                };
            }
            if (entityClass === work_item_entity_1.WorkItem) {
                return {
                    createQueryBuilder: () => {
                        let workItemId = null;
                        let organizationId = null;
                        const builder = {
                            setLock: () => builder,
                            where: (clause, params) => {
                                workItemId = params.workItemId;
                                return builder;
                            },
                            andWhere: (clause, params) => {
                                organizationId = params.organizationId;
                                return builder;
                            },
                            getOne: async () => {
                                const found = state.workItems.find((w) => w.id === workItemId &&
                                    (!organizationId || w.organizationId === organizationId));
                                return found
                                    ? Object.assign(new work_item_entity_1.WorkItem(), JSON.parse(JSON.stringify(found)))
                                    : null;
                            },
                        };
                        return builder;
                    },
                    findOne: async (options) => {
                        const { id, projectId, organizationId } = options.where;
                        const found = state.workItems.find((w) => (!id || w.id === id) &&
                            (!projectId || w.projectId === projectId) &&
                            (!organizationId || w.organizationId === organizationId));
                        return found
                            ? Object.assign(new work_item_entity_1.WorkItem(), JSON.parse(JSON.stringify(found)))
                            : null;
                    },
                    save: async (item) => {
                        const idx = state.workItems.findIndex((w) => w.id === item.id);
                        if (idx >= 0) {
                            Object.assign(state.workItems[idx], item);
                        }
                        else {
                            state.workItems.push(item);
                        }
                        return item;
                    },
                };
            }
            if (entityClass === work_item_assignee_entity_1.WorkItemAssignee) {
                return {
                    find: async (options) => {
                        return state.assignments.filter((a) => a.workItemId === options.where.workItemId);
                    },
                    delete: async (options) => {
                        state.assignments = state.assignments.filter((a) => a.workItemId !== options.workItemId);
                        return { affected: 1 };
                    },
                    create: (data) => {
                        return Object.assign(new work_item_assignee_entity_1.WorkItemAssignee(), data);
                    },
                    save: async (assignments) => {
                        state.assignments.push(...assignments);
                        return assignments;
                    },
                };
            }
            if (entityClass === project_member_entity_1.ProjectMember) {
                return {
                    findOne: async (options) => {
                        return (state.projectMembers.find((m) => m.projectId === options.where.projectId &&
                            m.userId === options.where.userId) ?? null);
                    },
                    find: async (options) => {
                        const userIds = options.where.userId?._value ?? options.where.userId;
                        const idList = Array.isArray(userIds) ? userIds : [userIds];
                        return state.projectMembers.filter((m) => m.projectId === options.where.projectId &&
                            idList.includes(m.userId));
                    },
                };
            }
            if (entityClass === user_entity_1.User) {
                return {
                    find: async (options) => {
                        const userIds = options.where.id?._value ?? options.where.id;
                        const idList = Array.isArray(userIds) ? userIds : [userIds];
                        return state.users.filter((u) => idList.includes(u.id) &&
                            u.organizationId === options.where.organizationId &&
                            u.status === options.where.status);
                    },
                };
            }
            if (entityClass === sprint_entities_1.Sprint) {
                return {
                    findOne: async (options) => {
                        return (state.sprints.find((s) => s.id === options.where.id &&
                            s.projectId === options.where.projectId) ?? null);
                    },
                };
            }
            if (entityClass === project_label_entity_1.ProjectLabel) {
                return {
                    findOne: async (options) => {
                        return (state.labels.find((l) => l.id === options.where.id &&
                            l.projectId === options.where.projectId) ?? null);
                    },
                };
            }
            throw new Error(`Unsupported mock repository for: ${entityClass?.name}`);
        },
    };
}
const ORG_ID = "00000000-0000-4000-8000-000000000001";
const PROJECT_ID = "00000000-0000-4000-8000-000000000002";
const ADMIN_ID = "00000000-0000-4000-8000-000000000003";
const LEAD_ID = "00000000-0000-4000-8000-000000000004";
const MEMBER_ID = "00000000-0000-4000-8000-000000000005";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000006";
const TASK_ID = "00000000-0000-4000-8000-000000000010";
function setupInitialState() {
    const users = [
        Object.assign(new user_entity_1.User(), {
            id: ADMIN_ID,
            organizationId: ORG_ID,
            role: user_entity_1.UserRole.ADMIN,
            status: user_entity_1.UserStatus.ACTIVE,
        }),
        Object.assign(new user_entity_1.User(), {
            id: LEAD_ID,
            organizationId: ORG_ID,
            role: user_entity_1.UserRole.TEAMMATE,
            status: user_entity_1.UserStatus.ACTIVE,
        }),
        Object.assign(new user_entity_1.User(), {
            id: MEMBER_ID,
            organizationId: ORG_ID,
            role: user_entity_1.UserRole.TEAMMATE,
            status: user_entity_1.UserStatus.ACTIVE,
        }),
        Object.assign(new user_entity_1.User(), {
            id: OTHER_USER_ID,
            organizationId: ORG_ID,
            role: user_entity_1.UserRole.TEAMMATE,
            status: user_entity_1.UserStatus.ACTIVE,
        }),
    ];
    const projectMembers = [
        Object.assign(new project_member_entity_1.ProjectMember(), {
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            role: project_member_entity_1.ProjectRole.LEAD,
        }),
        Object.assign(new project_member_entity_1.ProjectMember(), {
            projectId: PROJECT_ID,
            userId: MEMBER_ID,
            role: project_member_entity_1.ProjectRole.MEMBER,
        }),
    ];
    const workItems = [
        Object.assign(new work_item_entity_1.WorkItem(), {
            id: TASK_ID,
            projectId: PROJECT_ID,
            organizationId: ORG_ID,
            createdById: ADMIN_ID,
            title: "Create login page",
            description: "Initial description",
            status: work_item_entity_1.WorkItemStatus.BACKLOG,
            priority: work_item_entity_1.WorkItemPriority.MEDIUM,
            type: work_item_entity_1.WorkItemType.TASK,
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
(0, node_test_1.describe)("Audit Logs Undo Feature", () => {
    // Case 1: Undo an eligible Backlog -> In Progress event
    (0, node_test_1.test)("1. successfully undoes an eligible Backlog -> In Progress event", async () => {
        const state = setupInitialState();
        const task = state.workItems[0];
        task.status = work_item_entity_1.WorkItemStatus.IN_PROGRESS;
        const logA = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: 'Updated work item "Create login page"',
            previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG, priority: work_item_entity_1.WorkItemPriority.MEDIUM },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS, priority: work_item_entity_1.WorkItemPriority.MEDIUM },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:00:00.000Z"),
        });
        state.auditLogs.push(logA);
        const manager = createMockEntityManager(state);
        const result = await (0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID);
        strict_1.default.equal(result.restoredTask.status, work_item_entity_1.WorkItemStatus.BACKLOG);
        strict_1.default.equal(task.status, work_item_entity_1.WorkItemStatus.BACKLOG);
        strict_1.default.equal(logA.isUndone, true);
        strict_1.default.ok(logA.undoneAt);
        strict_1.default.equal(logA.undoneById, LEAD_ID);
        strict_1.default.equal(result.reversalLog.action, "undone");
        strict_1.default.equal(result.reversalLog.isUndone, false);
    });
    // Case 2: Undo an eligible In Progress -> Done event
    (0, node_test_1.test)("2. successfully undoes an eligible In Progress -> Done event", async () => {
        const state = setupInitialState();
        const task = state.workItems[0];
        task.status = work_item_entity_1.WorkItemStatus.DONE;
        const logA = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: 'Updated work item "Create login page"',
            previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:00:00.000Z"),
        });
        const logB = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000102",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: 'Updated work item "Create login page"',
            previousState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            newState: { status: work_item_entity_1.WorkItemStatus.DONE },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:01:00.000Z"),
        });
        state.auditLogs.push(logA, logB);
        const manager = createMockEntityManager(state);
        const result = await (0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logB.id, PROJECT_ID);
        strict_1.default.equal(result.restoredTask.status, work_item_entity_1.WorkItemStatus.IN_PROGRESS);
        strict_1.default.equal(task.status, work_item_entity_1.WorkItemStatus.IN_PROGRESS);
        strict_1.default.equal(logB.isUndone, true);
        strict_1.default.equal(logA.isUndone, false);
    });
    // Case 3: Reject Undo of older event while newer conflicting event remains active
    (0, node_test_1.test)("3. rejects Undo of Backlog -> In Progress while newer In Progress -> Done remains active", async () => {
        const state = setupInitialState();
        const task = state.workItems[0];
        task.status = work_item_entity_1.WorkItemStatus.DONE;
        const logA = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: 'Updated work item "Create login page"',
            previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:00:00.000Z"),
        });
        const logB = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000102",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: 'Updated work item "Create login page"',
            previousState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            newState: { status: work_item_entity_1.WorkItemStatus.DONE },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:01:00.000Z"),
        });
        state.auditLogs.push(logA, logB);
        const manager = createMockEntityManager(state);
        await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError &&
            err.statusCode === 400 &&
            err.message.includes("Undo the most recent change first"));
        // Verify task and audit log remain unchanged
        strict_1.default.equal(task.status, work_item_entity_1.WorkItemStatus.DONE);
        strict_1.default.equal(logA.isUndone, false);
        strict_1.default.equal(logB.isUndone, false);
    });
    // Case 4: Allow earlier event to become eligible after newer event has been undone
    (0, node_test_1.test)("4. allows earlier event to become eligible after newer event is undone", async () => {
        const state = setupInitialState();
        const task = state.workItems[0];
        task.status = work_item_entity_1.WorkItemStatus.DONE;
        const logA = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: 'Updated work item "Create login page"',
            previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:00:00.000Z"),
        });
        const logB = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000102",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: 'Updated work item "Create login page"',
            previousState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            newState: { status: work_item_entity_1.WorkItemStatus.DONE },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:01:00.000Z"),
        });
        state.auditLogs.push(logA, logB);
        const manager = createMockEntityManager(state);
        // Step 1: Undo Log B
        const resultB = await (0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logB.id, PROJECT_ID);
        strict_1.default.equal(resultB.restoredTask.status, work_item_entity_1.WorkItemStatus.IN_PROGRESS);
        strict_1.default.equal(task.status, work_item_entity_1.WorkItemStatus.IN_PROGRESS);
        strict_1.default.equal(logB.isUndone, true);
        // Step 2: Log A becomes eligible and can now be undone
        const resultA = await (0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID);
        strict_1.default.equal(resultA.restoredTask.status, work_item_entity_1.WorkItemStatus.BACKLOG);
        strict_1.default.equal(task.status, work_item_entity_1.WorkItemStatus.BACKLOG);
        strict_1.default.equal(logA.isUndone, true);
    });
    // Case 5: Reject Undo when selected event's resulting field value no longer matches current state
    (0, node_test_1.test)("5. rejects Undo when selected event resulting state does not match current task state", async () => {
        const state = setupInitialState();
        const task = state.workItems[0];
        // Task status was modified to BLOCKED out-of-band
        task.status = work_item_entity_1.WorkItemStatus.BLOCKED;
        const logA = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: 'Updated work item "Create login page"',
            previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:00:00.000Z"),
        });
        state.auditLogs.push(logA);
        const manager = createMockEntityManager(state);
        await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError &&
            err.statusCode === 400 &&
            err.message.includes("Undo the most recent change first"));
        strict_1.default.equal(task.status, work_item_entity_1.WorkItemStatus.BLOCKED);
        strict_1.default.equal(logA.isUndone, false);
    });
    // Case 6: Preserve newer changes to unrelated fields when safe field-level restoration is supported
    (0, node_test_1.test)("6. preserves newer changes to unrelated fields during field-level restoration", async () => {
        const state = setupInitialState();
        const task = state.workItems[0];
        task.status = work_item_entity_1.WorkItemStatus.IN_PROGRESS;
        task.priority = work_item_entity_1.WorkItemPriority.URGENT;
        // Log A changed status from BACKLOG to IN_PROGRESS (priority remained MEDIUM)
        const logA = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: 'Updated work item "Create login page"',
            previousState: {
                status: work_item_entity_1.WorkItemStatus.BACKLOG,
                priority: work_item_entity_1.WorkItemPriority.MEDIUM,
            },
            newState: {
                status: work_item_entity_1.WorkItemStatus.IN_PROGRESS,
                priority: work_item_entity_1.WorkItemPriority.MEDIUM,
            },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:00:00.000Z"),
        });
        // Log B changed priority from MEDIUM to URGENT (status remained IN_PROGRESS)
        const logB = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000102",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: 'Updated work item "Create login page"',
            previousState: {
                status: work_item_entity_1.WorkItemStatus.IN_PROGRESS,
                priority: work_item_entity_1.WorkItemPriority.MEDIUM,
            },
            newState: {
                status: work_item_entity_1.WorkItemStatus.IN_PROGRESS,
                priority: work_item_entity_1.WorkItemPriority.URGENT,
            },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:01:00.000Z"),
        });
        state.auditLogs.push(logA, logB);
        const manager = createMockEntityManager(state);
        // Undoing Log A (status change) should preserve Log B's priority change (URGENT)
        const result = await (0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID);
        strict_1.default.equal(result.restoredTask.status, work_item_entity_1.WorkItemStatus.BACKLOG);
        strict_1.default.equal(result.restoredTask.priority, work_item_entity_1.WorkItemPriority.URGENT);
        strict_1.default.equal(task.status, work_item_entity_1.WorkItemStatus.BACKLOG);
        strict_1.default.equal(task.priority, work_item_entity_1.WorkItemPriority.URGENT);
        strict_1.default.equal(logA.isUndone, true);
    });
    // Case 7: Reject already-undone events
    (0, node_test_1.test)("7. rejects already-undone audit events", async () => {
        const state = setupInitialState();
        const logA = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: "Test update",
            previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            isUndone: true,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:00:00.000Z"),
        });
        state.auditLogs.push(logA);
        const manager = createMockEntityManager(state);
        await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError &&
            err.statusCode === 400 &&
            err.code === "ALREADY_UNDONE");
    });
    // Case 8: Reject unsupported event types
    (0, node_test_1.test)("8. rejects unsupported event types", async () => {
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
            const log = Object.assign(new audit_log_entity_1.AuditLog(), {
                id: `00000000-0000-4000-8000-${Math.random().toString(36).substring(2, 14).padEnd(12, "0")}`,
                organizationId: ORG_ID,
                projectId: PROJECT_ID,
                userId: LEAD_ID,
                action,
                entityType: "task",
                entityId: TASK_ID,
                description: `Action ${action}`,
                previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
                newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
                isUndone: false,
                trustedForUndo: false,
                createdAt: new Date(),
            });
            state.auditLogs.push(log);
            const manager = createMockEntityManager(state);
            await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError &&
                err.statusCode === 400 &&
                err.code === "ACTION_NOT_REVERSIBLE");
        }
    });
    // Case 9: Reject missing or malformed historical state
    (0, node_test_1.test)("9. rejects missing or malformed historical state", async () => {
        const malformedConfigs = [
            { previousState: null, newState: { status: "DONE" } },
            { previousState: { status: "BACKLOG" }, newState: null },
            { previousState: [1, 2], newState: { status: "DONE" } },
            { previousState: "string", newState: { status: "DONE" } },
            { previousState: { status: "SAME" }, newState: { status: "SAME" } }, // No changes
        ];
        for (const config of malformedConfigs) {
            const state = setupInitialState();
            const log = Object.assign(new audit_log_entity_1.AuditLog(), {
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
            await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError &&
                err.statusCode === 400 &&
                err.code === "ACTION_NOT_REVERSIBLE");
        }
    });
    // Case 10: Reject Undo when target work item has been deleted
    (0, node_test_1.test)("10. rejects Undo when target work item has been deleted", async () => {
        const state = setupInitialState();
        // Delete the work item
        state.workItems = [];
        const log = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: "Test update",
            previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date(),
        });
        state.auditLogs.push(log);
        const manager = createMockEntityManager(state);
        await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError &&
            err.statusCode === 404 &&
            err.code === "WORK_ITEM_NOT_FOUND");
    });
    // Case 11: Handle missing sprint, label, parent, or assignee references safely
    (0, node_test_1.test)("11. rejects Undo when stored sprint, label, parent, or assignee reference is invalid", async () => {
        // Missing Sprint
        {
            const state = setupInitialState();
            const task = state.workItems[0];
            task.sprintId = "00000000-0000-4000-8000-000000000021";
            const log = Object.assign(new audit_log_entity_1.AuditLog(), {
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
            await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError &&
                err.statusCode === 400 &&
                err.message.includes("stored sprint is unavailable"));
        }
        // Missing Label
        {
            const state = setupInitialState();
            const task = state.workItems[0];
            task.labelId = "00000000-0000-4000-8000-000000000031";
            const log = Object.assign(new audit_log_entity_1.AuditLog(), {
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
            await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError &&
                err.statusCode === 400 &&
                err.message.includes("stored label is unavailable"));
        }
        // Missing Parent Work Item
        {
            const state = setupInitialState();
            const task = state.workItems[0];
            task.parentWorkItemId = "00000000-0000-4000-8000-000000000041";
            const log = Object.assign(new audit_log_entity_1.AuditLog(), {
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
            await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError &&
                err.statusCode === 400 &&
                err.message.includes("stored parent work item is unavailable"));
        }
        // Assignee no longer in project
        {
            const state = setupInitialState();
            const task = state.workItems[0];
            // Assignee OTHER_USER_ID is not a member of PROJECT_ID
            const log = Object.assign(new audit_log_entity_1.AuditLog(), {
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
            await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError &&
                err.statusCode === 400 &&
                err.code === "INVALID_ASSIGNEE");
        }
    });
    // Case 12: Reject unauthorized and cross-organization requests
    (0, node_test_1.test)("12. rejects unauthorized and cross-organization requests", async () => {
        // Cross-organization
        {
            const state = setupInitialState();
            const log = Object.assign(new audit_log_entity_1.AuditLog(), {
                id: "00000000-0000-4000-8000-000000000101",
                organizationId: "99999999-9999-4000-8000-999999999999",
                projectId: PROJECT_ID,
                userId: LEAD_ID,
                action: "updated",
                entityType: "task",
                entityId: TASK_ID,
                description: "Test update",
                previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
                newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
                isUndone: false,
                trustedForUndo: true,
                createdAt: new Date(),
            });
            state.auditLogs.push(log);
            const manager = createMockEntityManager(state);
            await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError && err.statusCode === 403);
        }
        // User is MEMBER (not LEAD or ADMIN)
        {
            const state = setupInitialState();
            const task = state.workItems[0];
            task.status = work_item_entity_1.WorkItemStatus.IN_PROGRESS;
            const log = Object.assign(new audit_log_entity_1.AuditLog(), {
                id: "00000000-0000-4000-8000-000000000101",
                organizationId: ORG_ID,
                projectId: PROJECT_ID,
                userId: MEMBER_ID,
                action: "updated",
                entityType: "task",
                entityId: TASK_ID,
                description: "Test update",
                previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
                newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
                isUndone: false,
                trustedForUndo: true,
                createdAt: new Date(),
            });
            state.auditLogs.push(log);
            const manager = createMockEntityManager(state);
            await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: MEMBER_ID, organizationId: ORG_ID, role: user_entity_1.UserRole.TEAMMATE }, log.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError && err.statusCode === 403);
        }
        // Target work item belongs to different project than requestedProjectId
        {
            const state = setupInitialState();
            const log = Object.assign(new audit_log_entity_1.AuditLog(), {
                id: "00000000-0000-4000-8000-000000000101",
                organizationId: ORG_ID,
                projectId: PROJECT_ID,
                userId: LEAD_ID,
                action: "updated",
                entityType: "task",
                entityId: TASK_ID,
                description: "Test update",
                previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
                newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
                isUndone: false,
                trustedForUndo: true,
                createdAt: new Date(),
            });
            state.auditLogs.push(log);
            const manager = createMockEntityManager(state);
            await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, log.id, "00000000-0000-4000-8000-999999999999"), (err) => err instanceof app_error_1.AppError && err.statusCode === 403);
        }
    });
    // Case 13: Prevent duplicate concurrent reversals
    (0, node_test_1.test)("13. prevents duplicate concurrent reversals", async () => {
        const state = setupInitialState();
        const task = state.workItems[0];
        task.status = work_item_entity_1.WorkItemStatus.IN_PROGRESS;
        const logA = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: "Test update",
            previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date(),
        });
        state.auditLogs.push(logA);
        const manager = createMockEntityManager(state);
        // First request succeeds
        await (0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID);
        strict_1.default.equal(logA.isUndone, true);
        // Concurrent second request discovers logA is now undone
        await strict_1.default.rejects((0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID), (err) => err instanceof app_error_1.AppError &&
            err.statusCode === 400 &&
            err.code === "ALREADY_UNDONE");
    });
    // Case 14 & 17: Roll back transaction if restoration fails & task is not modified
    (0, node_test_1.test)("14 & 17. rolls back changes and does not modify task or mark audit log when restoration fails", async () => {
        const state = setupInitialState();
        const task = state.workItems[0];
        task.status = work_item_entity_1.WorkItemStatus.IN_PROGRESS;
        const backupState = cloneDbState(state);
        // Stored sprint does not exist
        const logA = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: "Test update",
            previousState: {
                status: work_item_entity_1.WorkItemStatus.BACKLOG,
                sprintId: "00000000-0000-4000-8000-999999999999",
            },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS, sprintId: null },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date(),
        });
        state.auditLogs.push(logA);
        const manager = createMockEntityManager(state);
        let failed = false;
        try {
            await (0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID);
        }
        catch {
            failed = true;
        }
        strict_1.default.ok(failed, "Expected undo operation to fail");
        // In a real transaction rollback, state remains at backup
        strict_1.default.equal(logA.isUndone, false);
        strict_1.default.equal(logA.undoneAt, undefined);
        strict_1.default.equal(task.status, work_item_entity_1.WorkItemStatus.IN_PROGRESS);
    });
    // Case 15: Reversal-audit creation and original isUndone updates are atomic
    (0, node_test_1.test)("15. atomic reversal log creation and targetLog update", async () => {
        const state = setupInitialState();
        const task = state.workItems[0];
        task.status = work_item_entity_1.WorkItemStatus.IN_PROGRESS;
        const logA = Object.assign(new audit_log_entity_1.AuditLog(), {
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
        const result = await (0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, logA.id, PROJECT_ID);
        strict_1.default.equal(logA.isUndone, true);
        strict_1.default.equal(logA.reversalLogId, result.reversalLog.id);
        strict_1.default.equal(result.reversalLog.entityId, TASK_ID);
        strict_1.default.equal(result.reversalLog.action, "undone");
        strict_1.default.equal(result.reversalLog.isUndone, false);
        strict_1.default.deepEqual(result.reversalLog.previousState, { title: "Create login page" });
        strict_1.default.deepEqual(result.reversalLog.newState, { title: "Old Title" });
    });
    // Case 16: Ensure an unrelated task's update does not invalidate selected task's Undo
    (0, node_test_1.test)("16. update to an unrelated task does not invalidate selected task Undo", async () => {
        const state = setupInitialState();
        const task1 = state.workItems[0];
        task1.status = work_item_entity_1.WorkItemStatus.IN_PROGRESS;
        // Create an unrelated task 2
        const TASK_2_ID = "00000000-0000-4000-8000-000000000020";
        const task2 = Object.assign(new work_item_entity_1.WorkItem(), {
            id: TASK_2_ID,
            projectId: PROJECT_ID,
            organizationId: ORG_ID,
            createdById: ADMIN_ID,
            title: "Unrelated Task 2",
            status: work_item_entity_1.WorkItemStatus.IN_PROGRESS,
        });
        state.workItems.push(task2);
        const log1 = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: "Task 1 update",
            previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:00:00.000Z"),
        });
        // Log 2 is newer and for Task 2
        const log2 = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000102",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_2_ID,
            description: "Task 2 update",
            previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date("2026-10-30T00:05:00.000Z"),
        });
        state.auditLogs.push(log1, log2);
        const manager = createMockEntityManager(state);
        // Undoing Task 1's log1 must succeed despite newer log2 for Task 2
        const result = await (0, auditlog_controller_1.executeAuditUndo)(manager, { id: LEAD_ID, organizationId: ORG_ID }, log1.id, PROJECT_ID);
        strict_1.default.equal(result.restoredTask.status, work_item_entity_1.WorkItemStatus.BACKLOG);
        strict_1.default.equal(task1.status, work_item_entity_1.WorkItemStatus.BACKLOG);
        strict_1.default.equal(log1.isUndone, true);
        strict_1.default.equal(log2.isUndone, false);
    });
    // Test Express controller undoAuditLog contract
    (0, node_test_1.test)("undoAuditLog Express handler returns contract expected by frontend", async () => {
        const state = setupInitialState();
        const task = state.workItems[0];
        task.status = work_item_entity_1.WorkItemStatus.IN_PROGRESS;
        const logA = Object.assign(new audit_log_entity_1.AuditLog(), {
            id: "00000000-0000-4000-8000-000000000101",
            organizationId: ORG_ID,
            projectId: PROJECT_ID,
            userId: LEAD_ID,
            action: "updated",
            entityType: "task",
            entityId: TASK_ID,
            description: "Updated status",
            previousState: { status: work_item_entity_1.WorkItemStatus.BACKLOG },
            newState: { status: work_item_entity_1.WorkItemStatus.IN_PROGRESS },
            isUndone: false,
            trustedForUndo: true,
            createdAt: new Date(),
        });
        state.auditLogs.push(logA);
        // Mock AppDataSource.transaction
        const originalTransaction = data_source_1.AppDataSource.transaction;
        data_source_1.AppDataSource.transaction = async (cb) => {
            const m = createMockEntityManager(state);
            return cb(m);
        };
        try {
            const req = {
                params: { logId: logA.id, projectId: PROJECT_ID },
                user: { id: LEAD_ID, organizationId: ORG_ID, role: user_entity_1.UserRole.TEAMMATE },
            };
            let responseStatus = 0;
            let responseBody = null;
            const res = {
                status: (code) => {
                    responseStatus = code;
                    return res;
                },
                json: (data) => {
                    responseBody = data;
                    return res;
                },
            };
            await (0, auditlog_controller_1.undoAuditLog)(req, res);
            strict_1.default.equal(responseStatus, 200);
            strict_1.default.equal(responseBody.success, true);
            strict_1.default.equal(responseBody.message, "Action undone successfully.");
            strict_1.default.equal(responseBody.data.undoneLogId, logA.id);
            strict_1.default.ok(responseBody.data.reversalLog);
            strict_1.default.equal(responseBody.data.reversalLog.action, "undone");
            strict_1.default.ok(responseBody.data.restoredTask);
            strict_1.default.equal(responseBody.data.restoredTask.status, work_item_entity_1.WorkItemStatus.BACKLOG);
        }
        finally {
            data_source_1.AppDataSource.transaction = originalTransaction;
        }
    });
});
