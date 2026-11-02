"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRACKED_FIELDS = void 0;
exports.isWorkItemEntityType = isWorkItemEntityType;
exports.createAuditLog = createAuditLog;
exports.executeAuditUndo = executeAuditUndo;
exports.undoAuditLog = undoAuditLog;
exports.getProjectAuditLogs = getProjectAuditLogs;
exports.getMyAuditLogs = getMyAuditLogs;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../config/data.source");
const audit_log_entity_1 = require("../entities/audit.log.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const project_entity_1 = require("../entities/project.entity");
const user_entity_1 = require("../entities/user.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const work_item_assignee_entity_1 = require("../entities/work.item-assignee.entity");
const sprint_entities_1 = require("../entities/sprint.entities");
const project_label_entity_1 = require("../entities/project.label.entity");
const app_error_1 = require("../errors/app.error");
const work_item_service_1 = require("../services/work-item.service");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
exports.TRACKED_FIELDS = [
    "title",
    "description",
    "businessGoal",
    "successCriteria",
    "acceptanceCriteria",
    "severity",
    "stepsToReproduce",
    "expectedBehavior",
    "actualBehavior",
    "environment",
    "estimatedHours",
    "status",
    "priority",
    "type",
    "dueDate",
    "plannedStartDate",
    "plannedDurationWorkingDays",
    "isSchedulePinned",
    "parentWorkItemId",
    "sprintId",
    "labelId",
    "assigneeIds",
];
function isWorkItemEntityType(entityType) {
    const norm = String(entityType || "").toLowerCase();
    return norm === "task" || norm === "work_item";
}
function normalizeStringValue(val) {
    if (val === null || val === undefined)
        return null;
    const s = String(val).trim();
    return s.length > 0 ? s : null;
}
function normalizeStatusValue(val) {
    if (val === null || val === undefined)
        return null;
    return String(val).toUpperCase().replace(/[-\s]/g, "_");
}
function normalizePriorityValue(val) {
    if (val === null || val === undefined)
        return null;
    return String(val).toUpperCase();
}
function normalizeTypeValue(val) {
    if (val === null || val === undefined)
        return null;
    return String(val).toUpperCase();
}
function normalizeDateValue(val) {
    if (val === null || val === undefined)
        return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.getTime();
}
function normalizeUuidValue(val) {
    if (val === null || val === undefined)
        return null;
    const s = String(val).trim();
    return UUID_PATTERN.test(s) ? s : null;
}
function normalizeAssigneeIds(state) {
    if (state.assigneeIds !== undefined) {
        if (Array.isArray(state.assigneeIds)) {
            return state.assigneeIds
                .map((a) => (typeof a === "string" ? a : a?.userId || a?.id))
                .filter((id) => typeof id === "string" && UUID_PATTERN.test(id))
                .sort();
        }
        if (state.assigneeIds === null)
            return [];
    }
    if (state.assignees !== undefined) {
        if (Array.isArray(state.assignees)) {
            return state.assignees
                .map((a) => (typeof a === "string" ? a : a?.userId || a?.id))
                .filter((id) => typeof id === "string" && UUID_PATTERN.test(id))
                .sort();
        }
        if (state.assignees === null)
            return [];
    }
    if (state.assigneeId !== undefined) {
        if (typeof state.assigneeId === "string" && UUID_PATTERN.test(state.assigneeId)) {
            return [state.assigneeId];
        }
        if (state.assigneeId === null)
            return [];
    }
    return undefined;
}
function getFieldFromSnapshot(field, state) {
    switch (field) {
        case "title":
            return normalizeStringValue(state.title);
        case "description":
            return normalizeStringValue(state.description);
        case "status":
            return normalizeStatusValue(state.status);
        case "priority":
            return normalizePriorityValue(state.priority);
        case "type":
            return normalizeTypeValue(state.type);
        case "dueDate":
            return normalizeDateValue(state.dueDate);
        case "plannedStartDate":
            return normalizeStringValue(state.plannedStartDate);
        case "plannedDurationWorkingDays":
            return state.plannedDurationWorkingDays != null ? Number(state.plannedDurationWorkingDays) : null;
        case "isSchedulePinned":
            return state.isSchedulePinned != null ? Boolean(state.isSchedulePinned) : false;
        case "parentWorkItemId":
            return normalizeUuidValue(state.parentWorkItemId ?? state.parentId);
        case "sprintId":
            return normalizeUuidValue(state.sprintId);
        case "labelId":
            return normalizeUuidValue(state.labelId);
        case "assigneeIds":
            return normalizeAssigneeIds(state);
        case "businessGoal":
            return normalizeStringValue(state.businessGoal);
        case "successCriteria":
            return normalizeStringValue(state.successCriteria);
        case "acceptanceCriteria":
            return normalizeStringValue(state.acceptanceCriteria);
        case "severity":
            return normalizeStringValue(state.severity ?? state.bugSeverity);
        case "stepsToReproduce":
            return normalizeStringValue(state.stepsToReproduce);
        case "expectedBehavior":
            return normalizeStringValue(state.expectedBehavior);
        case "actualBehavior":
            return normalizeStringValue(state.actualBehavior);
        case "environment":
            return normalizeStringValue(state.environment);
        case "estimatedHours":
            return state.estimatedHours != null ? String(state.estimatedHours).trim() : null;
        default:
            return state[field];
    }
}
function getCurrentWorkItemField(field, workItem, currentAssigneeIds) {
    switch (field) {
        case "title":
            return normalizeStringValue(workItem.title);
        case "description":
            return normalizeStringValue(workItem.description);
        case "status":
            return normalizeStatusValue(workItem.status);
        case "priority":
            return normalizePriorityValue(workItem.priority);
        case "type":
            return normalizeTypeValue(workItem.type);
        case "dueDate":
            return normalizeDateValue(workItem.dueDate);
        case "plannedStartDate":
            return normalizeStringValue(workItem.plannedStartDate);
        case "plannedDurationWorkingDays":
            return workItem.plannedDurationWorkingDays != null
                ? Number(workItem.plannedDurationWorkingDays)
                : null;
        case "isSchedulePinned":
            return Boolean(workItem.isSchedulePinned);
        case "parentWorkItemId":
            return normalizeUuidValue(workItem.parentWorkItemId);
        case "sprintId":
            return normalizeUuidValue(workItem.sprintId);
        case "labelId":
            return normalizeUuidValue(workItem.labelId);
        case "assigneeIds":
            return [...currentAssigneeIds].sort();
        case "businessGoal":
            return normalizeStringValue(workItem.businessGoal);
        case "successCriteria":
            return normalizeStringValue(workItem.successCriteria);
        case "acceptanceCriteria":
            return normalizeStringValue(workItem.acceptanceCriteria);
        case "severity":
            return normalizeStringValue(workItem.severity);
        case "stepsToReproduce":
            return normalizeStringValue(workItem.stepsToReproduce);
        case "expectedBehavior":
            return normalizeStringValue(workItem.expectedBehavior);
        case "actualBehavior":
            return normalizeStringValue(workItem.actualBehavior);
        case "environment":
            return normalizeStringValue(workItem.environment);
        case "estimatedHours":
            return workItem.estimatedHours != null
                ? String(workItem.estimatedHours).trim()
                : null;
        default:
            return workItem[field];
    }
}
function areFieldValuesEqual(field, valA, valB) {
    if (field === "assigneeIds") {
        if (valA === undefined && valB === undefined)
            return true;
        if (valA === undefined || valB === undefined)
            return false;
        if (!Array.isArray(valA) && !Array.isArray(valB))
            return true;
        if (!Array.isArray(valA) || !Array.isArray(valB))
            return false;
        if (valA.length !== valB.length)
            return false;
        for (let i = 0; i < valA.length; i++) {
            if (valA[i] !== valB[i])
                return false;
        }
        return true;
    }
    return valA === valB;
}
function getMutatedFieldsFromLog(prevObj, newObj) {
    const mutated = [];
    for (const field of exports.TRACKED_FIELDS) {
        const hasPrev = field === "assigneeIds"
            ? prevObj.assigneeIds !== undefined ||
                prevObj.assignees !== undefined ||
                prevObj.assigneeId !== undefined
            : prevObj[field] !== undefined ||
                (field === "parentWorkItemId" && prevObj.parentId !== undefined);
        const hasNew = field === "assigneeIds"
            ? newObj.assigneeIds !== undefined ||
                newObj.assignees !== undefined ||
                newObj.assigneeId !== undefined
            : newObj[field] !== undefined ||
                (field === "parentWorkItemId" && newObj.parentId !== undefined);
        if (!hasPrev && !hasNew)
            continue;
        const prevVal = getFieldFromSnapshot(field, prevObj);
        const newVal = getFieldFromSnapshot(field, newObj);
        if (!areFieldValuesEqual(field, prevVal, newVal)) {
            mutated.push(field);
        }
    }
    return mutated;
}
function snapshotString(value, field, nullable = false) {
    if (nullable && value === null)
        return null;
    if (typeof value !== "string") {
        throw new app_error_1.AppError(`The stored ${field} value is invalid.`, 400, "ACTION_NOT_REVERSIBLE");
    }
    return value;
}
/**
 * Validates that the user has access to read the project's audit logs.
 */
async function assertAuditProjectAccess(projectId, userId, organizationId, role) {
    const project = await data_source_1.AppDataSource.getRepository(project_entity_1.Project).findOne({
        where: { id: projectId, organizationId },
    });
    if (!project) {
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    if (role === user_entity_1.UserRole.ADMIN) {
        return project;
    }
    const membership = await data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember).findOne({
        where: { projectId, userId },
    });
    if (!membership && project.visibility !== "PUBLIC") {
        throw new app_error_1.AppError("You do not have access to this project's audit logs.", 403, "FORBIDDEN");
    }
    return project;
}
async function createAuditLog(_req, _res) {
    throw new app_error_1.AppError("Audit entries must be created by server-side operations.", 403, "FORBIDDEN");
}
async function executeAuditUndo(manager, actor, logId, requestedProjectId) {
    const auditRepo = manager.getRepository(audit_log_entity_1.AuditLog);
    const targetLog = await auditRepo
        .createQueryBuilder("audit")
        .setLock("pessimistic_write")
        .where("audit.id = :logId", { logId })
        .getOne();
    if (!targetLog) {
        throw new app_error_1.AppError("Audit log entry not found.", 404, "AUDIT_LOG_NOT_FOUND");
    }
    if (targetLog.organizationId !== actor.organizationId) {
        throw new app_error_1.AppError("Access denied.", 403, "FORBIDDEN");
    }
    if (targetLog.isUndone) {
        throw new app_error_1.AppError("This action has already been undone.", 400, "ALREADY_UNDONE");
    }
    if (targetLog.action.toLowerCase() === "undone" ||
        targetLog.action.toLowerCase() === "deleted" ||
        targetLog.action.toLowerCase() !== "updated") {
        throw new app_error_1.AppError("This action cannot be undone.", 400, "ACTION_NOT_REVERSIBLE");
    }
    if (!targetLog.trustedForUndo) {
        throw new app_error_1.AppError("This audit entry was not created by a trusted server mutation.", 400, "ACTION_NOT_REVERSIBLE");
    }
    if (!isWorkItemEntityType(targetLog.entityType) || !targetLog.projectId) {
        throw new app_error_1.AppError("This audit entry has no verifiable task project and cannot be undone.", 400, "ACTION_NOT_REVERSIBLE");
    }
    if (!UUID_PATTERN.test(targetLog.entityId)) {
        throw new app_error_1.AppError("This audit entry has an invalid task identifier.", 400, "ACTION_NOT_REVERSIBLE");
    }
    // Consistent locking order: AuditLog locked first, WorkItem locked second
    const workItemRepo = manager.getRepository(work_item_entity_1.WorkItem);
    const workItem = await workItemRepo
        .createQueryBuilder("workItem")
        .setLock("pessimistic_write")
        .where("workItem.id = :workItemId", { workItemId: targetLog.entityId })
        .andWhere("workItem.organizationId = :organizationId", {
        organizationId: actor.organizationId,
    })
        .getOne();
    if (!workItem) {
        throw new app_error_1.AppError("Target work item no longer exists.", 404, "WORK_ITEM_NOT_FOUND");
    }
    if (workItem.projectId !== targetLog.projectId ||
        (requestedProjectId && requestedProjectId !== workItem.projectId)) {
        throw new app_error_1.AppError("Audit entry does not match the target work item's project.", 403, "FORBIDDEN");
    }
    // Require project-level update permissions
    if (targetLog.projectId && actor.role !== user_entity_1.UserRole.ADMIN) {
        const membership = await manager.getRepository(project_member_entity_1.ProjectMember).findOne({
            where: { projectId: targetLog.projectId, userId: actor.id },
        });
        if (!membership ||
            ![project_member_entity_1.ProjectRole.ADMIN, project_member_entity_1.ProjectRole.LEAD].includes(membership.role)) {
            throw new app_error_1.AppError("You must be a project administrator or lead to undo actions.", 403, "FORBIDDEN");
        }
    }
    if (!targetLog.previousState ||
        typeof targetLog.previousState !== "object" ||
        Array.isArray(targetLog.previousState) ||
        !targetLog.newState ||
        typeof targetLog.newState !== "object" ||
        Array.isArray(targetLog.newState)) {
        throw new app_error_1.AppError("This action cannot be undone.", 400, "ACTION_NOT_REVERSIBLE");
    }
    const prevObj = targetLog.previousState;
    const newObj = targetLog.newState;
    const affectedFields = getMutatedFieldsFromLog(prevObj, newObj);
    if (affectedFields.length === 0) {
        throw new app_error_1.AppError("This action cannot be undone.", 400, "ACTION_NOT_REVERSIBLE");
    }
    const currentAssignments = await manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).find({
        where: { workItemId: workItem.id },
    });
    const currentAssigneeIds = currentAssignments.map((a) => a.userId);
    // Validate that current work item state still matches the state produced by targetLog
    for (const field of affectedFields) {
        const currentVal = getCurrentWorkItemField(field, workItem, currentAssigneeIds);
        const expectedVal = getFieldFromSnapshot(field, newObj);
        if (!areFieldValuesEqual(field, currentVal, expectedVal)) {
            throw new app_error_1.AppError("This action can no longer be undone directly because the task has changed since then. Undo the most recent change first.", 400, "ACTION_NOT_REVERSIBLE");
        }
    }
    // Retrieve chronological active audit history for this work item
    const allLogs = await manager.getRepository(audit_log_entity_1.AuditLog).find({
        where: {
            entityId: workItem.id,
            organizationId: actor.organizationId,
        },
        order: {
            createdAt: "ASC",
            id: "ASC",
        },
    });
    const targetIdx = allLogs.findIndex((l) => l.id === targetLog.id);
    const subsequentLogs = targetIdx >= 0 ? allLogs.slice(targetIdx + 1) : [];
    for (const subLog of subsequentLogs) {
        // Skip already undone logs and reversal records
        if (subLog.isUndone)
            continue;
        if (subLog.action.toLowerCase() === "undone")
            continue;
        if (subLog.action.toLowerCase() === "deleted") {
            throw new app_error_1.AppError("This action can no longer be undone directly because the task has changed since then. Undo the most recent change first.", 400, "ACTION_NOT_REVERSIBLE");
        }
        let subMutatedFields = [];
        if (subLog.action.toLowerCase() === "schedule_reflow") {
            subMutatedFields = ["plannedStartDate", "dueDate"];
        }
        else if (subLog.previousState &&
            subLog.newState &&
            typeof subLog.previousState === "object" &&
            typeof subLog.newState === "object" &&
            !Array.isArray(subLog.previousState) &&
            !Array.isArray(subLog.newState)) {
            subMutatedFields = getMutatedFieldsFromLog(subLog.previousState, subLog.newState);
        }
        else {
            throw new app_error_1.AppError("This action can no longer be undone directly because the task has changed since then. Undo the most recent change first.", 400, "ACTION_NOT_REVERSIBLE");
        }
        const hasConflict = subMutatedFields.some((f) => affectedFields.includes(f));
        if (hasConflict) {
            throw new app_error_1.AppError("This action can no longer be undone directly because the task has changed since then. Undo the most recent change first.", 400, "ACTION_NOT_REVERSIBLE");
        }
    }
    // Safely restore only the affected fields
    let assigneesChanged = false;
    for (const field of affectedFields) {
        switch (field) {
            case "title": {
                if (typeof prevObj.title !== "string" || !prevObj.title.trim()) {
                    throw new app_error_1.AppError("The stored title value is invalid.", 400, "ACTION_NOT_REVERSIBLE");
                }
                workItem.title = prevObj.title.trim();
                break;
            }
            case "description": {
                workItem.description = prevObj.description
                    ? String(prevObj.description).trim()
                    : null;
                break;
            }
            case "status": {
                if (prevObj.status === undefined || prevObj.status === null) {
                    throw new app_error_1.AppError("The stored status value is invalid.", 400, "ACTION_NOT_REVERSIBLE");
                }
                const normStatus = String(prevObj.status)
                    .toUpperCase()
                    .replace(/[-\s]/g, "_");
                if (!Object.values(work_item_entity_1.WorkItemStatus).includes(normStatus)) {
                    throw new app_error_1.AppError("The stored status value is invalid.", 400, "ACTION_NOT_REVERSIBLE");
                }
                workItem.status = normStatus;
                break;
            }
            case "priority": {
                if (prevObj.priority === null || prevObj.priority === undefined) {
                    workItem.priority = null;
                }
                else {
                    const normPriority = String(prevObj.priority).toUpperCase();
                    if (!Object.values(work_item_entity_1.WorkItemPriority).includes(normPriority)) {
                        throw new app_error_1.AppError("The stored priority value is invalid.", 400, "ACTION_NOT_REVERSIBLE");
                    }
                    workItem.priority = normPriority;
                }
                break;
            }
            case "type": {
                if (prevObj.type === undefined || prevObj.type === null) {
                    throw new app_error_1.AppError("The stored type value is invalid.", 400, "ACTION_NOT_REVERSIBLE");
                }
                const normType = String(prevObj.type).toUpperCase();
                if (!Object.values(work_item_entity_1.WorkItemType).includes(normType)) {
                    throw new app_error_1.AppError("The stored type value is invalid.", 400, "ACTION_NOT_REVERSIBLE");
                }
                workItem.type = normType;
                break;
            }
            case "dueDate": {
                if (prevObj.dueDate === null || prevObj.dueDate === undefined) {
                    workItem.dueDate = null;
                }
                else {
                    const d = new Date(prevObj.dueDate);
                    if (isNaN(d.getTime())) {
                        throw new app_error_1.AppError("The stored due date value is invalid.", 400, "ACTION_NOT_REVERSIBLE");
                    }
                    workItem.dueDate = d;
                }
                break;
            }
            case "plannedStartDate": {
                workItem.plannedStartDate = prevObj.plannedStartDate
                    ? String(prevObj.plannedStartDate).trim()
                    : null;
                break;
            }
            case "plannedDurationWorkingDays": {
                workItem.plannedDurationWorkingDays =
                    prevObj.plannedDurationWorkingDays != null
                        ? Number(prevObj.plannedDurationWorkingDays)
                        : null;
                break;
            }
            case "isSchedulePinned": {
                workItem.isSchedulePinned = Boolean(prevObj.isSchedulePinned);
                break;
            }
            case "parentWorkItemId": {
                const rawParent = prevObj.parentWorkItemId ?? prevObj.parentId;
                if (rawParent === null || rawParent === undefined) {
                    workItem.parentWorkItemId = null;
                }
                else {
                    const parentId = snapshotString(rawParent, "parent work item ID", true);
                    if (parentId === workItem.id) {
                        throw new app_error_1.AppError("The stored parent work item is invalid.", 400, "ACTION_NOT_REVERSIBLE");
                    }
                    if (parentId) {
                        const parent = await manager.getRepository(work_item_entity_1.WorkItem).findOne({
                            where: {
                                id: parentId,
                                projectId: workItem.projectId,
                                organizationId: actor.organizationId,
                            },
                            select: { id: true },
                        });
                        if (!parent) {
                            throw new app_error_1.AppError("The stored parent work item is unavailable.", 400, "ACTION_NOT_REVERSIBLE");
                        }
                    }
                    workItem.parentWorkItemId = parentId;
                }
                break;
            }
            case "sprintId": {
                const rawSprint = prevObj.sprintId;
                if (rawSprint === null || rawSprint === undefined) {
                    workItem.sprintId = null;
                }
                else {
                    const sprintId = snapshotString(rawSprint, "sprint ID", true);
                    if (sprintId) {
                        const sprint = await manager.getRepository(sprint_entities_1.Sprint).findOne({
                            where: { id: sprintId, projectId: workItem.projectId },
                            select: { id: true },
                        });
                        if (!sprint) {
                            throw new app_error_1.AppError("The stored sprint is unavailable.", 400, "ACTION_NOT_REVERSIBLE");
                        }
                    }
                    workItem.sprintId = sprintId;
                }
                break;
            }
            case "labelId": {
                const rawLabel = prevObj.labelId;
                if (rawLabel === null || rawLabel === undefined) {
                    workItem.labelId = null;
                }
                else {
                    const labelId = snapshotString(rawLabel, "label ID", true);
                    if (labelId) {
                        const label = await manager.getRepository(project_label_entity_1.ProjectLabel).findOne({
                            where: { id: labelId, projectId: workItem.projectId },
                            select: { id: true },
                        });
                        if (!label) {
                            throw new app_error_1.AppError("The stored label is unavailable.", 400, "ACTION_NOT_REVERSIBLE");
                        }
                    }
                    workItem.labelId = labelId;
                }
                break;
            }
            case "assigneeIds": {
                const rawAssignees = normalizeAssigneeIds(prevObj);
                const userIds = rawAssignees || [];
                if (userIds.length > 0) {
                    await (0, work_item_service_1.validateAssignees)(userIds.map((assigneeId) => ({ userId: assigneeId })), workItem.projectId, actor.organizationId, manager);
                }
                const assigneeRepo = manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee);
                await assigneeRepo.delete({ workItemId: workItem.id });
                if (userIds.length > 0) {
                    const assigneeEntities = userIds.map((assigneeId) => assigneeRepo.create({
                        workItemId: workItem.id,
                        userId: assigneeId,
                        assignedById: actor.id,
                    }));
                    await assigneeRepo.save(assigneeEntities);
                }
                assigneesChanged = true;
                break;
            }
            case "businessGoal": {
                workItem.businessGoal = prevObj.businessGoal
                    ? String(prevObj.businessGoal).trim()
                    : null;
                break;
            }
            case "successCriteria": {
                workItem.successCriteria = prevObj.successCriteria
                    ? String(prevObj.successCriteria).trim()
                    : null;
                break;
            }
            case "acceptanceCriteria": {
                workItem.acceptanceCriteria = prevObj.acceptanceCriteria
                    ? String(prevObj.acceptanceCriteria).trim()
                    : null;
                break;
            }
            case "severity": {
                workItem.severity = prevObj.severity
                    ? String(prevObj.severity).trim()
                    : null;
                break;
            }
            case "stepsToReproduce": {
                workItem.stepsToReproduce = prevObj.stepsToReproduce
                    ? String(prevObj.stepsToReproduce).trim()
                    : null;
                break;
            }
            case "expectedBehavior": {
                workItem.expectedBehavior = prevObj.expectedBehavior
                    ? String(prevObj.expectedBehavior).trim()
                    : null;
                break;
            }
            case "actualBehavior": {
                workItem.actualBehavior = prevObj.actualBehavior
                    ? String(prevObj.actualBehavior).trim()
                    : null;
                break;
            }
            case "environment": {
                workItem.environment = prevObj.environment
                    ? String(prevObj.environment).trim()
                    : null;
                break;
            }
            case "estimatedHours": {
                workItem.estimatedHours =
                    prevObj.estimatedHours != null
                        ? String(prevObj.estimatedHours).trim()
                        : null;
                break;
            }
        }
    }
    await workItemRepo.save(workItem);
    const reversalDesc = `Undid change: ${targetLog.description || targetLog.action}`;
    const reversalLog = await auditRepo.save(auditRepo.create({
        organizationId: targetLog.organizationId,
        projectId: targetLog.projectId,
        userId: actor.id,
        action: "undone",
        entityType: targetLog.entityType,
        entityId: targetLog.entityId,
        description: reversalDesc,
        previousState: targetLog.newState,
        newState: targetLog.previousState,
        isUndone: false,
        trustedForUndo: false,
    }));
    targetLog.isUndone = true;
    targetLog.undoneAt = new Date();
    targetLog.undoneById = actor.id;
    targetLog.reversalLogId = reversalLog.id;
    await auditRepo.save(targetLog);
    const finalAssignments = assigneesChanged
        ? await manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).find({
            where: { workItemId: workItem.id },
        })
        : currentAssignments;
    const restoredTask = {
        ...workItem,
        assignments: finalAssignments,
        assigneeIds: finalAssignments.map((a) => a.userId),
        assigneeId: finalAssignments[0]?.userId || null,
    };
    return {
        targetLog,
        reversalLog,
        restoredTask,
    };
}
async function undoAuditLog(req, res) {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    const logId = String(req.params.logId);
    const requestedProjectId = req.params.projectId && req.params.projectId !== "audit-logs"
        ? String(req.params.projectId)
        : null;
    if (!userId || !organizationId) {
        throw new app_error_1.AppError("Authentication and organization context required.", 401, "UNAUTHORIZED");
    }
    const result = await data_source_1.AppDataSource.transaction(async (manager) => {
        return executeAuditUndo(manager, { id: userId, organizationId, role: req.user?.role }, logId, requestedProjectId);
    });
    return res.status(200).json({
        success: true,
        message: "Action undone successfully.",
        data: {
            undoneLogId: result.targetLog.id,
            reversalLog: {
                ...result.reversalLog,
                timestamp: result.reversalLog.createdAt,
                actorId: result.reversalLog.userId,
            },
            restoredTask: result.restoredTask,
        },
    });
}
async function getProjectAuditLogs(req, res) {
    const projectId = req.params.projectId
        ? String(req.params.projectId)
        : undefined;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!organizationId || !userId) {
        throw new app_error_1.AppError("Authentication and organization context required.", 401, "UNAUTHORIZED");
    }
    // Parse pagination params
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(150, Math.max(1, Number.parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const skip = (page - 1) * limit;
    // If projectId is supplied, verify access
    let projectTaskIds = [];
    if (projectId) {
        await assertAuditProjectAccess(projectId, userId, organizationId, req.user?.role);
        if (UUID_PATTERN.test(projectId)) {
            const projectTasks = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).find({
                where: { projectId, organizationId },
                select: { id: true, title: true },
            });
            projectTaskIds = projectTasks.map((t) => t.id);
        }
    }
    const auditRepo = data_source_1.AppDataSource.getRepository(audit_log_entity_1.AuditLog);
    const qb = auditRepo
        .createQueryBuilder("audit")
        .leftJoinAndSelect("audit.user", "user")
        .leftJoinAndSelect("audit.project", "project")
        .where("audit.organizationId = :organizationId", { organizationId })
        .orderBy("audit.createdAt", "DESC")
        .addOrderBy("audit.id", "DESC");
    if (projectId) {
        if (projectTaskIds.length > 0) {
            qb.andWhere("(audit.projectId = :projectId OR (audit.entityType IN ('task', 'work_item') AND audit.entityId IN (:...projectTaskIds)))", { projectId, projectTaskIds });
        }
        else {
            qb.andWhere("audit.projectId = :projectId", { projectId });
        }
    }
    const total = await qb.getCount();
    const logs = await qb.skip(skip).take(limit).getMany();
    const taskIds = logs
        .filter((l) => isWorkItemEntityType(l.entityType) && l.entityId)
        .map((l) => l.entityId);
    const taskMap = {};
    if (taskIds.length > 0) {
        const validTaskIds = taskIds.filter((id) => UUID_PATTERN.test(id));
        if (validTaskIds.length > 0) {
            const foundTasks = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).find({
                where: { id: (0, typeorm_1.In)(validTaskIds), organizationId },
                select: { id: true, title: true },
            });
            foundTasks.forEach((t) => {
                taskMap[t.id] = t.title;
            });
        }
    }
    return res.json({
        success: true,
        data: logs.map((l) => {
            let entityTitle = null;
            if (isWorkItemEntityType(l.entityType)) {
                entityTitle =
                    taskMap[l.entityId] ||
                        l.newState?.title ||
                        l.previousState?.title ||
                        null;
            }
            else if (l.entityType === "project") {
                entityTitle = l.project?.name || null;
            }
            const userName = l.user?.fullName?.trim() || l.user?.email || "Unknown user";
            const canUndo = Boolean(l.trustedForUndo) &&
                !l.isUndone &&
                Boolean(l.previousState) &&
                l.action.toLowerCase() === "updated" &&
                isWorkItemEntityType(l.entityType) &&
                Boolean(taskMap[l.entityId]);
            return {
                id: l.id,
                action: l.action,
                entityType: l.entityType,
                entityId: l.entityId,
                entityTitle,
                description: l.description,
                previousState: l.previousState,
                newState: l.newState,
                previousValue: l.previousState,
                newValue: l.newState,
                canUndo,
                isUndone: Boolean(l.isUndone),
                undoneAt: l.undoneAt || null,
                reversalLogId: l.reversalLogId || null,
                projectId: l.projectId,
                userId: l.userId,
                actorId: l.userId,
                userName,
                actorName: userName,
                userEmail: l.user?.email || null,
                timestamp: l.createdAt,
                createdAt: l.createdAt,
            };
        }),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}
async function getMyAuditLogs(req, res) {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    if (!userId || !organizationId) {
        throw new app_error_1.AppError("Authentication and organization context required.", 401, "UNAUTHORIZED");
    }
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const memberships = await data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember)
        .createQueryBuilder("member")
        .innerJoin("member.project", "project")
        .select("member.projectId", "projectId")
        .where("member.userId = :userId", { userId })
        .andWhere("project.organizationId = :organizationId", {
        organizationId,
    })
        .getRawMany();
    const projectIds = [
        ...new Set(memberships.map((membership) => membership.projectId)),
    ];
    if (projectIds.length === 0) {
        return res.json({
            success: true,
            data: [],
            pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
            },
        });
    }
    const auditRepo = data_source_1.AppDataSource.getRepository(audit_log_entity_1.AuditLog);
    const qb = auditRepo
        .createQueryBuilder("audit")
        .leftJoinAndSelect("audit.project", "project")
        .leftJoinAndSelect("audit.user", "actor")
        .where("audit.organizationId = :organizationId", { organizationId })
        .andWhere("audit.userId = :userId", { userId })
        .andWhere("audit.projectId IN (:...projectIds)", { projectIds })
        .orderBy("audit.createdAt", "DESC")
        .addOrderBy("audit.id", "DESC");
    const total = await qb.getCount();
    const logs = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();
    const taskIds = [
        ...new Set(logs
            .filter((log) => isWorkItemEntityType(log.entityType) && log.entityId)
            .map((log) => log.entityId)),
    ];
    const taskMap = new Map();
    if (taskIds.length > 0) {
        const tasks = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem)
            .createQueryBuilder("task")
            .select(["task.id", "task.title"])
            .where("task.id IN (:...taskIds)", { taskIds })
            .andWhere("task.organizationId = :organizationId", { organizationId })
            .getMany();
        for (const task of tasks) {
            taskMap.set(task.id, task.title);
        }
    }
    return res.status(200).json({
        success: true,
        data: logs.map((log) => ({
            id: log.id,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            entityTitle: (isWorkItemEntityType(log.entityType)
                ? taskMap.get(log.entityId)
                : log.entityType === "project"
                    ? log.project?.name
                    : null) ??
                log.newState?.title ??
                log.previousState?.title ??
                null,
            description: log.description,
            previousState: log.previousState,
            newState: log.newState,
            projectId: log.projectId,
            projectName: log.project?.name ?? null,
            userId: log.userId,
            userName: log.user?.fullName?.trim() || log.user?.email || "Unknown user",
            timestamp: log.createdAt,
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}
