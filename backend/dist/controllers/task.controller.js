"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteWorkItem = exports.resolveWorkItemEscalation = exports.getWorkItemSlaAudit = exports.getWorkItemSla = exports.escalateWorkItem = exports.updateWorkItem = exports.getProjectWorkItems = exports.createWorkItem = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../config/data.source");
const user_entity_1 = require("../entities/user.entity");
const project_entity_1 = require("../entities/project.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const work_item_assignee_entity_1 = require("../entities/work.item-assignee.entity");
const audit_log_entity_1 = require("../entities/audit.log.entity");
const sprint_entities_1 = require("../entities/sprint.entities");
const project_label_entity_1 = require("../entities/project.label.entity");
const organization_sla_entity_1 = require("../entities/organization.sla.entity");
const work_item_recurrence_entity_1 = require("../entities/work.item.recurrence.entity");
const recurrence_service_1 = require("../services/recurrence.service");
const app_error_1 = require("../errors/app.error");
const notification_entity_1 = require("../entities/notification.entity");
const notification_service_1 = require("../services/notification.service");
const sla_service_1 = require("../services/sla.service");
const project_permission_1 = require("../middleware/project.permission");
const pagination_1 = require("../utils/pagination");
const isAdmin = (actor) => actor.role === "ADMIN";
function clearSlaState(workItem) {
    workItem.slaDeadline = null;
    workItem.slaStatus = null;
    workItem.slaDeadlineIsCustom = false;
    workItem.escalatedAt = null;
    workItem.escalatedById = null;
    workItem.escalationReason = null;
    workItem.slaBreachedAt = null;
    workItem.slaResolvedAt = null;
}
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
        .leftJoinAndSelect("workItem.label", "label")
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
    const { projectId, sprintId, parentWorkItemId, labelId, labels, type, title, description, priority, status = work_item_entity_1.WorkItemStatus.BACKLOG, dueDate, assignees = [], recurrence, slaDeadline, } = body;
    if (slaDeadline !== undefined) {
        await (0, project_permission_1.authorizeProjectPermission)(req, "sla:manage");
    }
    if (recurrence) {
        (0, recurrence_service_1.validateRecurrence)(recurrence, type);
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
        if (sprintId) {
            const sprint = await manager.getRepository(sprint_entities_1.Sprint).findOne({
                where: {
                    id: sprintId,
                    projectId: project.id,
                },
                select: { id: true },
            });
            if (!sprint) {
                throw new app_error_1.AppError("Sprint not found in this project.", 400, "INVALID_SPRINT");
            }
        }
        const targetLabelId = labelId || (Array.isArray(labels) && labels.length > 0 ? labels[0] : null);
        let labelToAssign = null;
        if (targetLabelId) {
            labelToAssign = await manager.getRepository(project_label_entity_1.ProjectLabel).findOne({
                where: { id: targetLabelId, projectId: project.id },
            });
            if (!labelToAssign) {
                throw new app_error_1.AppError("Label not found in this project.", 400, "INVALID_LABEL");
            }
        }
        await validateAssignees(assignees, project.id, actor.organizationId, manager);
        const workItemRepository = manager.getRepository(work_item_entity_1.WorkItem);
        const workItem = workItemRepository.create({
            organizationId: actor.organizationId,
            projectId: project.id,
            createdById: actor.id,
            sprintId: sprintId ?? null,
            parentWorkItemId: parentWorkItemId ?? null,
            labelId: labelToAssign ? labelToAssign.id : null,
            type,
            title: title.trim(),
            description: description?.trim() || null,
            priority: priority ?? null,
            status,
            dueDate: dueDate == null ? null : new Date(dueDate),
        });
        const savedWorkItem = await workItemRepository.save(workItem);
        if (slaDeadline && !savedWorkItem.priority) {
            throw new app_error_1.AppError("A priority is required to configure an SLA deadline", 400, "WORK_ITEM_PRIORITY_REQUIRED");
        }
        if (savedWorkItem.priority) {
            const orgPolicy = await manager.getRepository(organization_sla_entity_1.OrganizationSla).findOne({
                where: { organizationId: actor.organizationId },
            });
            savedWorkItem.slaDeadline = slaDeadline
                ? new Date(slaDeadline)
                : (0, sla_service_1.calculateSlaDeadline)(savedWorkItem.createdAt, savedWorkItem.priority, orgPolicy);
            savedWorkItem.slaDeadlineIsCustom = Boolean(slaDeadline);
            (0, sla_service_1.applySlaState)(savedWorkItem, new Date(), orgPolicy);
            await workItemRepository.save(savedWorkItem);
            await (0, sla_service_1.writeSlaAudit)(manager, savedWorkItem, actor.id, "sla_initialized", "Initialized SLA for work item", null, {
                deadline: savedWorkItem.slaDeadline,
                status: savedWorkItem.slaStatus,
                custom: savedWorkItem.slaDeadlineIsCustom,
            });
        }
        else {
            clearSlaState(savedWorkItem);
            await workItemRepository.save(savedWorkItem);
        }
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
            const recurrenceRepository = manager.getRepository(work_item_recurrence_entity_1.WorkItemRecurrence);
            const timezone = recurrence_service_1.DEFAULT_RECURRENCE_TIMEZONE;
            const recurrenceRule = recurrenceRepository.create({
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
                nextRunAt: null,
                timezone,
                timeOfDay: recurrence_service_1.RECURRENCE_TIME_OF_DAY,
                weekdaysOnly: recurrence.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.DAILY &&
                    Boolean(recurrence.weekdaysOnly),
                isActive: true,
            });
            // If today's 09:00 has passed, begin with the next eligible date instead
            // of generating a stale occurrence tomorrow for today's date.
            recurrenceRule.nextRunAt = (0, recurrence_service_1.getInitialOccurrenceRunAt)(recurrenceRule);
            recurrenceRule.isActive = recurrenceRule.nextRunAt !== null;
            savedRecurrence = await recurrenceRepository.save(recurrenceRule);
        }
        const assignments = await manager
            .getRepository(work_item_assignee_entity_1.WorkItemAssignee)
            .find({
            where: { workItemId: savedWorkItem.id },
            relations: { user: true },
        });
        return {
            workItem: savedWorkItem,
            label: labelToAssign,
            labels: labelToAssign ? [labelToAssign] : [],
            assignments,
            assigneeIds: assignments.map((assignee) => assignee.userId),
            assigneeId: assignments[0]?.userId || null,
            assignees: assignments.map((a) => a.user).filter(Boolean),
            recurrence: savedRecurrence,
        };
    });
    // Notify newly assigned users after the work item transaction commits.
    await Promise.all(result.assigneeIds
        .filter((assigneeId) => assigneeId !== actor.id)
        .map((assigneeId) => notification_service_1.notificationService.createNotification({
        userId: assigneeId,
        organizationId: actor.organizationId,
        type: notification_entity_1.NotificationType.TASK_ASSIGNED,
        title: "Task assigned to you",
        message: `You have been assigned "${result.workItem.title}".`,
        workItemId: result.workItem.id,
        projectId: result.workItem.projectId,
        link: `/tasks/${result.workItem.id}`,
    })));
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
        .leftJoinAndSelect("workItem.label", "label")
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
    for (const workItem of workItems) {
        if (!workItem.priority) {
            clearSlaState(workItem);
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
// UPDATE WORK ITEM
const updateWorkItem = async (req, res) => {
    const actor = await getActiveActor(requireUserId(req));
    const workItemId = requireWorkItemId(req);
    const body = req.body;
    const workItem = await getAccessibleWorkItem(workItemId, actor);
    const previousStatus = workItem.status;
    const previousAssigneeIds = (await data_source_1.AppDataSource.getRepository(work_item_assignee_entity_1.WorkItemAssignee).find({
        where: { workItemId: workItem.id },
        select: { userId: true },
    })).map((assignment) => assignment.userId);
    if (body.slaDeadline !== undefined) {
        await (0, project_permission_1.authorizeProjectPermission)(req, "sla:manage");
    }
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
        const previousSlaDeadline = workItem.slaDeadline;
        const previousSlaStatus = workItem.slaStatus;
        if (body.sprintId !== undefined && body.sprintId !== null) {
            const sprint = await manager.getRepository(sprint_entities_1.Sprint).findOne({
                where: {
                    id: body.sprintId,
                    projectId: workItem.projectId,
                },
                select: { id: true },
            });
            if (!sprint) {
                throw new app_error_1.AppError("Sprint not found in this project.", 400, "INVALID_SPRINT");
            }
        }
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
        const orgPolicy = await manager.getRepository(organization_sla_entity_1.OrganizationSla).findOne({
            where: { organizationId: actor.organizationId },
        });
        if (body.priority !== undefined) {
            const previousPriority = workItem.priority;
            workItem.priority = body.priority ?? null;
            if (!workItem.priority) {
                clearSlaState(workItem);
            }
            else if (previousPriority !== workItem.priority &&
                !workItem.slaDeadlineIsCustom) {
                workItem.slaDeadline = (0, sla_service_1.calculateSlaDeadline)(workItem.createdAt, workItem.priority, orgPolicy);
            }
        }
        if (body.status !== undefined) {
            workItem.status = body.status;
        }
        if (body.dueDate !== undefined) {
            workItem.dueDate =
                body.dueDate === null ? null : new Date(body.dueDate);
        }
        if (body.slaDeadline !== undefined) {
            if (body.slaDeadline && !workItem.priority) {
                throw new app_error_1.AppError("A priority is required to configure an SLA deadline", 400, "WORK_ITEM_PRIORITY_REQUIRED");
            }
            workItem.slaDeadline = body.slaDeadline
                ? new Date(body.slaDeadline)
                : workItem.priority
                    ? (0, sla_service_1.calculateSlaDeadline)(workItem.createdAt, workItem.priority, orgPolicy)
                    : null;
            workItem.slaDeadlineIsCustom = Boolean(body.slaDeadline);
        }
        if (body.parentWorkItemId !== undefined) {
            workItem.parentWorkItemId = body.parentWorkItemId;
        }
        if (body.sprintId !== undefined) {
            workItem.sprintId = body.sprintId;
        }
        let updatedLabel = null;
        if (body.labelId !== undefined || body.labels !== undefined) {
            const updateLabelId = body.labelId !== undefined
                ? body.labelId
                : (Array.isArray(body.labels) && body.labels.length > 0 ? body.labels[0] : null);
            if (updateLabelId) {
                updatedLabel = await manager.getRepository(project_label_entity_1.ProjectLabel).findOne({
                    where: { id: updateLabelId, projectId: workItem.projectId },
                });
                if (!updatedLabel) {
                    throw new app_error_1.AppError("Label not found in this project.", 400, "INVALID_LABEL");
                }
                workItem.labelId = updatedLabel.id;
            }
            else {
                workItem.labelId = null;
            }
        }
        const savedWorkItem = await manager
            .getRepository(work_item_entity_1.WorkItem)
            .save(workItem);
        if (!savedWorkItem.priority) {
            clearSlaState(savedWorkItem);
        }
        else {
            if (!savedWorkItem.slaDeadline) {
                savedWorkItem.slaDeadline = (0, sla_service_1.calculateSlaDeadline)(savedWorkItem.createdAt, savedWorkItem.priority, orgPolicy);
                savedWorkItem.slaDeadlineIsCustom = false;
            }
            (0, sla_service_1.applySlaState)(savedWorkItem, new Date(), orgPolicy);
        }
        await manager.getRepository(work_item_entity_1.WorkItem).save(savedWorkItem);
        if (previousSlaDeadline?.getTime() !== savedWorkItem.slaDeadline?.getTime()) {
            await (0, sla_service_1.writeSlaAudit)(manager, savedWorkItem, actor.id, "sla_deadline_changed", "Changed SLA deadline", { deadline: previousSlaDeadline }, { deadline: savedWorkItem.slaDeadline });
        }
        if (previousSlaStatus !== savedWorkItem.slaStatus) {
            await (0, sla_service_1.writeSlaAudit)(manager, savedWorkItem, actor.id, "sla_status_changed", "Changed SLA status", { status: previousSlaStatus }, { status: savedWorkItem.slaStatus });
        }
        const assignments = await manager
            .getRepository(work_item_assignee_entity_1.WorkItemAssignee)
            .find({
            where: { workItemId: savedWorkItem.id },
            relations: { user: true },
        });
        if (savedWorkItem.labelId && !updatedLabel) {
            updatedLabel = await manager.getRepository(project_label_entity_1.ProjectLabel).findOne({
                where: { id: savedWorkItem.labelId },
            });
        }
        return {
            ...savedWorkItem,
            label: updatedLabel,
            labels: updatedLabel ? [updatedLabel] : [],
            assignments,
            assigneeIds: assignments.map((a) => a.userId),
            assigneeId: assignments[0]?.userId || null,
            assignees: assignments.map((a) => a.user).filter(Boolean),
            sla: (0, sla_service_1.getSlaSnapshot)(savedWorkItem),
        };
    });
    const currentAssigneeIds = result.assigneeIds;
    const previousAssigneeSet = new Set(previousAssigneeIds);
    const currentAssigneeSet = new Set(currentAssigneeIds);
    const newlyAssignedIds = currentAssigneeIds.filter((assigneeId) => !previousAssigneeSet.has(assigneeId));
    const statusChanged = previousStatus !== result.status;
    const completedNow = statusChanged && result.status === work_item_entity_1.WorkItemStatus.DONE;
    const reopenedNow = statusChanged &&
        previousStatus === work_item_entity_1.WorkItemStatus.DONE &&
        result.status !== work_item_entity_1.WorkItemStatus.DONE;
    // Notify newly added assignees, including additional assignees.
    const assignmentNotifications = newlyAssignedIds
        .filter((assigneeId) => assigneeId !== actor.id)
        .map((assigneeId) => notification_service_1.notificationService.createNotification({
        userId: assigneeId,
        organizationId: actor.organizationId,
        type: notification_entity_1.NotificationType.TASK_ASSIGNED,
        title: "Task assigned to you",
        message: `You have been assigned "${result.title}".`,
        workItemId: result.id,
        projectId: result.projectId,
        link: `/tasks/${result.id}`,
    }));
    // Completion/reopening notifications go to the current assignees and creator.
    const statusRecipients = new Set([
        ...currentAssigneeIds,
        result.createdById,
    ]);
    statusRecipients.delete(actor.id);
    const statusNotifications = completedNow || reopenedNow
        ? [...statusRecipients].map((userId) => notification_service_1.notificationService.createNotification({
            userId,
            organizationId: actor.organizationId,
            type: completedNow
                ? notification_entity_1.NotificationType.TASK_COMPLETED
                : notification_entity_1.NotificationType.TASK_UPDATED,
            title: completedNow ? "Task completed" : "Task reopened",
            message: completedNow
                ? `"${result.title}" has been marked as completed.`
                : `"${result.title}" has been reopened.`,
            workItemId: result.id,
            projectId: result.projectId,
            link: `/tasks/${result.id}`,
        }))
        : [];
    // Notify existing assignees when task details change, without duplicating
    // assignment or completion/reopening notifications for this update.
    const taskDetailsChanged = body.title !== undefined ||
        body.description !== undefined ||
        body.priority !== undefined ||
        body.dueDate !== undefined ||
        body.sprintId !== undefined ||
        body.parentWorkItemId !== undefined ||
        body.type !== undefined ||
        body.slaDeadline !== undefined;
    const updateNotifications = taskDetailsChanged && !completedNow && !reopenedNow
        ? currentAssigneeIds
            .filter((assigneeId) => assigneeId !== actor.id &&
            previousAssigneeSet.has(assigneeId) &&
            currentAssigneeSet.has(assigneeId))
            .map((userId) => notification_service_1.notificationService.createNotification({
            userId,
            organizationId: actor.organizationId,
            type: notification_entity_1.NotificationType.TASK_UPDATED,
            title: "Assigned task updated",
            message: `"${result.title}" has been updated.`,
            workItemId: result.id,
            projectId: result.projectId,
            link: `/tasks/${result.id}`,
        }))
        : [];
    await Promise.all([
        ...assignmentNotifications,
        ...statusNotifications,
        ...updateNotifications,
    ]);
    res.status(200).json({
        success: true,
        message: "Work item updated successfully",
        data: result,
    });
};
exports.updateWorkItem = updateWorkItem;
const escalateWorkItem = async (req, res) => {
    const actor = await getActiveActor(requireUserId(req));
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
        await assertAccessibleProject(workItem.projectId, actor, manager);
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
    res.status(200).json({
        success: true,
        message: result.alreadyEscalated ? "Work item is already escalated" : "Work item escalated successfully",
        data: { ...result.workItem, sla: (0, sla_service_1.getSlaSnapshot)(result.workItem), alreadyEscalated: result.alreadyEscalated },
    });
};
exports.escalateWorkItem = escalateWorkItem;
const getWorkItemSla = async (req, res) => {
    const actor = await getActiveActor(requireUserId(req));
    const workItem = await getAccessibleWorkItem(requireWorkItemId(req), actor);
    if (!workItem.priority) {
        clearSlaState(workItem);
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
const getWorkItemSlaAudit = async (req, res) => {
    const actor = await getActiveActor(requireUserId(req));
    const workItem = await getAccessibleWorkItem(requireWorkItemId(req), actor);
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
const resolveWorkItemEscalation = async (req, res) => {
    const actor = await getActiveActor(requireUserId(req));
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
        await assertAccessibleProject(item.projectId, actor, manager);
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
            clearSlaState(item);
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
