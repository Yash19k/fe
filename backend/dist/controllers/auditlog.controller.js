"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
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
const app_error_1 = require("../errors/app.error");
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
async function createAuditLog(req, res) {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    const { action, entityType, entityId, previousState, newState } = req.body;
    if (!userId || !organizationId) {
        throw new app_error_1.AppError("Authentication and organization context required.", 401, "UNAUTHORIZED");
    }
    let pId = req.body.projectId ||
        (req.params.projectId && req.params.projectId !== "audit-logs"
            ? req.params.projectId
            : null);
    const desc = req.body.description ||
        req.body.details?.description ||
        `${action || ""} ${entityType || ""}`.trim() ||
        "Activity";
    if (!action || !entityType) {
        throw new app_error_1.AppError("action and entityType are required.", 400, "VALIDATION_ERROR");
    }
    // If pId is missing and this is a task event, attempt to resolve from WorkItem record
    if (!pId && entityType === "task" && entityId) {
        try {
            const task = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).findOne({
                where: { id: String(entityId), organizationId },
                select: { id: true, projectId: true },
            });
            if (task?.projectId) {
                pId = task.projectId;
            }
        }
        catch {
            // non-uuid entityId
        }
    }
    if (pId) {
        await assertAuditProjectAccess(String(pId), userId, organizationId, req.user?.role);
    }
    const repo = data_source_1.AppDataSource.getRepository(audit_log_entity_1.AuditLog);
    const log = await repo.save(repo.create({
        organizationId,
        projectId: pId ? String(pId) : null,
        userId,
        action: String(action),
        entityType: String(entityType),
        entityId: String(entityId || ""),
        description: String(desc),
        previousState: previousState || req.body.details?.previousValue || null,
        newState: newState || req.body.details?.newValue || null,
    }));
    return res.status(201).json({
        success: true,
        data: {
            ...log,
            timestamp: log.createdAt,
        },
    });
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
        const auditRepo = manager.getRepository(audit_log_entity_1.AuditLog);
        const targetLog = await auditRepo
            .createQueryBuilder("audit")
            .setLock("pessimistic_write")
            .where("audit.id = :logId", { logId })
            .getOne();
        if (!targetLog) {
            throw new app_error_1.AppError("Audit log entry not found.", 404, "AUDIT_LOG_NOT_FOUND");
        }
        if (targetLog.organizationId !== organizationId) {
            throw new app_error_1.AppError("Access denied.", 403, "FORBIDDEN");
        }
        if (requestedProjectId &&
            targetLog.projectId &&
            targetLog.projectId !== requestedProjectId) {
            throw new app_error_1.AppError("Audit log does not belong to specified project.", 403, "FORBIDDEN");
        }
        // Require project-level update permissions
        if (targetLog.projectId && req.user?.role !== user_entity_1.UserRole.ADMIN) {
            const membership = await manager.getRepository(project_member_entity_1.ProjectMember).findOne({
                where: { projectId: targetLog.projectId, userId },
            });
            if (!membership ||
                ![project_member_entity_1.ProjectRole.ADMIN, project_member_entity_1.ProjectRole.LEAD].includes(membership.role)) {
                throw new app_error_1.AppError("You must be a project administrator or lead to undo actions.", 403, "FORBIDDEN");
            }
        }
        if (targetLog.isUndone) {
            throw new app_error_1.AppError("This action has already been undone.", 400, "ALREADY_UNDONE");
        }
        if (!targetLog.previousState ||
            targetLog.action.toLowerCase() === "undone" ||
            targetLog.action.toLowerCase() === "deleted") {
            throw new app_error_1.AppError("This action cannot be undone.", 400, "ACTION_NOT_REVERSIBLE");
        }
        let restoredTask = null;
        if (targetLog.entityType === "task") {
            const workItemRepo = manager.getRepository(work_item_entity_1.WorkItem);
            const workItem = await workItemRepo.findOne({
                where: { id: targetLog.entityId, organizationId },
            });
            if (!workItem) {
                throw new app_error_1.AppError("Target work item no longer exists.", 404, "WORK_ITEM_NOT_FOUND");
            }
            if (targetLog.projectId && workItem.projectId !== targetLog.projectId) {
                throw new app_error_1.AppError("Target work item does not match audit project.", 403, "FORBIDDEN");
            }
            const prev = targetLog.previousState;
            if (prev.title !== undefined && prev.title !== null) {
                workItem.title = String(prev.title).trim();
            }
            if (prev.description !== undefined) {
                workItem.description = prev.description
                    ? String(prev.description).trim()
                    : null;
            }
            if (prev.status !== undefined && prev.status !== null) {
                const normStatus = String(prev.status)
                    .toUpperCase()
                    .replace(/[-\s]/g, "_");
                if (Object.values(work_item_entity_1.WorkItemStatus).includes(normStatus)) {
                    workItem.status = normStatus;
                }
            }
            if (prev.priority !== undefined && prev.priority !== null) {
                const normPriority = String(prev.priority).toUpperCase();
                if (Object.values(work_item_entity_1.WorkItemPriority).includes(normPriority)) {
                    workItem.priority = normPriority;
                }
            }
            if (prev.type !== undefined && prev.type !== null) {
                const normType = String(prev.type).toUpperCase();
                if (Object.values(work_item_entity_1.WorkItemType).includes(normType)) {
                    workItem.type = normType;
                }
            }
            if (prev.dueDate !== undefined) {
                workItem.dueDate = prev.dueDate ? new Date(prev.dueDate) : null;
            }
            if (prev.parentWorkItemId !== undefined || prev.parentId !== undefined) {
                workItem.parentWorkItemId =
                    prev.parentWorkItemId || prev.parentId || null;
            }
            await workItemRepo.save(workItem);
            if (prev.assigneeId !== undefined ||
                prev.assignees !== undefined ||
                prev.assigneeIds !== undefined) {
                const assigneeRepo = manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee);
                await assigneeRepo.delete({ workItemId: workItem.id });
                let userIds = [];
                if (Array.isArray(prev.assignees)) {
                    userIds = prev.assignees
                        .map((a) => (typeof a === "string" ? a : a.userId || a.id))
                        .filter(Boolean);
                }
                else if (Array.isArray(prev.assigneeIds)) {
                    userIds = prev.assigneeIds.filter(Boolean);
                }
                else if (prev.assigneeId) {
                    userIds = [prev.assigneeId];
                }
                if (userIds.length > 0) {
                    const assigneeEntities = userIds.map((uId) => assigneeRepo.create({
                        workItemId: workItem.id,
                        userId: uId,
                        assignedById: userId,
                    }));
                    await assigneeRepo.save(assigneeEntities);
                }
            }
            const assignments = await manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).find({
                where: { workItemId: workItem.id },
            });
            restoredTask = {
                ...workItem,
                assignments,
                assigneeIds: assignments.map((a) => a.userId),
                assigneeId: assignments[0]?.userId || null,
            };
        }
        const reversalDesc = `Undid change: ${targetLog.description || targetLog.action}`;
        const reversalLog = await auditRepo.save(auditRepo.create({
            organizationId: targetLog.organizationId,
            projectId: targetLog.projectId,
            userId: userId,
            action: "undone",
            entityType: targetLog.entityType,
            entityId: targetLog.entityId,
            description: reversalDesc,
            previousState: targetLog.newState,
            newState: targetLog.previousState,
            isUndone: false,
        }));
        targetLog.isUndone = true;
        targetLog.undoneAt = new Date();
        targetLog.undoneById = userId;
        targetLog.reversalLogId = reversalLog.id;
        await auditRepo.save(targetLog);
        return {
            targetLog,
            reversalLog,
            restoredTask,
        };
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
        try {
            const projectTasks = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).find({
                where: { projectId, organizationId },
                select: { id: true, title: true },
            });
            projectTaskIds = projectTasks.map((t) => t.id);
        }
        catch {
            // Gracefully continue
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
            qb.andWhere("(audit.projectId = :projectId OR (audit.entityType = 'task' AND audit.entityId IN (:...projectTaskIds)))", { projectId, projectTaskIds });
        }
        else {
            qb.andWhere("audit.projectId = :projectId", { projectId });
        }
    }
    const total = await qb.getCount();
    const logs = await qb.skip(skip).take(limit).getMany();
    const taskIds = logs
        .filter((l) => l.entityType === "task" && l.entityId)
        .map((l) => l.entityId);
    const taskMap = {};
    if (taskIds.length > 0) {
        try {
            const foundTasks = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).find({
                where: { id: (0, typeorm_1.In)(taskIds), organizationId },
                select: { id: true, title: true },
            });
            foundTasks.forEach((t) => {
                taskMap[t.id] = t.title;
            });
        }
        catch {
            // In case of non-uuid entityId, gracefully continue
        }
    }
    return res.json({
        success: true,
        data: logs.map((l) => {
            let entityTitle = null;
            if (l.entityType === "task") {
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
            const canUndo = !l.isUndone &&
                Boolean(l.previousState) &&
                l.action !== "undone" &&
                l.action !== "UNDONE" &&
                l.action !== "deleted" &&
                l.action !== "DELETED" &&
                (l.entityType !== "task" || Boolean(taskMap[l.entityId]));
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
            .filter((log) => log.entityType === "task" && log.entityId)
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
            entityTitle: (log.entityType === "task"
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
