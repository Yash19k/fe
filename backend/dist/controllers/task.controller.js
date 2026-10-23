"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteWorkItem = exports.updateWorkItem = exports.getProjectWorkItems = exports.createWorkItem = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../config/data.source");
const user_entity_1 = require("../entities/user.entity");
const project_entity_1 = require("../entities/project.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const work_item_assignee_entity_1 = require("../entities/work.item-assignee.entity");
const work_item_recurrence_entity_1 = require("../entities/work.item.recurrence.entity");
const app_error_1 = require("../errors/app.error");
const pagination_1 = require("../utils/pagination");
const isAdmin = (actor) => actor.role === "ADMIN";
function requireUserId(req) {
    const userId = req.user?.id;
    if (typeof userId !== "string" || !userId) {
        throw new app_error_1.AppError("Authentication required", 401, "UNAUTHORIZED");
    }
    return userId;
}
function requireWorkItemId(req) {
    const workItemId = req.params.workItemId;
    if (typeof workItemId !== "string" || !workItemId) {
        throw new app_error_1.AppError("Invalid work item ID", 400, "INVALID_WORK_ITEM_ID");
    }
    return workItemId;
}
async function getActiveActor(userId) {
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: userId },
        select: {
            id: true,
            organizationId: true,
            status: true,
            role: true,
        },
    });
    if (!user) {
        throw new app_error_1.AppError("User not found", 404, "USER_NOT_FOUND");
    }
    if (user.status !== user_entity_1.UserStatus.ACTIVE) {
        throw new app_error_1.AppError("Your account is not active", 403, "ACCOUNT_INACTIVE");
    }
    if (!user.organizationId) {
        throw new app_error_1.AppError("Your account is not associated with an organization", 403, "ORGANIZATION_NOT_FOUND");
    }
    return user;
}
function isValidDateOnly(value) {
    if (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return (!Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value);
}
function validateRecurrence(input) {
    if (!Object.values(work_item_recurrence_entity_1.RecurrenceFrequency).includes(input.frequency)) {
        throw new app_error_1.AppError("Invalid recurrence frequency", 400, "INVALID_RECURRENCE_FREQUENCY");
    }
    const interval = input.interval ?? 1;
    if (!Number.isInteger(interval) || interval < 1) {
        throw new app_error_1.AppError("Recurrence interval must be a positive integer", 400, "INVALID_RECURRENCE_INTERVAL");
    }
    if (!isValidDateOnly(input.startsOn)) {
        throw new app_error_1.AppError("startsOn must be a valid YYYY-MM-DD date", 400, "INVALID_RECURRENCE_START_DATE");
    }
    if (input.endsOn != null &&
        (!isValidDateOnly(input.endsOn) || input.endsOn < input.startsOn)) {
        throw new app_error_1.AppError("endsOn must be a valid date on or after startsOn", 400, "INVALID_RECURRENCE_END_DATE");
    }
    try {
        new Intl.DateTimeFormat("en-US", {
            timeZone: input.timezone ?? "UTC",
        });
    }
    catch {
        throw new app_error_1.AppError("Invalid IANA timezone", 400, "INVALID_RECURRENCE_TIMEZONE");
    }
    if (input.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.WEEKLY) {
        const days = input.daysOfWeek;
        if (!Array.isArray(days) ||
            days.length === 0 ||
            days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
            new Set(days).size !== days.length) {
            throw new app_error_1.AppError("Weekly recurrence requires unique daysOfWeek values from 0 to 6", 400, "INVALID_RECURRENCE_DAYS");
        }
        if (input.monthlyPattern != null ||
            input.dayOfMonth != null) {
            throw new app_error_1.AppError("Monthly recurrence fields cannot be used for weekly recurrence", 400, "INVALID_RECURRENCE_FIELDS");
        }
        return;
    }
    if (input.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.DAILY) {
        if ((input.daysOfWeek != null && input.daysOfWeek.length > 0) ||
            input.monthlyPattern != null ||
            input.dayOfMonth != null) {
            throw new app_error_1.AppError("Daily recurrence cannot contain weekly or monthly fields", 400, "INVALID_RECURRENCE_FIELDS");
        }
        return;
    }
    if (input.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.MONTHLY) {
        if (!input.monthlyPattern ||
            !Object.values(work_item_recurrence_entity_1.MonthlyPattern).includes(input.monthlyPattern)) {
            throw new app_error_1.AppError("Monthly recurrence requires a valid monthlyPattern", 400, "INVALID_MONTHLY_PATTERN");
        }
        if (input.daysOfWeek != null &&
            input.daysOfWeek.length > 0) {
            throw new app_error_1.AppError("daysOfWeek cannot be used for monthly recurrence", 400, "INVALID_RECURRENCE_FIELDS");
        }
        if (input.monthlyPattern === work_item_recurrence_entity_1.MonthlyPattern.DAY_OF_MONTH) {
            if (!Number.isInteger(input.dayOfMonth) ||
                input.dayOfMonth < 1 ||
                input.dayOfMonth > 31) {
                throw new app_error_1.AppError("DAY_OF_MONTH requires dayOfMonth between 1 and 31", 400, "INVALID_DAY_OF_MONTH");
            }
        }
        else if (input.dayOfMonth != null) {
            throw new app_error_1.AppError("dayOfMonth is only valid with DAY_OF_MONTH", 400, "UNEXPECTED_DAY_OF_MONTH");
        }
    }
}
async function assertAccessibleProject(projectId, actor, manager = data_source_1.AppDataSource.manager) {
    const project = await manager
        .getRepository(project_entity_1.Project)
        .createQueryBuilder("project")
        .leftJoin("project.memberships", "membership", "membership.userId = :userId", { userId: actor.id })
        .where("project.id = :projectId", { projectId })
        .andWhere("project.organizationId = :organizationId", { organizationId: actor.organizationId })
        .andWhere(`(
        project.visibility = :publicVisibility
        OR membership.userId = :userId
        OR :isAdmin = true
      )`, {
        publicVisibility: project_entity_1.ProjectVisibility.PUBLIC,
        userId: actor.id,
        isAdmin: isAdmin(actor),
    })
        .getOne();
    if (!project) {
        throw new app_error_1.AppError("Project not found or you do not have access to it", 404, "PROJECT_NOT_FOUND");
    }
    return project;
}
async function getAccessibleWorkItem(workItemId, actor) {
    const workItem = await data_source_1.AppDataSource
        .getRepository(work_item_entity_1.WorkItem)
        .createQueryBuilder("workItem")
        .innerJoin("workItem.project", "project")
        .leftJoin("project.memberships", "membership", "membership.userId = :userId", { userId: actor.id })
        .where("workItem.id = :workItemId", { workItemId })
        .andWhere("workItem.organizationId = :organizationId", { organizationId: actor.organizationId })
        .andWhere("project.organizationId = :organizationId", { organizationId: actor.organizationId })
        .andWhere(`(
        project.visibility = :publicVisibility
        OR membership.userId = :userId
        OR :isAdmin = true
      )`, {
        publicVisibility: project_entity_1.ProjectVisibility.PUBLIC,
        userId: actor.id,
        isAdmin: isAdmin(actor),
    })
        .getOne();
    if (!workItem) {
        throw new app_error_1.AppError("Work item not found or you do not have access to it", 404, "WORK_ITEM_NOT_FOUND");
    }
    return workItem;
}
async function validateParentWorkItem(parentWorkItemId, projectId, organizationId, currentWorkItemId) {
    if (!parentWorkItemId) {
        return;
    }
    if (currentWorkItemId && parentWorkItemId === currentWorkItemId) {
        throw new app_error_1.AppError("A work item cannot be its own parent", 400, "INVALID_PARENT_WORK_ITEM");
    }
    const repository = data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem);
    const parent = await repository.findOne({
        where: {
            id: parentWorkItemId,
            projectId,
            organizationId,
        },
        select: {
            id: true,
            parentWorkItemId: true,
        },
    });
    if (!parent) {
        throw new app_error_1.AppError("Parent work item not found in this project", 404, "PARENT_WORK_ITEM_NOT_FOUND");
    }
    // If updating, walk up the proposed parent's ancestors.
    // The current item must never appear in that chain.
    if (currentWorkItemId) {
        const visited = new Set();
        let ancestorId = parent.id;
        while (ancestorId) {
            if (ancestorId === currentWorkItemId) {
                throw new app_error_1.AppError("This parent would create a circular work-item hierarchy", 400, "WORK_ITEM_HIERARCHY_CYCLE");
            }
            if (visited.has(ancestorId)) {
                throw new app_error_1.AppError("An existing circular work-item hierarchy was detected", 409, "EXISTING_WORK_ITEM_HIERARCHY_CYCLE");
            }
            visited.add(ancestorId);
            const ancestor = await repository.findOne({
                where: {
                    id: ancestorId,
                    projectId,
                    organizationId,
                },
                select: {
                    id: true,
                    parentWorkItemId: true,
                },
            });
            if (!ancestor) {
                break;
            }
            ancestorId = ancestor.parentWorkItemId;
        }
    }
}
async function validateAssignees(assignees, projectId, organizationId, manager = data_source_1.AppDataSource.manager) {
    if (!Array.isArray(assignees)) {
        throw new app_error_1.AppError("assignees must be an array", 400, "INVALID_ASSIGNEES");
    }
    const assigneeIds = assignees.map((assignee) => assignee.userId);
    const uniqueIds = [...new Set(assigneeIds)];
    if (uniqueIds.length !== assigneeIds.length) {
        throw new app_error_1.AppError("An assignee can only be included once", 400, "DUPLICATE_ASSIGNEE");
    }
    if (uniqueIds.length === 0) {
        return;
    }
    const eligibleUsers = await manager.getRepository(user_entity_1.User).find({
        where: {
            id: (0, typeorm_1.In)(uniqueIds),
            organizationId,
            status: user_entity_1.UserStatus.ACTIVE,
        },
        select: { id: true },
    });
    if (eligibleUsers.length !== uniqueIds.length) {
        throw new app_error_1.AppError("All assignees must be active users in your organization", 400, "INVALID_ASSIGNEE");
    }
    const memberships = await manager.getRepository(project_member_entity_1.ProjectMember).find({
        where: {
            projectId,
            userId: (0, typeorm_1.In)(uniqueIds),
        },
        select: {
            userId: true,
        },
    });
    const memberIds = new Set(memberships.map((member) => member.userId));
    const missingMemberIds = uniqueIds.filter((id) => !memberIds.has(id));
    if (missingMemberIds.length > 0) {
        const newMembers = missingMemberIds.map((userId) => manager.getRepository(project_member_entity_1.ProjectMember).create({
            projectId,
            userId,
            role: project_member_entity_1.ProjectRole.MEMBER,
        }));
        await manager.getRepository(project_member_entity_1.ProjectMember).save(newMembers);
    }
}
// CREATE WORK ITEM
const createWorkItem = async (req, res) => {
    const actor = await getActiveActor(requireUserId(req));
    const body = req.body;
    const { projectId, parentWorkItemId, type, title, description, priority = work_item_entity_1.WorkItemPriority.MEDIUM, status = work_item_entity_1.WorkItemStatus.BACKLOG, dueDate, assignees = [], recurrence, } = body;
    if (recurrence) {
        validateRecurrence(recurrence);
    }
    const result = await data_source_1.AppDataSource.transaction(async (manager) => {
        const project = await assertAccessibleProject(projectId, actor, manager);
        if (parentWorkItemId) {
            const parent = await manager.getRepository(work_item_entity_1.WorkItem).findOne({
                where: {
                    id: parentWorkItemId,
                    projectId: project.id,
                    organizationId: actor.organizationId,
                },
                select: { id: true },
            });
            if (!parent) {
                throw new app_error_1.AppError("Parent work item not found in this project", 404, "PARENT_WORK_ITEM_NOT_FOUND");
            }
        }
        await validateAssignees(assignees, project.id, actor.organizationId, manager);
        const workItemRepository = manager.getRepository(work_item_entity_1.WorkItem);
        const workItem = workItemRepository.create({
            organizationId: actor.organizationId,
            projectId: project.id,
            createdById: actor.id,
            parentWorkItemId: parentWorkItemId ?? null,
            type,
            title: title.trim(),
            description: description?.trim() || null,
            priority,
            status,
            dueDate: dueDate == null ? null : new Date(dueDate),
        });
        const savedWorkItem = await workItemRepository.save(workItem);
        if (assignees.length > 0) {
            const assignments = assignees.map((assignee) => manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).create({
                workItemId: savedWorkItem.id,
                userId: assignee.userId,
                assignedById: actor.id,
                startDate: assignee.startDate ?? null,
                estimatedHours: assignee.estimatedHours == null
                    ? null
                    : String(assignee.estimatedHours),
            }));
            await manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).save(assignments);
        }
        let savedRecurrence = null;
        if (recurrence) {
            const timezone = recurrence.timezone ?? "UTC";
            savedRecurrence = await manager
                .getRepository(work_item_recurrence_entity_1.WorkItemRecurrence)
                .save(manager.getRepository(work_item_recurrence_entity_1.WorkItemRecurrence).create({
                workItem: savedWorkItem,
                frequency: recurrence.frequency,
                interval: recurrence.interval ?? 1,
                daysOfWeek: recurrence.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.WEEKLY
                    ? recurrence.daysOfWeek ?? []
                    : null,
                monthlyPattern: recurrence.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.MONTHLY
                    ? recurrence.monthlyPattern ?? null
                    : null,
                dayOfMonth: recurrence.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.MONTHLY &&
                    recurrence.monthlyPattern === work_item_recurrence_entity_1.MonthlyPattern.DAY_OF_MONTH
                    ? recurrence.dayOfMonth ?? null
                    : null,
                startsOn: recurrence.startsOn,
                endsOn: recurrence.endsOn ?? null,
                // This is a UTC marker, not a timezone-aware local-midnight
                // calculation. The recurrence worker must interpret startsOn
                // using the stored timezone when calculating actual runs.
                nextRunAt: new Date(`${recurrence.startsOn}T00:00:00.000Z`),
                timezone,
                isActive: true,
            }));
        }
        const assignments = await manager
            .getRepository(work_item_assignee_entity_1.WorkItemAssignee)
            .find({
            where: { workItemId: savedWorkItem.id },
            relations: { user: true },
        });
        return {
            workItem: savedWorkItem,
            assignments,
            assigneeIds: assignments.map((assignee) => assignee.userId),
            assigneeId: assignments[0]?.userId || null,
            assignees: assignments.map((a) => a.user).filter(Boolean),
            recurrence: savedRecurrence,
        };
    });
    res.status(201).json({
        success: true,
        message: "Work item created successfully",
        data: {
            ...result.workItem,
            assignments: result.assignments,
            assigneeIds: result.assigneeIds,
            assigneeId: result.assigneeId,
            assignees: result.assignees,
            recurrence: result.recurrence,
        },
    });
};
exports.createWorkItem = createWorkItem;
// LIST PROJECT WORK ITEMS
const getProjectWorkItems = async (req, res) => {
    const actor = await getActiveActor(requireUserId(req));
    const projectId = req.params.projectId;
    if (typeof projectId !== "string") {
        throw new app_error_1.AppError("Invalid project ID", 400, "INVALID_PROJECT_ID");
    }
    const { page, limit, status, type } = res.locals.validatedWorkItemQuery;
    const project = await assertAccessibleProject(projectId, actor);
    const { skip, take } = (0, pagination_1.getPagination)({ page, limit });
    const query = data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem)
        .createQueryBuilder("workItem")
        .leftJoinAndSelect("workItem.assignments", "assignments")
        .leftJoinAndSelect("assignments.user", "assigneeUser")
        .leftJoinAndSelect("workItem.comments", "comments")
        .leftJoinAndSelect("workItem.timeEntries", "timeEntries")
        .leftJoinAndSelect("workItem.children", "children")
        .leftJoinAndSelect("workItem.attachments", "attachments")
        .where("workItem.projectId = :projectId", {
        projectId: project.id,
    })
        .andWhere("workItem.organizationId = :organizationId", { organizationId: actor.organizationId })
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
// UPDATE WORK ITEM
const updateWorkItem = async (req, res) => {
    const actor = await getActiveActor(requireUserId(req));
    const workItemId = requireWorkItemId(req);
    const body = req.body;
    const workItem = await getAccessibleWorkItem(workItemId, actor);
    if (body.parentWorkItemId !== undefined) {
        await validateParentWorkItem(body.parentWorkItemId, workItem.projectId, actor.organizationId, workItem.id);
    }
    let newAssignees = undefined;
    if (body.assignees !== undefined) {
        newAssignees = body.assignees || [];
    }
    else if (body.assigneeIds !== undefined) {
        newAssignees = (body.assigneeIds || []).map((uid) => ({ userId: uid }));
    }
    else if (body.assigneeId !== undefined) {
        newAssignees = body.assigneeId ? [{ userId: body.assigneeId }] : [];
    }
    const result = await data_source_1.AppDataSource.transaction(async (manager) => {
        if (newAssignees !== undefined) {
            await validateAssignees(newAssignees, workItem.projectId, actor.organizationId, manager);
            await manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).delete({
                workItemId: workItem.id,
            });
            if (newAssignees.length > 0) {
                const assigneeEntities = newAssignees.map((assignee) => manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).create({
                    workItemId: workItem.id,
                    userId: assignee.userId,
                    assignedById: actor.id,
                    startDate: assignee.startDate ?? null,
                    estimatedHours: assignee.estimatedHours !== undefined &&
                        assignee.estimatedHours !== null
                        ? assignee.estimatedHours.toString()
                        : null,
                }));
                await manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).save(assigneeEntities);
            }
        }
        // Explicit allow-list: do not mass-assign req.body onto the entity.
        if (body.title !== undefined) {
            workItem.title = body.title.trim();
        }
        if (body.type !== undefined) {
            workItem.type = body.type;
        }
        if (body.description !== undefined) {
            workItem.description = body.description?.trim() || null;
        }
        if (body.priority !== undefined) {
            workItem.priority = body.priority;
        }
        if (body.status !== undefined) {
            workItem.status = body.status;
        }
        if (body.dueDate !== undefined) {
            workItem.dueDate =
                body.dueDate === null ? null : new Date(body.dueDate);
        }
        if (body.parentWorkItemId !== undefined) {
            workItem.parentWorkItemId = body.parentWorkItemId;
        }
        const savedWorkItem = await manager
            .getRepository(work_item_entity_1.WorkItem)
            .save(workItem);
        const assignments = await manager
            .getRepository(work_item_assignee_entity_1.WorkItemAssignee)
            .find({
            where: { workItemId: savedWorkItem.id },
            relations: { user: true },
        });
        return {
            ...savedWorkItem,
            assignments,
            assigneeIds: assignments.map((a) => a.userId),
            assigneeId: assignments[0]?.userId || null,
            assignees: assignments.map((a) => a.user).filter(Boolean),
        };
    });
    res.status(200).json({
        success: true,
        message: "Work item updated successfully",
        data: result,
    });
};
exports.updateWorkItem = updateWorkItem;
// DELETE WORK ITEM
const deleteWorkItem = async (req, res) => {
    const actor = await getActiveActor(requireUserId(req));
    const workItemId = requireWorkItemId(req);
    const workItem = await getAccessibleWorkItem(workItemId, actor);
    await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).remove(workItem);
    res.status(200).json({
        success: true,
        message: "Work item deleted successfully",
        data: { id: workItemId },
    });
};
exports.deleteWorkItem = deleteWorkItem;
