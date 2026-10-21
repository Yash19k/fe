"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectSprints = exports.createSprint = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../config/data.source");
const project_entity_1 = require("../entities/project.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const work_item_assignee_entity_1 = require("../entities/work.item-assignee.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const user_entity_1 = require("../entities/user.entity");
const app_error_1 = require("../errors/app.error");
const pagination_1 = require("../utils/pagination");
const sprint_entities_1 = require("../entities/sprint.entities");
const ALLOWED_SPRINT_WORK_ITEM_TYPES = [
    work_item_entity_1.WorkItemType.STORY,
    work_item_entity_1.WorkItemType.TASK,
    work_item_entity_1.WorkItemType.SUBTASK,
    work_item_entity_1.WorkItemType.BUG,
];
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
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
    const { name, goal, startDate, endDate, workItems = [], workItemIds = [], } = req.body;
    if (!Array.isArray(workItems) || !Array.isArray(workItemIds)) {
        throw new app_error_1.AppError("workItems and workItemIds must be arrays.", 400, "INVALID_SPRINT_WORK_ITEMS");
    }
    if (workItemIds.some((id) => typeof id !== "string" || !id.trim())) {
        throw new app_error_1.AppError("Every workItemId must be a non-empty string.", 400, "INVALID_WORK_ITEM_IDS");
    }
    const uniqueWorkItemIds = [
        ...new Set(workItemIds.map((id) => id.trim())),
    ];
    const result = await data_source_1.AppDataSource.transaction(async (manager) => {
        const projectRepo = manager.getRepository(project_entity_1.Project);
        const memberRepo = manager.getRepository(project_member_entity_1.ProjectMember);
        const userRepo = manager.getRepository(user_entity_1.User);
        const sprintRepo = manager.getRepository(sprint_entities_1.Sprint);
        const workItemRepo = manager.getRepository(work_item_entity_1.WorkItem);
        const assigneeRepo = manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee);
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
        // 3. Validate new task types and parent requirements.
        for (const item of workItems) {
            if (!ALLOWED_SPRINT_WORK_ITEM_TYPES.includes(item.type)) {
                throw new app_error_1.AppError("Only STORY, TASK, SUBTASK, and BUG are allowed in a sprint.", 400, "INVALID_SPRINT_WORK_ITEM_TYPE");
            }
            if (item.type === work_item_entity_1.WorkItemType.SUBTASK &&
                !item.parentWorkItemId) {
                throw new app_error_1.AppError("A SUBTASK must have a parent work item.", 400, "SUBTASK_PARENT_REQUIRED");
            }
            if (item.type !== work_item_entity_1.WorkItemType.SUBTASK &&
                item.parentWorkItemId) {
                throw new app_error_1.AppError("Only a SUBTASK may have a parent work item.", 400, "PARENT_NOT_ALLOWED");
            }
        }
        // 4. Validate assignees for new tasks.
        const allAssigneeIds = [
            ...new Set(workItems.flatMap((item) => item.assigneeIds ?? [])),
        ];
        if (allAssigneeIds.length) {
            const users = await userRepo.find({
                where: {
                    id: (0, typeorm_1.In)(allAssigneeIds),
                    organizationId,
                    status: user_entity_1.UserStatus.ACTIVE,
                },
                select: { id: true },
            });
            if (users.length !== allAssigneeIds.length) {
                throw new app_error_1.AppError("One or more assignees are invalid, inactive, or outside your organization.", 400, "INVALID_ASSIGNEES");
            }
            const memberships = await memberRepo.find({
                where: {
                    projectId,
                    userId: (0, typeorm_1.In)(allAssigneeIds),
                },
                select: { userId: true },
            });
            const projectMemberIds = new Set(memberships.map((membership) => membership.userId));
            if (allAssigneeIds.some((id) => !projectMemberIds.has(id))) {
                throw new app_error_1.AppError("Every assignee must be a member of this project.", 400, "ASSIGNEE_NOT_PROJECT_MEMBER");
            }
        }
        // 5. CREATE THE SPRINT FIRST.
        const sprint = sprintRepo.create({
            projectId,
            createdById: userId,
            name,
            goal: goal ?? null,
            startDate,
            endDate,
        });
        const savedSprint = await sprintRepo.save(sprint);
        const savedWorkItems = [];
        // 6. Create new tasks only after savedSprint exists.
        for (const item of workItems) {
            if (item.parentWorkItemId) {
                const parent = await workItemRepo.findOne({
                    where: {
                        id: item.parentWorkItemId,
                        projectId,
                        organizationId,
                    },
                });
                if (!parent) {
                    throw new app_error_1.AppError("Parent work item must exist in the same project and organization.", 400, "INVALID_PARENT_WORK_ITEM");
                }
                if (item.type === work_item_entity_1.WorkItemType.SUBTASK &&
                    ![work_item_entity_1.WorkItemType.TASK, work_item_entity_1.WorkItemType.STORY].includes(parent.type)) {
                    throw new app_error_1.AppError("A SUBTASK parent must be a TASK or STORY.", 400, "INVALID_SUBTASK_PARENT");
                }
            }
            const newWorkItem = workItemRepo.create({
                organizationId,
                projectId,
                createdById: userId,
                // The newly saved sprint's ID is assigned immediately.
                sprintId: savedSprint.id,
                parentWorkItemId: item.parentWorkItemId ?? null,
                type: item.type,
                title: item.title,
                description: item.description ?? null,
                priority: item.priority ?? work_item_entity_1.WorkItemPriority.MEDIUM,
                status: item.status ?? work_item_entity_1.WorkItemStatus.BACKLOG,
                dueDate: item.dueDate
                    ? new Date(`${item.dueDate}T00:00:00.000Z`)
                    : null,
            });
            const savedWorkItem = await workItemRepo.save(newWorkItem);
            savedWorkItems.push(savedWorkItem);
            const assigneeIds = [...new Set(item.assigneeIds ?? [])];
            if (assigneeIds.length) {
                const assignments = assigneeIds.map((assigneeId) => assigneeRepo.create({
                    workItemId: savedWorkItem.id,
                    userId: assigneeId,
                    assignedById: userId,
                }));
                await assigneeRepo.save(assignments);
            }
        }
        // 7. Attach existing backlog tasks to this same sprint.
        // These tasks keep their existing task IDs.
        for (const item of existingWorkItems) {
            item.sprintId = savedSprint.id;
        }
        if (existingWorkItems.length) {
            const linkedItems = await workItemRepo.save(existingWorkItems);
            savedWorkItems.push(...linkedItems);
        }
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
        // 8. Returning successfully allows the transaction to commit.
        return {
            sprint: savedSprint,
            workItems: returnedWorkItems,
        };
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
