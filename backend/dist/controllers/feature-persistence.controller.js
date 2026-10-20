"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addWorkItemComment = addWorkItemComment;
exports.getWorkItemComments = getWorkItemComments;
exports.addWorkItemTimeEntry = addWorkItemTimeEntry;
exports.getWorkItemTimeEntries = getWorkItemTimeEntries;
exports.addWorkItemDependency = addWorkItemDependency;
exports.getWorkItemDependencies = getWorkItemDependencies;
exports.deleteWorkItemDependency = deleteWorkItemDependency;
exports.getProjectLabels = getProjectLabels;
exports.createProjectLabel = createProjectLabel;
exports.deleteProjectLabel = deleteProjectLabel;
exports.getProjectWorkflow = getProjectWorkflow;
exports.saveProjectWorkflow = saveProjectWorkflow;
exports.getProjectAuditLogs = getProjectAuditLogs;
exports.createAuditLog = createAuditLog;
exports.getUserNotifications = getUserNotifications;
exports.markNotificationRead = markNotificationRead;
exports.markAllNotificationsRead = markAllNotificationsRead;
exports.createNotification = createNotification;
const data_source_1 = require("../config/data.source");
const work_item_comment_entity_1 = require("../entities/work.item.comment.entity");
const work_item_time_entry_entity_1 = require("../entities/work.item.time.entry.entity");
const project_label_entity_1 = require("../entities/project.label.entity");
const work_item_dependency_entity_1 = require("../entities/work.item.dependency.entity");
const project_workflow_entity_1 = require("../entities/project.workflow.entity");
const audit_log_entity_1 = require("../entities/audit.log.entity");
const notification_entity_1 = require("../entities/notification.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const app_error_1 = require("../errors/app.error");
// ==========================================
// Comments
// ==========================================
async function addWorkItemComment(req, res) {
    const workItemId = String(req.params.workItemId);
    const text = req.body.body || req.body.content || req.body.text;
    const userId = req.user?.id;
    if (!text || typeof text !== "string" || !text.trim()) {
        throw new app_error_1.AppError("Comment body is required.", 400, "VALIDATION_ERROR");
    }
    const workItem = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).findOne({
        where: { id: workItemId },
        select: { id: true, projectId: true, organizationId: true },
    });
    if (!workItem || (req.user?.organizationId && workItem.organizationId !== req.user.organizationId)) {
        throw new app_error_1.AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }
    const commentRepo = data_source_1.AppDataSource.getRepository(work_item_comment_entity_1.WorkItemComment);
    const comment = await commentRepo.save(commentRepo.create({
        workItemId,
        authorId: userId,
        body: text.trim(),
    }));
    return res.status(201).json({
        success: true,
        data: {
            id: comment.id,
            workItemId: comment.workItemId,
            authorId: comment.authorId,
            userId: comment.authorId,
            body: comment.body,
            content: comment.body,
            text: comment.body,
            createdAt: comment.createdAt,
        },
    });
}
async function getWorkItemComments(req, res) {
    const workItemId = String(req.params.workItemId);
    const workItem = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).findOne({
        where: { id: workItemId },
        select: { id: true, projectId: true, organizationId: true },
    });
    if (!workItem || (req.user?.organizationId && workItem.organizationId !== req.user.organizationId)) {
        throw new app_error_1.AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }
    const comments = await data_source_1.AppDataSource.getRepository(work_item_comment_entity_1.WorkItemComment).find({
        where: { workItemId },
        relations: { author: true },
        order: { createdAt: "ASC" },
    });
    return res.json({
        success: true,
        data: comments.map((c) => ({
            id: c.id,
            workItemId: c.workItemId,
            authorId: c.authorId,
            userId: c.authorId,
            authorName: c.author?.fullName || c.author?.email || "User",
            body: c.body,
            content: c.body,
            text: c.body,
            createdAt: c.createdAt,
        })),
    });
}
// ==========================================
// Time Entries
// ==========================================
async function addWorkItemTimeEntry(req, res) {
    const workItemId = String(req.params.workItemId);
    const durationMinutes = req.body.durationMinutes !== undefined
        ? Number(req.body.durationMinutes)
        : (req.body.hours !== undefined ? Math.round(Number(req.body.hours) * 60) : 0);
    const description = req.body.description || req.body.note || "";
    const startTime = req.body.startTime || req.body.date;
    const userId = req.user?.id;
    const duration = Number(durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
        throw new app_error_1.AppError("durationMinutes or hours must be a positive number.", 400, "VALIDATION_ERROR");
    }
    const workItem = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).findOne({
        where: { id: workItemId },
        select: { id: true, projectId: true, organizationId: true },
    });
    if (!workItem) {
        throw new app_error_1.AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }
    const timeEntryRepo = data_source_1.AppDataSource.getRepository(work_item_time_entry_entity_1.WorkItemTimeEntry);
    const entry = await timeEntryRepo.save(timeEntryRepo.create({
        workItemId,
        userId: userId,
        durationMinutes: duration,
        description: description ? String(description).trim() : null,
        startTime: startTime ? new Date(startTime) : new Date(),
    }));
    return res.status(201).json({
        success: true,
        data: {
            id: entry.id,
            workItemId: entry.workItemId,
            userId: entry.userId,
            durationMinutes: entry.durationMinutes,
            hours: Number((entry.durationMinutes / 60).toFixed(2)),
            description: entry.description,
            note: entry.description,
            startTime: entry.startTime,
            createdAt: entry.createdAt,
        },
    });
}
async function getWorkItemTimeEntries(req, res) {
    const workItemId = String(req.params.workItemId);
    const entries = await data_source_1.AppDataSource.getRepository(work_item_time_entry_entity_1.WorkItemTimeEntry).find({
        where: { workItemId },
        relations: { user: true },
        order: { startTime: "DESC" },
    });
    return res.json({
        success: true,
        data: entries.map((e) => ({
            id: e.id,
            workItemId: e.workItemId,
            userId: e.userId,
            userName: e.user?.fullName || e.user?.email || "User",
            durationMinutes: e.durationMinutes,
            hours: Number((e.durationMinutes / 60).toFixed(2)),
            description: e.description,
            note: e.description,
            startTime: e.startTime,
            createdAt: e.createdAt,
        })),
    });
}
// ==========================================
// Dependencies
// ==========================================
async function addWorkItemDependency(req, res) {
    const workItemId = String(req.params.workItemId);
    const dependsOnWorkItemId = String(req.body.dependsOnWorkItemId || "").trim();
    if (!dependsOnWorkItemId) {
        throw new app_error_1.AppError("dependsOnWorkItemId is required.", 400, "VALIDATION_ERROR");
    }
    if (workItemId === dependsOnWorkItemId) {
        throw new app_error_1.AppError("A work item cannot depend on itself.", 400, "INVALID_DEPENDENCY");
    }
    const repo = data_source_1.AppDataSource.getRepository(work_item_dependency_entity_1.WorkItemDependency);
    const existing = await repo.findOne({
        where: { workItemId, dependsOnWorkItemId },
    });
    if (existing) {
        return res.json({ success: true, data: existing });
    }
    const dep = await repo.save(repo.create({
        workItemId,
        dependsOnWorkItemId,
    }));
    return res.status(201).json({ success: true, data: dep });
}
async function getWorkItemDependencies(req, res) {
    const workItemId = String(req.params.workItemId);
    const deps = await data_source_1.AppDataSource.getRepository(work_item_dependency_entity_1.WorkItemDependency).find({
        where: { workItemId },
    });
    return res.json({
        success: true,
        data: deps.map((d) => d.dependsOnWorkItemId),
    });
}
async function deleteWorkItemDependency(req, res) {
    const workItemId = String(req.params.workItemId);
    const depId = String(req.params.depId);
    await data_source_1.AppDataSource.getRepository(work_item_dependency_entity_1.WorkItemDependency).delete({
        workItemId,
        dependsOnWorkItemId: depId,
    });
    return res.json({ success: true });
}
// ==========================================
// Labels
// ==========================================
async function getProjectLabels(req, res) {
    const projectId = String(req.params.projectId);
    const labels = await data_source_1.AppDataSource.getRepository(project_label_entity_1.ProjectLabel).find({
        where: { projectId },
        order: { name: "ASC" },
    });
    return res.json({
        success: true,
        data: labels,
    });
}
async function createProjectLabel(req, res) {
    const projectId = String(req.params.projectId);
    const { name, color, description } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
        throw new app_error_1.AppError("Label name is required.", 400, "VALIDATION_ERROR");
    }
    const repo = data_source_1.AppDataSource.getRepository(project_label_entity_1.ProjectLabel);
    const existing = await repo.findOne({
        where: { projectId, name: name.trim() },
    });
    if (existing) {
        return res.status(200).json({ success: true, data: existing });
    }
    const label = await repo.save(repo.create({
        projectId,
        name: name.trim(),
        color: color ? String(color).trim() : "#3B82F6",
        description: description ? String(description).trim() : null,
    }));
    return res.status(201).json({ success: true, data: label });
}
async function deleteProjectLabel(req, res) {
    const projectId = String(req.params.projectId);
    const labelId = String(req.params.labelId);
    await data_source_1.AppDataSource.getRepository(project_label_entity_1.ProjectLabel).delete({
        id: labelId,
        projectId,
    });
    return res.json({ success: true });
}
// ==========================================
// Workflows
// ==========================================
async function getProjectWorkflow(req, res) {
    const projectId = String(req.params.projectId);
    const workflow = await data_source_1.AppDataSource.getRepository(project_workflow_entity_1.ProjectWorkflow).findOne({
        where: { projectId },
    });
    return res.json({
        success: true,
        data: workflow
            ? {
                ...workflow,
                stages: workflow.statuses,
            }
            : null,
    });
}
async function saveProjectWorkflow(req, res) {
    const projectId = String(req.params.projectId);
    const stages = req.body.stages || req.body.statuses;
    const name = req.body.name ? String(req.body.name).trim() : "Custom Engineering Flow";
    if (!stages || !Array.isArray(stages)) {
        throw new app_error_1.AppError("Workflow stages or statuses array is required.", 400, "VALIDATION_ERROR");
    }
    const repo = data_source_1.AppDataSource.getRepository(project_workflow_entity_1.ProjectWorkflow);
    let workflow = await repo.findOne({ where: { projectId } });
    if (workflow) {
        workflow.name = name;
        workflow.statuses = stages;
        const saved = await repo.save(workflow);
        return res.json({
            success: true,
            data: {
                id: saved.id,
                projectId: saved.projectId,
                name: saved.name,
                statuses: saved.statuses,
                stages: saved.statuses,
                updatedAt: saved.updatedAt,
            },
        });
    }
    else {
        const created = repo.create({
            projectId,
            name,
            statuses: stages,
        });
        const saved = await repo.save(created);
        return res.json({
            success: true,
            data: {
                id: saved.id,
                projectId: saved.projectId,
                name: saved.name,
                statuses: saved.statuses,
                stages: saved.statuses,
                createdAt: saved.createdAt,
            },
        });
    }
}
// ==========================================
// Audit Logs
// ==========================================
async function getProjectAuditLogs(req, res) {
    const projectId = req.params.projectId ? String(req.params.projectId) : undefined;
    const organizationId = req.user?.organizationId;
    const logs = await data_source_1.AppDataSource.getRepository(audit_log_entity_1.AuditLog).find({
        where: projectId ? { projectId, organizationId } : { organizationId },
        relations: { user: true },
        order: { createdAt: "DESC" },
        take: 100,
    });
    return res.json({
        success: true,
        data: logs.map((l) => ({
            id: l.id,
            action: l.action,
            entityType: l.entityType,
            entityId: l.entityId,
            description: l.description,
            previousState: l.previousState,
            newState: l.newState,
            projectId: l.projectId,
            userId: l.userId,
            userName: l.user?.fullName || l.user?.email || "User",
            timestamp: l.createdAt,
        })),
    });
}
async function createAuditLog(req, res) {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    const { action, entityType, entityId, previousState, newState } = req.body;
    const pId = req.body.projectId || (req.params.projectId && req.params.projectId !== "audit-logs" ? req.params.projectId : null);
    const desc = req.body.description || req.body.details?.description || `${action || ""} ${entityType || ""}`.trim() || "Activity";
    if (!action || !entityType) {
        throw new app_error_1.AppError("action and entityType are required.", 400, "VALIDATION_ERROR");
    }
    const repo = data_source_1.AppDataSource.getRepository(audit_log_entity_1.AuditLog);
    const log = await repo.save(repo.create({
        organizationId: organizationId,
        projectId: pId ? String(pId) : null,
        userId: userId,
        action: String(action),
        entityType: String(entityType),
        entityId: String(entityId || ""),
        description: String(desc),
        previousState: previousState || req.body.details?.previousValue || null,
        newState: newState || req.body.details?.newValue || null,
    }));
    return res.status(201).json({
        success: true,
        data: log,
    });
}
// ==========================================
// Notifications
// ==========================================
async function getUserNotifications(req, res) {
    const userId = req.user?.id;
    const notifs = await data_source_1.AppDataSource.getRepository(notification_entity_1.Notification).find({
        where: { userId: userId },
        order: { createdAt: "DESC" },
        take: 50,
    });
    return res.json({
        success: true,
        data: notifs.map((n) => ({
            id: n.id,
            userId: n.userId,
            title: n.title,
            message: n.message,
            read: n.read,
            link: n.link,
            createdAt: n.createdAt,
        })),
    });
}
async function markNotificationRead(req, res) {
    const id = String(req.params.id);
    const userId = req.user?.id;
    await data_source_1.AppDataSource.getRepository(notification_entity_1.Notification).update({ id, userId: userId }, { read: true });
    return res.json({ success: true });
}
async function markAllNotificationsRead(req, res) {
    const userId = req.user?.id;
    await data_source_1.AppDataSource.getRepository(notification_entity_1.Notification).update({ userId: userId }, { read: true });
    return res.json({ success: true });
}
async function createNotification(req, res) {
    const organizationId = req.user?.organizationId;
    const { userId, title, message, link } = req.body;
    if (!title || !message) {
        throw new app_error_1.AppError("title and message are required.", 400, "VALIDATION_ERROR");
    }
    const repo = data_source_1.AppDataSource.getRepository(notification_entity_1.Notification);
    const notif = await repo.save(repo.create({
        userId: userId ? String(userId) : req.user.id,
        organizationId: organizationId,
        title: String(title).trim(),
        message: String(message).trim(),
        link: link ? String(link).trim() : null,
        read: false,
    }));
    return res.status(201).json({
        success: true,
        data: notif,
    });
}
