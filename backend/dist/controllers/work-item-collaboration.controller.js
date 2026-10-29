"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addWorkItemComment = addWorkItemComment;
exports.getWorkItemComments = getWorkItemComments;
exports.addWorkItemTimeEntry = addWorkItemTimeEntry;
exports.getWorkItemTimeEntries = getWorkItemTimeEntries;
exports.addWorkItemDependency = addWorkItemDependency;
exports.getWorkItemDependencies = getWorkItemDependencies;
exports.deleteWorkItemDependency = deleteWorkItemDependency;
const data_source_1 = require("../config/data.source");
const work_item_comment_entity_1 = require("../entities/work.item.comment.entity");
const work_item_time_entry_entity_1 = require("../entities/work.item.time.entry.entity");
const work_item_dependency_entity_1 = require("../entities/work.item.dependency.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const user_entity_1 = require("../entities/user.entity");
const app_error_1 = require("../errors/app.error");
/**
 * Validates that the work item exists, belongs to the user's organization,
 * and that the user is authorized to view/access the parent project.
 */
async function assertWorkItemAccess(workItemId, req) {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    if (!userId || !organizationId) {
        throw new app_error_1.AppError("Authentication required.", 401, "UNAUTHORIZED");
    }
    const workItem = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).findOne({
        where: { id: workItemId },
        select: { id: true, projectId: true, organizationId: true },
    });
    if (!workItem || workItem.organizationId !== organizationId) {
        throw new app_error_1.AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }
    // Organization admins have access to all projects in the org
    if (req.user?.role === user_entity_1.UserRole.ADMIN) {
        return workItem;
    }
    // Verify membership in the project
    const membership = await data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember).findOne({
        where: { projectId: workItem.projectId, userId },
    });
    if (!membership) {
        throw new app_error_1.AppError("You do not have access to this work item's project.", 403, "FORBIDDEN");
    }
    return workItem;
}
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
    await assertWorkItemAccess(workItemId, req);
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
    await assertWorkItemAccess(workItemId, req);
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
        : req.body.hours !== undefined
            ? Math.round(Number(req.body.hours) * 60)
            : 0;
    const description = req.body.description || req.body.note || "";
    const startTime = req.body.startTime || req.body.date;
    const userId = req.user?.id;
    const duration = Number(durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
        throw new app_error_1.AppError("durationMinutes or hours must be a positive number.", 400, "VALIDATION_ERROR");
    }
    await assertWorkItemAccess(workItemId, req);
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
    await assertWorkItemAccess(workItemId, req);
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
    const primaryWorkItem = await assertWorkItemAccess(workItemId, req);
    // Verify the dependency target belongs to the same organization and project
    const targetWorkItem = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).findOne({
        where: { id: dependsOnWorkItemId },
        select: { id: true, projectId: true, organizationId: true },
    });
    if (!targetWorkItem ||
        targetWorkItem.organizationId !== primaryWorkItem.organizationId ||
        targetWorkItem.projectId !== primaryWorkItem.projectId) {
        throw new app_error_1.AppError("Dependent work item must exist in the same project and organization.", 400, "INVALID_DEPENDENCY");
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
    await assertWorkItemAccess(workItemId, req);
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
    await assertWorkItemAccess(workItemId, req);
    await data_source_1.AppDataSource.getRepository(work_item_dependency_entity_1.WorkItemDependency).delete({
        workItemId,
        dependsOnWorkItemId: depId,
    });
    return res.json({ success: true });
}
