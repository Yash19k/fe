"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkItemSlaAudit = exports.getWorkItemSla = exports.resolveWorkItemEscalation = exports.escalateWorkItem = exports.deleteWorkItem = exports.uploadAttachmentsToWorkItem = exports.getProjectWorkItems = exports.updateWorkItem = exports.createWorkItem = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../config/data.source");
const work_item_entity_1 = require("../entities/work.item.entity");
const work_item_assignee_entity_1 = require("../entities/work.item-assignee.entity");
const work_item_comment_entity_1 = require("../entities/work.item.comment.entity");
const work_item_time_entry_entity_1 = require("../entities/work.item.time.entry.entity");
const work_item_attachment_entity_1 = require("../entities/work.item.attachment.entity");
const work_item_dependency_entity_1 = require("../entities/work.item.dependency.entity");
const audit_log_entity_1 = require("../entities/audit.log.entity");
const work_item_attachment_service_1 = require("../services/work.item.attachment.service");
const app_error_1 = require("../errors/app.error");
const notification_entity_1 = require("../entities/notification.entity");
const notification_service_1 = require("../services/notification.service");
const sla_service_1 = require("../services/sla.service");
const project_permission_1 = require("../middleware/project.permission");
const pagination_1 = require("../utils/pagination");
const work_item_service_1 = require("../services/work-item.service");
const work_item_dependency_service_1 = require("../services/work-item-dependency.service");
function requireUserId(req) {
    const userId = req.user?.id;
    if (!userId) {
        throw new app_error_1.AppError("Authentication required", 401, "UNAUTHORIZED");
    }
    return userId;
}
function requireWorkItemId(req) {
    const workItemId = req.params.workItemId;
    if (typeof workItemId !== "string" || !workItemId.trim()) {
        throw new app_error_1.AppError("Invalid work item ID", 400, "INVALID_WORK_ITEM_ID");
    }
    return workItemId;
}
// ==========================================
// CREATE WORK ITEM
// ==========================================
const createWorkItem = async (req, res) => {
    const actor = await (0, work_item_service_1.getActiveActor)(requireUserId(req));
    const body = req.body;
    if (body.slaDeadline !== undefined) {
        await (0, project_permission_1.authorizeProjectPermission)(req, "sla:manage");
    }
    const result = await (0, work_item_service_1.createWorkItemOrchestration)(actor, body);
    res.status(201).json({
        success: true,
        message: "Work item created successfully",
        data: {
            ...result.workItem,
            label: result.label,
            labels: result.labels,
            assignments: result.assignments,
            assigneeIds: result.assigneeIds,
            assigneeId: result.assigneeId,
            assignees: result.assignees,
            recurrence: result.recurrence,
            sla: (0, sla_service_1.getSlaSnapshot)(result.workItem),
        },
    });
};
exports.createWorkItem = createWorkItem;
// ==========================================
// UPDATE WORK ITEM
// ==========================================
const updateWorkItem = async (req, res) => {
    const actor = await (0, work_item_service_1.getActiveActor)(requireUserId(req));
    const workItemId = requireWorkItemId(req);
    const body = req.body;
    if (body.slaDeadline !== undefined) {
        await (0, project_permission_1.authorizeProjectPermission)(req, "sla:manage");
    }
    const result = await (0, work_item_service_1.updateWorkItemOrchestration)(actor, workItemId, body);
    res.status(200).json({
        success: true,
        message: "Work item updated successfully",
        data: result,
    });
};
exports.updateWorkItem = updateWorkItem;
// ==========================================
// LIST PROJECT WORK ITEMS
// ==========================================
const getProjectWorkItems = async (req, res) => {
    const actor = await (0, work_item_service_1.getActiveActor)(requireUserId(req));
    const projectId = req.params.projectId;
    if (typeof projectId !== "string") {
        throw new app_error_1.AppError("Invalid project ID", 400, "INVALID_PROJECT_ID");
    }
    const { page, limit, status, type } = res.locals.validatedWorkItemQuery;
    const project = await (0, work_item_service_1.assertAccessibleProject)(projectId, actor);
    const { skip, take } = (0, pagination_1.getPagination)({ page, limit });
    const query = data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem)
        .createQueryBuilder("workItem")
        .leftJoinAndSelect("workItem.label", "label")
        .where("workItem.projectId = :projectId", {
        projectId: project.id,
    })
        .andWhere("workItem.organizationId = :organizationId", {
        organizationId: actor.organizationId,
    })
        .orderBy("workItem.createdAt", "DESC")
        .addOrderBy("workItem.id", "DESC")
        .skip(skip)
        .take(take);
    if (status) {
        query.andWhere("workItem.status = :status", { status });
    }
    if (type) {
        query.andWhere("workItem.type = :type", { type });
    }
    const [workItems, total] = await query.getManyAndCount();
    if (workItems.length > 0) {
        const workItemIds = workItems.map((workItem) => workItem.id);
        const [assignments, comments, timeEntries, children, attachments, dependencies] = await Promise.all([
            data_source_1.AppDataSource.getRepository(work_item_assignee_entity_1.WorkItemAssignee).find({
                where: { workItemId: (0, typeorm_1.In)(workItemIds) },
                relations: { user: true },
            }),
            data_source_1.AppDataSource.getRepository(work_item_comment_entity_1.WorkItemComment).find({
                where: { workItemId: (0, typeorm_1.In)(workItemIds) },
            }),
            data_source_1.AppDataSource.getRepository(work_item_time_entry_entity_1.WorkItemTimeEntry).find({
                where: { workItemId: (0, typeorm_1.In)(workItemIds) },
            }),
            data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).find({
                where: { parentWorkItemId: (0, typeorm_1.In)(workItemIds) },
            }),
            data_source_1.AppDataSource.getRepository(work_item_attachment_entity_1.WorkItemAttachment).find({
                where: { workItemId: (0, typeorm_1.In)(workItemIds) },
            }),
            data_source_1.AppDataSource.getRepository(work_item_dependency_entity_1.WorkItemDependency).find({
                where: { workItemId: (0, typeorm_1.In)(workItemIds) },
                order: { id: "ASC" },
            }),
        ]);
        const assignmentsByWorkItem = new Map();
        for (const assignment of assignments) {
            const current = assignmentsByWorkItem.get(assignment.workItemId) ?? [];
            current.push(assignment);
            assignmentsByWorkItem.set(assignment.workItemId, current);
        }
        const commentsByWorkItem = new Map();
        for (const comment of comments) {
            const current = commentsByWorkItem.get(comment.workItemId) ?? [];
            current.push(comment);
            commentsByWorkItem.set(comment.workItemId, current);
        }
        const timeEntriesByWorkItem = new Map();
        for (const entry of timeEntries) {
            const current = timeEntriesByWorkItem.get(entry.workItemId) ?? [];
            current.push(entry);
            timeEntriesByWorkItem.set(entry.workItemId, current);
        }
        const childrenByParent = new Map();
        for (const child of children) {
            if (!child.parentWorkItemId)
                continue;
            const current = childrenByParent.get(child.parentWorkItemId) ?? [];
            current.push(child);
            childrenByParent.set(child.parentWorkItemId, current);
        }
        const attachmentsByWorkItem = new Map();
        for (const attachment of attachments) {
            const current = attachmentsByWorkItem.get(attachment.workItemId) ?? [];
            current.push(attachment);
            attachmentsByWorkItem.set(attachment.workItemId, current);
        }
        const dependenciesByWorkItem = new Map();
        for (const dependency of dependencies) {
            const current = dependenciesByWorkItem.get(dependency.workItemId) ?? [];
            current.push(dependency);
            dependenciesByWorkItem.set(dependency.workItemId, current);
        }
        for (const workItem of workItems) {
            workItem.assignments = assignmentsByWorkItem.get(workItem.id) ?? [];
            workItem.comments = commentsByWorkItem.get(workItem.id) ?? [];
            workItem.timeEntries = timeEntriesByWorkItem.get(workItem.id) ?? [];
            workItem.children = childrenByParent.get(workItem.id) ?? [];
            workItem.attachments = attachmentsByWorkItem.get(workItem.id) ?? [];
            workItem.dependencies = dependenciesByWorkItem.get(workItem.id) ?? [];
        }
    }
    for (const workItem of workItems) {
        if (!workItem.priority) {
            (0, work_item_service_1.clearSlaState)(workItem);
            continue;
        }
        if (!workItem.slaDeadline) {
            workItem.slaDeadline = (0, sla_service_1.calculateSlaDeadline)(workItem.createdAt, workItem.priority);
            workItem.slaDeadlineIsCustom = false;
        }
        (0, sla_service_1.applySlaState)(workItem);
    }
    res.status(200).json({
        success: true,
        message: "Project work items retrieved successfully",
        data: {
            projectId: project.id,
            workItems,
            pagination: (0, pagination_1.getPaginationMeta)({
                page,
                limit,
                total,
            }),
        },
    });
};
exports.getProjectWorkItems = getProjectWorkItems;
// ==========================================
// UPLOAD ATTACHMENTS
// ==========================================
const uploadAttachmentsToWorkItem = async (req, res) => {
    const actor = await (0, work_item_service_1.getActiveActor)(requireUserId(req));
    const workItem = await (0, work_item_service_1.getAccessibleWorkItem)(requireWorkItemId(req), actor);
    const uploadedFiles = req.files || [];
    if (uploadedFiles.length === 0) {
        throw new app_error_1.AppError("At least one attachment is required.", 400, "ATTACHMENT_REQUIRED");
    }
    const attachments = await (0, work_item_attachment_service_1.uploadAndPersistWorkItemAttachments)(uploadedFiles, workItem.id, actor.id);
    res.status(201).json({
        success: true,
        attachments,
    });
};
exports.uploadAttachmentsToWorkItem = uploadAttachmentsToWorkItem;
// ==========================================
// DELETE WORK ITEM
// ==========================================
const deleteWorkItem = async (req, res) => {
    const actor = await (0, work_item_service_1.getActiveActor)(requireUserId(req));
    const workItemId = requireWorkItemId(req);
    await data_source_1.AppDataSource.transaction(async (manager) => {
        const reference = await manager.getRepository(work_item_entity_1.WorkItem).findOne({
            where: { id: workItemId, organizationId: actor.organizationId },
            select: { id: true, projectId: true },
        });
        if (!reference) {
            throw new app_error_1.AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
        }
        await (0, work_item_dependency_service_1.lockProjectSchedule)(manager, reference.projectId, actor.organizationId);
        const workItem = await manager
            .getRepository(work_item_entity_1.WorkItem)
            .createQueryBuilder("workItem")
            .where("workItem.id = :workItemId", { workItemId })
            .andWhere("workItem.organizationId = :organizationId", {
            organizationId: actor.organizationId,
        })
            .setLock("pessimistic_write")
            .getOne();
        if (!workItem) {
            throw new app_error_1.AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
        }
        await (0, work_item_service_1.assertAccessibleProject)(workItem.projectId, actor, manager);
        const assignments = await manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).find({
            where: { workItemId: workItem.id },
            select: { userId: true },
        });
        await manager.getRepository(audit_log_entity_1.AuditLog).save(manager.getRepository(audit_log_entity_1.AuditLog).create({
            organizationId: workItem.organizationId,
            projectId: workItem.projectId,
            userId: actor.id,
            action: "deleted",
            entityType: "task",
            entityId: workItem.id,
            description: `Deleted work item "${workItem.title}"`,
            previousState: {
                title: workItem.title,
                type: workItem.type,
                status: workItem.status,
                priority: workItem.priority,
                assigneeIds: assignments.map((assignment) => assignment.userId),
            },
            newState: null,
            trustedForUndo: false,
        }));
        await manager.getRepository(work_item_entity_1.WorkItem).remove(workItem);
    });
    res.status(200).json({
        success: true,
        message: "Work item deleted successfully",
        data: { id: workItemId },
    });
};
exports.deleteWorkItem = deleteWorkItem;
// ==========================================
// ESCALATE WORK ITEM
// ==========================================
const escalateWorkItem = async (req, res) => {
    const actor = await (0, work_item_service_1.getActiveActor)(requireUserId(req));
    const workItemId = requireWorkItemId(req);
    const reason = req.body?.reason === undefined || req.body.reason === null
        ? null
        : String(req.body.reason).trim();
    if (reason && reason.length > 500) {
        throw new app_error_1.AppError("Escalation reason must be 500 characters or fewer", 400, "INVALID_ESCALATION_REASON");
    }
    const result = await data_source_1.AppDataSource.transaction(async (manager) => {
        const workItem = await manager
            .getRepository(work_item_entity_1.WorkItem)
            .createQueryBuilder("workItem")
            .where("workItem.id = :workItemId", { workItemId })
            .andWhere("workItem.organizationId = :organizationId", {
            organizationId: actor.organizationId,
        })
            .setLock("pessimistic_write")
            .getOne();
        if (!workItem) {
            throw new app_error_1.AppError("Work item not found", 404, "WORK_ITEM_NOT_FOUND");
        }
        await (0, work_item_service_1.assertAccessibleProject)(workItem.projectId, actor, manager);
        if (!workItem.priority) {
            throw new app_error_1.AppError("Cannot escalate a work item without a priority", 400, "WORK_ITEM_PRIORITY_REQUIRED");
        }
        if (workItem.escalatedAt) {
            (0, sla_service_1.applySlaState)(workItem);
            return { workItem, alreadyEscalated: true };
        }
        const previous = {
            status: workItem.slaStatus,
            escalatedAt: workItem.escalatedAt,
            reason: workItem.escalationReason,
        };
        await (0, sla_service_1.ensureSlaData)(workItem, manager);
        workItem.escalatedAt = new Date();
        workItem.escalatedById = actor.id;
        workItem.escalationReason = reason;
        workItem.slaStatus = work_item_entity_1.SlaStatus.ESCALATED;
        const saved = await manager.getRepository(work_item_entity_1.WorkItem).save(workItem);
        await (0, sla_service_1.writeSlaAudit)(manager, saved, actor.id, "escalated", "Escalated work item", previous, { status: saved.slaStatus, escalatedAt: saved.escalatedAt, reason });
        return { workItem: saved, alreadyEscalated: false };
    });
    if (!result.alreadyEscalated) {
        try {
            const assignments = await data_source_1.AppDataSource.getRepository(work_item_assignee_entity_1.WorkItemAssignee).find({
                where: { workItemId: result.workItem.id },
                select: { userId: true },
            });
            const recipients = new Set([
                ...assignments.map((assignment) => assignment.userId),
                result.workItem.createdById,
            ]);
            recipients.delete(actor.id);
            await Promise.all([...recipients].map((userId) => notification_service_1.notificationService.createNotification({
                userId,
                organizationId: actor.organizationId,
                type: notification_entity_1.NotificationType.SLA_ESCALATED,
                title: "SLA escalation",
                message: `"${result.workItem.title}" has been escalated because of its SLA status.`,
                workItemId: result.workItem.id,
                projectId: result.workItem.projectId,
                link: `/tasks/${result.workItem.id}`,
                metadata: {
                    reason: result.workItem.escalationReason,
                    escalatedAt: result.workItem.escalatedAt?.toISOString() ?? null,
                },
            })));
        }
        catch (err) {
            console.error("Escalation notification failed:", err);
        }
    }
    res.status(200).json({
        success: true,
        message: result.alreadyEscalated
            ? "Work item is already escalated"
            : "Work item escalated successfully",
        data: {
            ...result.workItem,
            sla: (0, sla_service_1.getSlaSnapshot)(result.workItem),
            alreadyEscalated: result.alreadyEscalated,
        },
    });
};
exports.escalateWorkItem = escalateWorkItem;
// ==========================================
// RESOLVE WORK ITEM ESCALATION
// ==========================================
const resolveWorkItemEscalation = async (req, res) => {
    const actor = await (0, work_item_service_1.getActiveActor)(requireUserId(req));
    const workItemId = requireWorkItemId(req);
    const workItem = await data_source_1.AppDataSource.transaction(async (manager) => {
        const item = await manager
            .getRepository(work_item_entity_1.WorkItem)
            .createQueryBuilder("workItem")
            .where("workItem.id = :workItemId", { workItemId })
            .andWhere("workItem.organizationId = :organizationId", {
            organizationId: actor.organizationId,
        })
            .setLock("pessimistic_write")
            .getOne();
        if (!item) {
            throw new app_error_1.AppError("Work item not found", 404, "WORK_ITEM_NOT_FOUND");
        }
        await (0, work_item_service_1.assertAccessibleProject)(item.projectId, actor, manager);
        const previous = {
            status: item.slaStatus,
            escalatedAt: item.escalatedAt,
            reason: item.escalationReason,
        };
        item.escalatedAt = null;
        item.escalatedById = null;
        item.escalationReason = null;
        item.slaResolvedAt = new Date();
        if (!item.priority) {
            (0, work_item_service_1.clearSlaState)(item);
        }
        else {
            (0, sla_service_1.applySlaState)(item);
        }
        const saved = await manager.getRepository(work_item_entity_1.WorkItem).save(item);
        await (0, sla_service_1.writeSlaAudit)(manager, saved, actor.id, "sla_escalation_resolved", "Resolved work item escalation", previous, { status: saved.slaStatus, resolvedAt: saved.slaResolvedAt });
        return saved;
    });
    res.status(200).json({
        success: true,
        message: "Work item escalation resolved successfully",
        data: { ...workItem, sla: (0, sla_service_1.getSlaSnapshot)(workItem) },
    });
};
exports.resolveWorkItemEscalation = resolveWorkItemEscalation;
// ==========================================
// GET WORK ITEM SLA
// ==========================================
const getWorkItemSla = async (req, res) => {
    const actor = await (0, work_item_service_1.getActiveActor)(requireUserId(req));
    const workItem = await (0, work_item_service_1.getAccessibleWorkItem)(requireWorkItemId(req), actor);
    if (!workItem.priority) {
        (0, work_item_service_1.clearSlaState)(workItem);
    }
    else {
        (0, sla_service_1.applySlaState)(workItem);
    }
    res.status(200).json({
        success: true,
        data: {
            workItemId: workItem.id,
            projectId: workItem.projectId,
            sla: (0, sla_service_1.getSlaSnapshot)(workItem),
        },
    });
};
exports.getWorkItemSla = getWorkItemSla;
// ==========================================
// GET WORK ITEM SLA AUDIT
// ==========================================
const getWorkItemSlaAudit = async (req, res) => {
    const actor = await (0, work_item_service_1.getActiveActor)(requireUserId(req));
    const workItem = await (0, work_item_service_1.getAccessibleWorkItem)(requireWorkItemId(req), actor);
    const logs = await data_source_1.AppDataSource.getRepository(audit_log_entity_1.AuditLog).find({
        where: {
            organizationId: actor.organizationId,
            projectId: workItem.projectId,
            entityType: "work_item",
            entityId: workItem.id,
        },
        relations: { user: true },
        order: { createdAt: "DESC" },
        take: 150,
    });
    res.status(200).json({
        success: true,
        data: logs
            .filter((log) => log.action === "escalated" || log.action.startsWith("sla_"))
            .map((log) => ({
            id: log.id,
            action: log.action,
            description: log.description,
            previousState: log.previousState,
            newState: log.newState,
            actorId: log.userId,
            actorName: log.user?.fullName || log.user?.email || "Unknown user",
            createdAt: log.createdAt,
        })),
    });
};
exports.getWorkItemSlaAudit = getWorkItemSlaAudit;
