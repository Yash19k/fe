"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectSprints = exports.createSprint = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../config/data.source");
const project_entity_1 = require("../entities/project.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const app_error_1 = require("../errors/app.error");
const pagination_1 = require("../utils/pagination");
const sprint_entities_1 = require("../entities/sprint.entities");
const notification_entity_1 = require("../entities/notification.entity");
const notification_service_1 = require("../services/notification.service");
const ALLOWED_SPRINT_WORK_ITEM_TYPES = [
    work_item_entity_1.WorkItemType.STORY,
    work_item_entity_1.WorkItemType.TASK,
    work_item_entity_1.WorkItemType.SUBTASK,
    work_item_entity_1.WorkItemType.BUG,
];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const parsePositiveInteger = (value, defaultValue, maxValue) => {
    if (typeof value !== "string" ||
        !/^\d+$/.test(value)) {
        return defaultValue;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        return defaultValue;
    }
    return maxValue ? Math.min(parsed, maxValue) : parsed;
};
const getProjectId = (req) => {
    const projectId = req.params.projectId;
    if (typeof projectId !== "string" ||
        !projectId.trim()) {
        throw new app_error_1.AppError("Invalid project ID.", 400, "INVALID_PROJECT_ID");
    }
    return projectId;
};
/**
 * Checks that the project belongs to the authenticated
 * user's organization.
 */
const findOrganizationProject = async (projectId, organizationId) => {
    const project = await data_source_1.AppDataSource.getRepository(project_entity_1.Project).findOne({
        where: {
            id: projectId,
            organizationId,
        },
    });
    if (!project) {
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    return project;
};
/**
 * Organization ADMINs and project creators are treated as
 * project administrators here. Verify that this matches
 * your application's authorization policy.
 */
const isOrganizationAdmin = (userRole) => userRole === "ADMIN";
const getProjectMembership = async (projectId, userId) => {
    return data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember).findOne({
        where: {
            projectId,
            userId,
        },
    });
};
const canManageSprint = async (project, userId, userRole) => {
    if (project.createdById === userId ||
        isOrganizationAdmin(userRole)) {
        return true;
    }
    const membership = await getProjectMembership(project.id, userId);
    return Boolean(membership &&
        [
            project_member_entity_1.ProjectRole.ADMIN,
            project_member_entity_1.ProjectRole.LEAD,
        ].includes(membership.role));
};
/**
 * Read access: organization admins, project creators,
 * project members, and users who can access a public
 * project within the same organization.
 */
const canReadProject = async (project, userId, userRole) => {
    if (project.createdById === userId ||
        isOrganizationAdmin(userRole)) {
        return true;
    }
    const membership = await getProjectMembership(project.id, userId);
    if (membership) {
        return true;
    }
    return String(project.visibility).toUpperCase() === "PUBLIC";
};
const createSprint = async (req, res) => {
    const authReq = req;
    const userId = authReq.user.id;
    const organizationId = authReq.user.organizationId;
    const projectId = getProjectId(req);
    const { name, goal, startDate, endDate, workItemIds = [], } = req.body;
    if (!Array.isArray(workItemIds)) {
        throw new app_error_1.AppError("workItemIds must be an array.", 400, "INVALID_SPRINT_WORK_ITEMS");
    }
    if (workItemIds.some((id) => typeof id !== "string" || !UUID_REGEX.test(id))) {
        throw new app_error_1.AppError("Every workItemId must be a valid database UUID.", 400, "INVALID_WORK_ITEM_IDS");
    }
    const uniqueWorkItemIds = workItemIds.map((id) => id.trim());
    if (new Set(uniqueWorkItemIds).size !== uniqueWorkItemIds.length) {
        throw new app_error_1.AppError("Duplicate work item IDs are not allowed.", 400, "DUPLICATE_WORK_ITEM_IDS");
    }
    const result = await data_source_1.AppDataSource.transaction(async (manager) => {
        const projectRepo = manager.getRepository(project_entity_1.Project);
        const memberRepo = manager.getRepository(project_member_entity_1.ProjectMember);
        const sprintRepo = manager.getRepository(sprint_entities_1.Sprint);
        const workItemRepo = manager.getRepository(work_item_entity_1.WorkItem);
        // 1. Validate project and permission.
        const project = await projectRepo.findOne({
            where: { id: projectId, organizationId },
        });
        if (!project) {
            throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
        }
        let permitted = project.createdById === userId ||
            isOrganizationAdmin(authReq.user.role);
        if (!permitted) {
            const membership = await memberRepo.findOne({
                where: { projectId, userId },
            });
            permitted = Boolean(membership &&
                [project_member_entity_1.ProjectRole.ADMIN, project_member_entity_1.ProjectRole.LEAD].includes(membership.role));
        }
        if (!permitted) {
            throw new app_error_1.AppError("You do not have permission to create a sprint in this project.", 403, "SPRINT_CREATE_FORBIDDEN");
        }
        // 2. Validate selected existing tasks before writing anything.
        const existingWorkItems = uniqueWorkItemIds.length
            ? await workItemRepo.find({
                where: {
                    id: (0, typeorm_1.In)(uniqueWorkItemIds),
                    projectId,
                    organizationId,
                },
            })
            : [];
        if (existingWorkItems.length !== uniqueWorkItemIds.length) {
            throw new app_error_1.AppError("One or more selected work items do not exist in this project.", 400, "INVALID_SELECTED_WORK_ITEMS");
        }
        for (const item of existingWorkItems) {
            if (!ALLOWED_SPRINT_WORK_ITEM_TYPES.includes(item.type)) {
                throw new app_error_1.AppError("Only STORY, TASK, SUBTASK, and BUG are allowed in a sprint.", 400, "INVALID_SPRINT_WORK_ITEM_TYPE");
            }
            if (item.sprintId) {
                throw new app_error_1.AppError("A selected task already belongs to a sprint.", 400, "WORK_ITEM_ALREADY_IN_SPRINT");
            }
            if (item.status !== work_item_entity_1.WorkItemStatus.BACKLOG) {
                throw new app_error_1.AppError("Only backlog work items can be added to a new sprint.", 400, "WORK_ITEM_NOT_ELIGIBLE_FOR_SPRINT");
            }
        }
        // Create the sprint first so associations use its persisted UUID.
        const sprint = sprintRepo.create({
            projectId,
            createdById: userId,
            name,
            goal: goal ?? null,
            startDate,
            endDate,
        });
        const savedSprint = await sprintRepo.save(sprint);
        // Attach existing backlog tasks to this same sprint.
        for (const item of existingWorkItems) {
            item.sprintId = savedSprint.id;
        }
        const savedWorkItems = existingWorkItems.length
            ? await workItemRepo.save(existingWorkItems)
            : [];
        const returnedWorkItems = savedWorkItems.length
            ? await workItemRepo.find({
                where: {
                    id: (0, typeorm_1.In)(savedWorkItems.map((item) => item.id)),
                },
                relations: {
                    assignments: {
                        user: true,
                    },
                },
            })
            : [];
        return {
            sprint: savedSprint,
            workItems: returnedWorkItems,
        };
    });
    const notifications = new Map();
    for (const workItem of result.workItems) {
        for (const assignment of workItem.assignments ?? []) {
            const assigneeId = assignment.userId ?? assignment.user?.id;
            if (!assigneeId || assigneeId === userId)
                continue;
            notifications.set(assigneeId, {
                workItemId: workItem.id,
                workItemTitle: workItem.title,
            });
        }
    }
    await (0, notification_service_1.createNotificationsBestEffort)([...notifications.entries()].map(([assigneeId, item]) => ({
        userId: assigneeId,
        organizationId,
        type: notification_entity_1.NotificationType.TASK_UPDATED,
        title: "Task added to a sprint",
        message: `"${item.workItemTitle}" has been added to sprint "${result.sprint.name}".`,
        workItemId: item.workItemId,
        projectId,
        link: `/projects/${projectId}/sprints`,
        metadata: {
            sprintId: result.sprint.id,
            sprintName: result.sprint.name,
        },
    })), {
        operation: "sprint-create",
        organizationId,
        projectId,
    });
    res.status(201).json({
        success: true,
        message: "Sprint created successfully.",
        data: result,
    });
};
exports.createSprint = createSprint;
const getProjectSprints = async (req, res) => {
    const authReq = req;
    const userId = authReq.user.id;
    const organizationId = authReq.user.organizationId;
    const projectId = getProjectId(req);
    const project = await findOrganizationProject(projectId, organizationId);
    const hasReadAccess = await canReadProject(project, userId, authReq.user.role);
    if (!hasReadAccess) {
        // Do not reveal the existence of inaccessible private projects.
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE);
    const limit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const sprintRepo = data_source_1.AppDataSource.getRepository(sprint_entities_1.Sprint);
    const [sprints, total] = await sprintRepo.findAndCount({
        where: {
            projectId,
        },
        order: {
            startDate: "ASC",
            createdAt: "DESC",
        },
        relations: {
            workItems: true,
        },
        ...(0, pagination_1.getPagination)({ page, limit }),
    });
    res.status(200).json({
        success: true,
        data: sprints,
        pagination: (0, pagination_1.getPaginationMeta)({
            page,
            limit,
            total,
        }),
    });
};
exports.getProjectSprints = getProjectSprints;
