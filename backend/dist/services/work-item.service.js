"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = void 0;
exports.clearSlaState = clearSlaState;
exports.getActiveActor = getActiveActor;
exports.assertAccessibleProject = assertAccessibleProject;
exports.getAccessibleWorkItem = getAccessibleWorkItem;
exports.validateAssignees = validateAssignees;
exports.createWorkItemOrchestration = createWorkItemOrchestration;
exports.updateWorkItemOrchestration = updateWorkItemOrchestration;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../config/data.source");
const user_entity_1 = require("../entities/user.entity");
const project_entity_1 = require("../entities/project.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const work_item_assignee_entity_1 = require("../entities/work.item-assignee.entity");
const sprint_entities_1 = require("../entities/sprint.entities");
const work_item_recurrence_entity_1 = require("../entities/work.item.recurrence.entity");
const project_label_entity_1 = require("../entities/project.label.entity");
const organization_sla_entity_1 = require("../entities/organization.sla.entity");
const recurrence_service_1 = require("./recurrence.service");
const app_error_1 = require("../errors/app.error");
const notification_entity_1 = require("../entities/notification.entity");
const audit_log_entity_1 = require("../entities/audit.log.entity");
const notification_service_1 = require("./notification.service");
const sla_service_1 = require("./sla.service");
const work_item_workflow_service_1 = require("./work-item-workflow.service");
const work_item_dependency_service_1 = require("./work-item-dependency.service");
const isAdmin = (actor) => actor.role === "ADMIN";
exports.isAdmin = isAdmin;
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
    if (!user || user.status !== user_entity_1.UserStatus.ACTIVE || !user.organizationId) {
        throw new app_error_1.AppError("Authenticated user is not active or has no organization", 401, "UNAUTHORIZED");
    }
    return {
        id: user.id,
        organizationId: user.organizationId,
        status: user.status,
        role: user.role,
    };
}
async function assertAccessibleProject(projectId, actor, manager) {
    const repository = manager
        ? manager.getRepository(project_entity_1.Project)
        : data_source_1.AppDataSource.getRepository(project_entity_1.Project);
    const project = await repository.findOne({
        where: {
            id: projectId,
            organizationId: actor.organizationId,
        },
        select: {
            id: true,
            organizationId: true,
            visibility: true,
        },
    });
    if (!project) {
        throw new app_error_1.AppError("Project not found", 404, "PROJECT_NOT_FOUND");
    }
    if ((0, exports.isAdmin)(actor)) {
        return project;
    }
    const memberRepo = manager
        ? manager.getRepository(project_member_entity_1.ProjectMember)
        : data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember);
    const membership = await memberRepo.findOne({
        where: {
            projectId: project.id,
            userId: actor.id,
        },
        select: {
            projectId: true,
            userId: true,
            role: true,
        },
    });
    if (!membership && project.visibility !== project_entity_1.ProjectVisibility.PUBLIC) {
        throw new app_error_1.AppError("You do not have access to this project", 403, "PROJECT_ACCESS_DENIED");
    }
    return project;
}
async function getAccessibleWorkItem(workItemId, actor) {
    const workItem = await data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem).findOne({
        where: {
            id: workItemId,
            organizationId: actor.organizationId,
        },
        relations: {
            project: true,
        },
    });
    if (!workItem) {
        throw new app_error_1.AppError("Work item not found", 404, "WORK_ITEM_NOT_FOUND");
    }
    await assertAccessibleProject(workItem.projectId, actor);
    return workItem;
}
async function validateAssignees(assignees, projectId, organizationId, manager) {
    if (assignees.length === 0)
        return;
    const uniqueIds = Array.from(new Set(assignees.map((a) => a.userId)));
    const validUsers = await manager.getRepository(user_entity_1.User).find({
        where: {
            id: (0, typeorm_1.In)(uniqueIds),
            organizationId,
            status: user_entity_1.UserStatus.ACTIVE,
        },
        select: { id: true },
    });
    if (validUsers.length !== uniqueIds.length) {
        throw new app_error_1.AppError("All assignees must be active users in your organization", 400, "INVALID_ASSIGNEE");
    }
    const memberships = await manager.getRepository(project_member_entity_1.ProjectMember).find({
        where: {
            projectId,
            userId: (0, typeorm_1.In)(uniqueIds),
        },
        select: { userId: true },
    });
    const memberIds = new Set(memberships.map((m) => m.userId));
    const missingMemberIds = uniqueIds.filter((id) => !memberIds.has(id));
    if (missingMemberIds.length > 0) {
        throw new app_error_1.AppError("All assignees must already be members of this project", 400, "INVALID_ASSIGNEE");
    }
}
async function createWorkItemOrchestration(actor, input) {
    const { projectId, sprintId, parentWorkItemId, labelId, labels, type, title, description, priority, status = work_item_entity_1.WorkItemStatus.BACKLOG, dueDate, plannedStartDate, plannedDurationWorkingDays, assignees = [], recurrence, slaDeadline, } = input;
    if (recurrence) {
        (0, recurrence_service_1.validateRecurrence)(recurrence, type);
    }
    if ((plannedStartDate == null) !==
        (plannedDurationWorkingDays == null)) {
        throw new app_error_1.AppError("Planned start date and working-day duration must be provided together.", 400, "INVALID_SCHEDULE_DATA");
    }
    if (plannedDurationWorkingDays != null &&
        (!Number.isInteger(plannedDurationWorkingDays) ||
            plannedDurationWorkingDays < 1)) {
        throw new app_error_1.AppError("Planned duration must be a positive whole number of working days.", 400, "INVALID_SCHEDULE_DATA");
    }
    let plannedFinish = null;
    if (plannedStartDate && plannedDurationWorkingDays) {
        plannedFinish = (0, work_item_dependency_service_1.dateToProjectTimestamp)((0, work_item_dependency_service_1.calculatePlannedFinish)(plannedStartDate, plannedDurationWorkingDays));
    }
    if (plannedFinish &&
        dueDate &&
        (0, work_item_dependency_service_1.getProjectDate)(plannedFinish) !== (0, work_item_dependency_service_1.getProjectDate)(dueDate)) {
        throw new app_error_1.AppError("Due date must match the planned start date and working-day duration.", 400, "INVALID_SCHEDULE_DATA");
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
            dueDate: plannedFinish ?? (dueDate == null ? null : new Date(dueDate)),
            plannedStartDate: plannedStartDate ?? null,
            plannedDurationWorkingDays: plannedDurationWorkingDays ?? null,
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
        const auditRepo = manager.getRepository(audit_log_entity_1.AuditLog);
        await auditRepo.save(auditRepo.create({
            organizationId: savedWorkItem.organizationId,
            projectId: savedWorkItem.projectId,
            userId: actor.id,
            action: "created",
            entityType: "task",
            entityId: savedWorkItem.id,
            description: `Created work item "${savedWorkItem.title}"`,
            previousState: null,
            newState: {
                title: savedWorkItem.title,
                description: savedWorkItem.description,
                status: savedWorkItem.status,
                priority: savedWorkItem.priority,
                type: savedWorkItem.type,
                dueDate: savedWorkItem.dueDate?.toISOString() ?? null,
                plannedStartDate: savedWorkItem.plannedStartDate,
                plannedDurationWorkingDays: savedWorkItem.plannedDurationWorkingDays,
                parentWorkItemId: savedWorkItem.parentWorkItemId,
                sprintId: savedWorkItem.sprintId,
                labelId: savedWorkItem.labelId,
                assigneeIds: assignees.map((assignee) => assignee.userId),
            },
            trustedForUndo: false,
        }));
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
    await (0, notification_service_1.createNotificationsBestEffort)(result.assigneeIds
        .filter((assigneeId) => assigneeId !== actor.id)
        .map((assigneeId) => ({
        userId: assigneeId,
        organizationId: actor.organizationId,
        type: notification_entity_1.NotificationType.TASK_ASSIGNED,
        title: "Task assigned to you",
        message: `You have been assigned "${result.workItem.title}".`,
        workItemId: result.workItem.id,
        projectId: result.workItem.projectId,
        link: `/tasks/${result.workItem.id}`,
    })), {
        operation: "work-item-assignment",
        organizationId: actor.organizationId,
        projectId: result.workItem.projectId,
    });
    return result;
}
async function updateWorkItemOrchestration(actor, workItemId, body) {
    const result = await data_source_1.AppDataSource.transaction(async (manager) => {
        const touchesSchedule = body.dueDate !== undefined ||
            body.plannedStartDate !== undefined ||
            body.plannedDurationWorkingDays !== undefined ||
            body.isSchedulePinned !== undefined;
        const workItemRepository = manager.getRepository(work_item_entity_1.WorkItem);
        const reference = await workItemRepository.findOne({
            where: { id: workItemId, organizationId: actor.organizationId },
            select: { id: true, projectId: true },
        });
        if (!reference) {
            throw new app_error_1.AppError("Work item not found", 404, "WORK_ITEM_NOT_FOUND");
        }
        if (touchesSchedule) {
            await (0, work_item_dependency_service_1.lockProjectSchedule)(manager, reference.projectId, actor.organizationId);
        }
        const workItem = await workItemRepository
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
        const project = await assertAccessibleProject(workItem.projectId, actor, manager);
        const previousTaskState = {
            title: workItem.title,
            description: workItem.description,
            status: workItem.status,
            priority: workItem.priority,
            type: workItem.type,
            dueDate: workItem.dueDate?.toISOString() ?? null,
            plannedStartDate: workItem.plannedStartDate,
            plannedDurationWorkingDays: workItem.plannedDurationWorkingDays,
            isSchedulePinned: workItem.isSchedulePinned,
            parentWorkItemId: workItem.parentWorkItemId,
            sprintId: workItem.sprintId,
            labelId: workItem.labelId,
        };
        const previousPriority = workItem.priority;
        const previousStatus = workItem.status;
        const previousSlaState = {
            deadline: workItem.slaDeadline,
            status: workItem.slaStatus,
            breachedAt: workItem.slaBreachedAt,
        };
        if (body.sprintId !== undefined) {
            if (body.sprintId !== null) {
                const sprint = await manager.getRepository(sprint_entities_1.Sprint).findOne({
                    where: {
                        id: body.sprintId,
                        projectId: project.id,
                    },
                    select: { id: true },
                });
                if (!sprint) {
                    throw new app_error_1.AppError("Sprint not found in this project.", 400, "INVALID_SPRINT");
                }
                workItem.sprintId = body.sprintId;
            }
            else {
                workItem.sprintId = null;
            }
        }
        if (body.parentWorkItemId !== undefined) {
            if (body.parentWorkItemId !== null) {
                if (body.parentWorkItemId === workItem.id) {
                    throw new app_error_1.AppError("Work item cannot be its own parent", 400, "INVALID_PARENT_WORK_ITEM");
                }
                const parent = await manager.getRepository(work_item_entity_1.WorkItem).findOne({
                    where: {
                        id: body.parentWorkItemId,
                        projectId: project.id,
                        organizationId: actor.organizationId,
                    },
                    select: { id: true },
                });
                if (!parent) {
                    throw new app_error_1.AppError("Parent work item not found in this project", 404, "PARENT_WORK_ITEM_NOT_FOUND");
                }
                workItem.parentWorkItemId = body.parentWorkItemId;
            }
            else {
                workItem.parentWorkItemId = null;
            }
        }
        const targetLabelId = body.labelId !== undefined
            ? body.labelId
            : Array.isArray(body.labels) && body.labels.length > 0
                ? body.labels[0]
                : body.labels === null
                    ? null
                    : undefined;
        if (targetLabelId !== undefined) {
            if (targetLabelId !== null) {
                const label = await manager.getRepository(project_label_entity_1.ProjectLabel).findOne({
                    where: { id: targetLabelId, projectId: project.id },
                });
                if (!label) {
                    throw new app_error_1.AppError("Label not found in this project.", 400, "INVALID_LABEL");
                }
                workItem.labelId = label.id;
            }
            else {
                workItem.labelId = null;
            }
        }
        if (body.title !== undefined)
            workItem.title = body.title.trim();
        if (body.description !== undefined) {
            workItem.description = body.description?.trim() || null;
        }
        if (body.type !== undefined)
            workItem.type = body.type;
        if (body.priority !== undefined)
            workItem.priority = body.priority ?? null;
        if (body.status !== undefined) {
            await (0, work_item_workflow_service_1.assertWorkItemStatusTransition)(manager, project.id, workItem.status, body.status, actor.role);
            workItem.status = body.status;
        }
        if (touchesSchedule) {
            const dependencyState = await (0, work_item_dependency_service_1.getWorkItemDependencyState)(manager, workItem.id);
            (0, work_item_dependency_service_1.updateTaskScheduleFields)(workItem, {
                dueDate: body.dueDate,
                plannedStartDate: body.plannedStartDate,
                plannedDurationWorkingDays: body.plannedDurationWorkingDays,
                isSchedulePinned: body.isSchedulePinned,
            }, dependencyState.hasDependencies, dependencyState.requiresPlannedSchedule);
        }
        if (body.slaDeadline !== undefined) {
            if (body.slaDeadline === null) {
                if (workItem.priority) {
                    const orgPolicy = await manager.getRepository(organization_sla_entity_1.OrganizationSla).findOne({
                        where: { organizationId: actor.organizationId },
                    });
                    workItem.slaDeadline = (0, sla_service_1.calculateSlaDeadline)(workItem.createdAt, workItem.priority, orgPolicy);
                    workItem.slaDeadlineIsCustom = false;
                }
                else {
                    clearSlaState(workItem);
                }
            }
            else {
                if (!workItem.priority) {
                    throw new app_error_1.AppError("A priority is required to configure an SLA deadline", 400, "WORK_ITEM_PRIORITY_REQUIRED");
                }
                workItem.slaDeadline = new Date(body.slaDeadline);
                workItem.slaDeadlineIsCustom = true;
            }
        }
        const priorityChanged = body.priority !== undefined && body.priority !== previousPriority;
        const statusChanged = body.status !== undefined && body.status !== previousStatus;
        if (!workItem.priority) {
            clearSlaState(workItem);
        }
        else if (priorityChanged && body.slaDeadline === undefined) {
            const orgPolicy = await manager.getRepository(organization_sla_entity_1.OrganizationSla).findOne({
                where: { organizationId: actor.organizationId },
            });
            workItem.slaDeadline = (0, sla_service_1.calculateSlaDeadline)(workItem.createdAt, workItem.priority, orgPolicy);
            workItem.slaDeadlineIsCustom = false;
            (0, sla_service_1.applySlaState)(workItem, new Date(), orgPolicy);
        }
        else {
            const orgPolicy = await manager.getRepository(organization_sla_entity_1.OrganizationSla).findOne({
                where: { organizationId: actor.organizationId },
            });
            (0, sla_service_1.applySlaState)(workItem, new Date(), orgPolicy);
        }
        const savedWorkItem = await manager.getRepository(work_item_entity_1.WorkItem).save(workItem);
        const rescheduledTasks = touchesSchedule
            ? await (0, work_item_dependency_service_1.rescheduleAfterTaskEdit)(manager, actor, savedWorkItem)
            : [];
        const slaChanged = savedWorkItem.slaDeadline?.toISOString() !==
            previousSlaState.deadline?.toISOString() ||
            savedWorkItem.slaStatus !== previousSlaState.status ||
            savedWorkItem.slaBreachedAt?.toISOString() !==
                previousSlaState.breachedAt?.toISOString();
        if (slaChanged) {
            await (0, sla_service_1.writeSlaAudit)(manager, savedWorkItem, actor.id, "sla_updated", "Updated work item SLA state", previousSlaState, {
                deadline: savedWorkItem.slaDeadline,
                status: savedWorkItem.slaStatus,
                custom: savedWorkItem.slaDeadlineIsCustom,
            });
        }
        const previousAssignments = await manager
            .getRepository(work_item_assignee_entity_1.WorkItemAssignee)
            .find({
            where: { workItemId: savedWorkItem.id },
        });
        const previousAssigneeIds = previousAssignments.map((a) => a.userId);
        let nextAssignees = null;
        if (body.assignees !== undefined) {
            nextAssignees = body.assignees ?? [];
        }
        else if (body.assigneeIds !== undefined) {
            nextAssignees = (body.assigneeIds ?? []).map((userId) => ({ userId }));
        }
        else if (body.assigneeId !== undefined) {
            nextAssignees = body.assigneeId ? [{ userId: body.assigneeId }] : [];
        }
        if (nextAssignees !== null) {
            await validateAssignees(nextAssignees, project.id, actor.organizationId, manager);
            await manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).delete({
                workItemId: savedWorkItem.id,
            });
            if (nextAssignees.length > 0) {
                const assignments = nextAssignees.map((assignee) => manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee).create({
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
        }
        const currentAssignments = await manager
            .getRepository(work_item_assignee_entity_1.WorkItemAssignee)
            .find({
            where: { workItemId: savedWorkItem.id },
            relations: { user: true },
        });
        const currentAssigneeIds = currentAssignments.map((a) => a.userId);
        const auditRepo = manager.getRepository(audit_log_entity_1.AuditLog);
        await auditRepo.save(auditRepo.create({
            organizationId: savedWorkItem.organizationId,
            projectId: savedWorkItem.projectId,
            userId: actor.id,
            action: "updated",
            entityType: "task",
            entityId: savedWorkItem.id,
            description: `Updated work item "${savedWorkItem.title}"`,
            previousState: {
                ...previousTaskState,
                assigneeIds: previousAssigneeIds,
            },
            newState: {
                title: savedWorkItem.title,
                description: savedWorkItem.description,
                status: savedWorkItem.status,
                priority: savedWorkItem.priority,
                type: savedWorkItem.type,
                dueDate: savedWorkItem.dueDate?.toISOString() ?? null,
                plannedStartDate: savedWorkItem.plannedStartDate,
                plannedDurationWorkingDays: savedWorkItem.plannedDurationWorkingDays,
                isSchedulePinned: savedWorkItem.isSchedulePinned,
                parentWorkItemId: savedWorkItem.parentWorkItemId,
                sprintId: savedWorkItem.sprintId,
                labelId: savedWorkItem.labelId,
                assigneeIds: currentAssigneeIds,
            },
            trustedForUndo: true,
        }));
        let assignedLabel = null;
        if (savedWorkItem.labelId) {
            assignedLabel = await manager.getRepository(project_label_entity_1.ProjectLabel).findOne({
                where: { id: savedWorkItem.labelId, projectId: project.id },
            });
        }
        return {
            workItem: savedWorkItem,
            rescheduledTasks,
            statusChanged,
            previousStatus,
            label: assignedLabel,
            labels: assignedLabel ? [assignedLabel] : [],
            assignments: currentAssignments,
            assigneeIds: currentAssigneeIds,
            assigneeId: currentAssigneeIds[0] || null,
            assignees: currentAssignments.map((a) => a.user).filter(Boolean),
            previousAssigneeIds,
        };
    });
    const newlyAssigned = result.assigneeIds.filter((id) => !result.previousAssigneeIds.includes(id) && id !== actor.id);
    const notifications = newlyAssigned.map((userId) => ({
        userId,
        organizationId: actor.organizationId,
        type: notification_entity_1.NotificationType.TASK_ASSIGNED,
        title: "Task assigned to you",
        message: `You have been assigned "${result.workItem.title}".`,
        workItemId: result.workItem.id,
        projectId: result.workItem.projectId,
        link: `/tasks/${result.workItem.id}`,
    }));
    if (result.statusChanged) {
        notifications.push(...result.assigneeIds
            .filter((id) => id !== actor.id)
            .map((userId) => ({
            userId,
            organizationId: actor.organizationId,
            type: notification_entity_1.NotificationType.TASK_UPDATED,
            title: "Task status updated",
            message: `"${result.workItem.title}" moved from ${result.previousStatus} to ${result.workItem.status}.`,
            workItemId: result.workItem.id,
            projectId: result.workItem.projectId,
            link: `/tasks/${result.workItem.id}`,
        })));
    }
    await (0, notification_service_1.createNotificationsBestEffort)(notifications, {
        operation: "work-item-update",
        organizationId: actor.organizationId,
        projectId: result.workItem.projectId,
    });
    return {
        ...result.workItem,
        rescheduledTasks: result.rescheduledTasks,
        label: result.label,
        labels: result.labels,
        assignments: result.assignments,
        assigneeIds: result.assigneeIds,
        assigneeId: result.assigneeId,
        assignees: result.assignees,
    };
}
