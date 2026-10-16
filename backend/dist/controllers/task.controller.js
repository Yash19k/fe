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
function isValidDateOnly(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value;
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
    if (input.endsOn != null) {
        if (!isValidDateOnly(input.endsOn) || input.endsOn < input.startsOn) {
            throw new app_error_1.AppError("endsOn must be a valid date on or after startsOn", 400, "INVALID_RECURRENCE_END_DATE");
        }
    }
    const timezone = input.timezone ?? "UTC";
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone });
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
            throw new app_error_1.AppError("Weekly recurrence requires unique daysOfWeek values from 0 (Sunday) to 6 (Saturday)", 400, "INVALID_RECURRENCE_DAYS");
        }
    }
    if (input.frequency === work_item_recurrence_entity_1.RecurrenceFrequency.MONTHLY) {
        if (!input.monthlyPattern ||
            !Object.values(work_item_recurrence_entity_1.MonthlyPattern).includes(input.monthlyPattern)) {
            throw new app_error_1.AppError("Monthly recurrence requires a valid monthlyPattern", 400, "INVALID_MONTHLY_PATTERN");
        }
        if (input.monthlyPattern === work_item_recurrence_entity_1.MonthlyPattern.DAY_OF_MONTH) {
            if (!Number.isInteger(input.dayOfMonth) ||
                input.dayOfMonth < 1 ||
                input.dayOfMonth > 31) {
                throw new app_error_1.AppError("DAY_OF_MONTH recurrence requires dayOfMonth between 1 and 31", 400, "INVALID_DAY_OF_MONTH");
            }
        }
        else if (input.dayOfMonth != null) {
            throw new app_error_1.AppError("dayOfMonth should only be supplied with DAY_OF_MONTH pattern", 400, "UNEXPECTED_DAY_OF_MONTH");
        }
    }
}
const createWorkItem = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new app_error_1.AppError("Authentication required", 401, "UNAUTHORIZED");
    }
    const { projectId, parentWorkItemId, type, title, description, priority, status, dueDate, assignees = [], recurrence, } = req.body;
    if (typeof title !== "string" || !title.trim()) {
        throw new app_error_1.AppError("Work item title is required", 400, "TITLE_REQUIRED");
    }
    if (!Array.isArray(assignees)) {
        throw new app_error_1.AppError("assignees must be an array", 400, "INVALID_ASSIGNEES");
    }
    if (recurrence) {
        validateRecurrence(recurrence);
    }
    const result = await data_source_1.AppDataSource.transaction(async (manager) => {
        const userRepository = manager.getRepository(user_entity_1.User);
        const projectRepository = manager.getRepository(project_entity_1.Project);
        const projectMemberRepository = manager.getRepository(project_member_entity_1.ProjectMember);
        const workItemRepository = manager.getRepository(work_item_entity_1.WorkItem);
        const assigneeRepository = manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee);
        const recurrenceRepository = manager.getRepository(work_item_recurrence_entity_1.WorkItemRecurrence);
        // 1. Retrieve the authenticated user and organization.
        const user = await userRepository.findOne({
            where: { id: userId },
            select: {
                id: true,
                organizationId: true,
                status: true,
            },
        });
        if (!user) {
            throw new app_error_1.AppError("User not found", 404, "USER_NOT_FOUND");
        }
        if (user.status !== user_entity_1.UserStatus.ACTIVE) {
            throw new app_error_1.AppError("Your account is not active", 403, "ACCOUNT_INACTIVE");
        }
        if (!user.organizationId) {
            throw new app_error_1.AppError("Account is not associated with an organization", 403, "ORGANIZATION_NOT_FOUND");
        }
        const organizationId = user.organizationId;
        // 2. Check organization isolation and project visibility.
        const project = await projectRepository
            .createQueryBuilder("project")
            .leftJoin("project.memberships", "membership", "membership.userId = :userId", { userId: user.id })
            .where("project.id = :projectId", { projectId })
            .andWhere("project.organizationId = :organizationId", { organizationId })
            .andWhere(`(
              project.visibility = :publicVisibility
              OR membership.userId = :userId
            )`, {
            publicVisibility: project_entity_1.ProjectVisibility.PUBLIC,
            userId: user.id,
        })
            .getOne();
        if (!project) {
            throw new app_error_1.AppError("Project not found or you do not have access to it", 404, "PROJECT_NOT_FOUND");
        }
        // 3. A parent work item must belong to this project.
        if (parentWorkItemId) {
            const parent = await workItemRepository.findOne({
                where: {
                    id: parentWorkItemId,
                    projectId: project.id,
                    organizationId: user.organizationId,
                },
                select: {
                    id: true,
                },
            });
            if (!parent) {
                throw new app_error_1.AppError("Parent work item not found in this project", 404, "PARENT_WORK_ITEM_NOT_FOUND");
            }
        }
        // 4. Validate assignees: active users in this organization and project.
        const assigneeIds = assignees.map((assignee) => assignee.userId);
        const uniqueAssigneeIds = [...new Set(assigneeIds)];
        if (uniqueAssigneeIds.length !== assigneeIds.length) {
            throw new app_error_1.AppError("An assignee can only be included once", 400, "DUPLICATE_ASSIGNEE");
        }
        if (assigneeIds.length > 0) {
            const eligibleUsers = await userRepository.find({
                where: {
                    id: (0, typeorm_1.In)(assigneeIds),
                    organizationId: user.organizationId,
                    status: user_entity_1.UserStatus.ACTIVE,
                },
                select: { id: true },
            });
            if (eligibleUsers.length !== assigneeIds.length) {
                throw new app_error_1.AppError("All assignees must be active users in your organization", 400, "INVALID_ASSIGNEE");
            }
            const memberships = await projectMemberRepository.find({
                where: {
                    projectId: project.id,
                    userId: (0, typeorm_1.In)(assigneeIds),
                },
                select: { userId: true },
            });
            if (memberships.length !== assigneeIds.length) {
                throw new app_error_1.AppError("All assignees must be members of the selected project", 400, "ASSIGNEE_NOT_PROJECT_MEMBER");
            }
        }
        // 6. Create the work item.
        const workItem = workItemRepository.create({
            organizationId,
            projectId: project.id,
            createdById: user.id,
            parentWorkItemId: parentWorkItemId ?? null,
            type,
            title: title.trim(),
            description: description?.trim() || null,
            priority,
            status,
            dueDate: dueDate == null ? null : new Date(dueDate),
        });
        const savedWorkItem = await workItemRepository.save(workItem);
        // 7. Create multiple assignee records.
        if (assignees.length > 0) {
            const assignments = assignees.map((assignee) => assigneeRepository.create({
                workItemId: savedWorkItem.id,
                userId: assignee.userId,
                assignedById: user.id,
                startDate: assignee.startDate ?? null,
                estimatedHours: assignee.estimatedHours == null
                    ? null
                    : String(assignee.estimatedHours),
            }));
            await assigneeRepository.save(assignments);
        }
        // 8. Save the recurrence rule in the same transaction.
        // The scheduler uses this rule to create future work items.
        let savedRecurrence = null;
        if (recurrence) {
            const timezone = recurrence.timezone ?? "UTC";
            const startsOn = recurrence.startsOn;
            const endsOn = recurrence.endsOn ?? null;
            savedRecurrence = await recurrenceRepository.save(recurrenceRepository.create({
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
                startsOn,
                endsOn,
                // Date-only start marker. The recurrence worker must interpret
                // calendar dates using the stored timezone when calculating runs.
                nextRunAt: new Date(`${startsOn}T00:00:00.000Z`),
                timezone,
                isActive: true,
            }));
        }
        return {
            workItem: savedWorkItem,
            assigneeIds,
            recurrence: savedRecurrence,
        };
    });
    res.status(201).json({
        success: true,
        message: "Work item created successfully",
        data: {
            ...result.workItem,
            assigneeIds: result.assigneeIds,
            recurrence: result.recurrence,
        },
    });
};
exports.createWorkItem = createWorkItem;
///View project 
const getProjectWorkItems = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new app_error_1.AppError("Authentication required", 401, "UNAUTHORIZED");
    }
    const { projectId } = req.params;
    const { page, limit, status, type, } = res.locals.validatedWorkItemQuery;
    const userRepository = data_source_1.AppDataSource.getRepository(user_entity_1.User);
    const projectRepository = data_source_1.AppDataSource.getRepository(project_entity_1.Project);
    const workItemRepository = data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem);
    // 1. Find the authenticated user's organization.
    const user = await userRepository.findOne({
        where: { id: userId },
        select: {
            id: true,
            organizationId: true,
            status: true,
        },
    });
    if (!user) {
        throw new app_error_1.AppError("User not found", 404, "USER_NOT_FOUND");
    }
    if (user.status !== user_entity_1.UserStatus.ACTIVE) {
        throw new app_error_1.AppError("Your account is not active", 403, "ACCOUNT_INACTIVE");
    }
    // 2. Check project organization and visibility.
    const project = await projectRepository
        .createQueryBuilder("project")
        .leftJoin("project.memberships", "membership", "membership.userId = :userId", { userId })
        .where("project.id = :projectId", { projectId })
        .andWhere("project.organizationId = :organizationId", { organizationId: user.organizationId })
        .andWhere(`(project.visibility = :publicVisibility
          OR membership.userId = :userId)`, {
        publicVisibility: project_entity_1.ProjectVisibility.PUBLIC,
        userId,
    })
        .getOne();
    if (!project) {
        throw new app_error_1.AppError("Project not found or you do not have access to it", 404, "PROJECT_NOT_FOUND");
    }
    // 3. Calculate reusable pagination values.
    const { skip, take } = (0, pagination_1.getPagination)({ page, limit });
    // 4. Build the project work-items query.
    const query = workItemRepository
        .createQueryBuilder("workItem")
        .where("workItem.projectId = :projectId", {
        projectId: project.id,
    })
        .andWhere("workItem.organizationId = :organizationId", { organizationId: user.organizationId })
        .orderBy("workItem.createdAt", "DESC")
        .addOrderBy("workItem.id", "DESC")
        .skip(skip)
        .take(take);
    // 5. Apply optional filters.
    if (status) {
        query.andWhere("workItem.status = :status", { status });
    }
    if (type) {
        query.andWhere("workItem.type = :type", { type });
    }
    // 6. Retrieve work items and total matching count.
    const [workItems, total] = await query.getManyAndCount();
    // 7. Return the paginated response.
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
const updateWorkItem = async (req, res) => {
    const userId = req.user?.id;
    const workItemId = req.params.workItemId;
    if (!userId || typeof workItemId !== "string") {
        throw new app_error_1.AppError("Invalid work item request.", 400, "INVALID_WORK_ITEM_ID");
    }
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: userId },
        select: { id: true, organizationId: true },
    });
    if (!user || !user.organizationId) {
        throw new app_error_1.AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }
    const organizationId = user.organizationId;
    const project = await data_source_1.AppDataSource.getRepository(project_entity_1.Project)
        .createQueryBuilder("project")
        .leftJoin("project.memberships", "membership", "membership.userId = :userId", { userId })
        .where("project.id = (SELECT work_item.project_id FROM work_items work_item WHERE work_item.id = :workItemId)", { workItemId })
        .andWhere("project.organizationId = :organizationId", { organizationId })
        .andWhere("(project.visibility = :publicVisibility OR membership.userId = :userId)", {
        publicVisibility: project_entity_1.ProjectVisibility.PUBLIC,
        userId,
    })
        .getOne();
    const workItemRepository = data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem);
    const workItem = await workItemRepository.findOne({
        where: { id: workItemId, organizationId, projectId: project?.id },
    });
    if (!workItem) {
        throw new app_error_1.AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }
    Object.assign(workItem, {
        ...req.body,
        dueDate: req.body.dueDate == null ? req.body.dueDate : new Date(req.body.dueDate),
    });
    const saved = await workItemRepository.save(workItem);
    res.json({ success: true, data: saved });
};
exports.updateWorkItem = updateWorkItem;
const deleteWorkItem = async (req, res) => {
    const userId = req.user?.id;
    const workItemId = req.params.workItemId;
    if (!userId || typeof workItemId !== "string") {
        throw new app_error_1.AppError("Invalid work item request.", 400, "INVALID_WORK_ITEM_ID");
    }
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: userId },
        select: { id: true, organizationId: true },
    });
    if (!user || !user.organizationId) {
        throw new app_error_1.AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }
    const organizationId = user.organizationId;
    const project = await data_source_1.AppDataSource.getRepository(project_entity_1.Project)
        .createQueryBuilder("project")
        .leftJoin("project.memberships", "membership", "membership.userId = :userId", { userId })
        .where("project.id = (SELECT work_item.project_id FROM work_items work_item WHERE work_item.id = :workItemId)", { workItemId })
        .andWhere("project.organizationId = :organizationId", { organizationId })
        .andWhere("(project.visibility = :publicVisibility OR membership.userId = :userId)", {
        publicVisibility: project_entity_1.ProjectVisibility.PUBLIC,
        userId,
    })
        .getOne();
    const workItemRepository = data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem);
    const workItem = await workItemRepository.findOne({
        where: { id: workItemId, organizationId, projectId: project?.id },
    });
    if (!workItem) {
        throw new app_error_1.AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }
    await workItemRepository.remove(workItem);
    res.json({ success: true, data: { id: workItemId } });
};
exports.deleteWorkItem = deleteWorkItem;
