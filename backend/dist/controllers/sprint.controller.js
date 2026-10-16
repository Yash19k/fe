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
const sprint_entities_1 = require("../entities/sprint.entities");
const ALLOWED_SPRINT_WORK_ITEM_TYPES = [
    work_item_entity_1.WorkItemType.STORY,
    work_item_entity_1.WorkItemType.TASK,
    work_item_entity_1.WorkItemType.SUBTASK,
    work_item_entity_1.WorkItemType.BUG,
];
const createSprint = async (req, res, next) => {
    try {
        const authReq = req;
        const userId = authReq.user.id;
        const organizationId = authReq.user.organizationId;
        // Express may type route params as string | string[].
        // Narrow it to a string before using it in TypeORM queries.
        const projectIdParam = req.params.projectId;
        if (typeof projectIdParam !== "string" || !projectIdParam.trim()) {
            return next(new app_error_1.AppError("Invalid project ID.", 400, "INVALID_PROJECT_ID"));
        }
        const projectId = projectIdParam;
        // The validation middleware must run before this controller.
        const { name, goal, startDate, endDate, workItems = [], } = req.body;
        const result = await data_source_1.AppDataSource.transaction(async (manager) => {
            const projectRepo = manager.getRepository(project_entity_1.Project);
            const memberRepo = manager.getRepository(project_member_entity_1.ProjectMember);
            const userRepo = manager.getRepository(user_entity_1.User);
            const sprintRepo = manager.getRepository(sprint_entities_1.Sprint);
            const workItemRepo = manager.getRepository(work_item_entity_1.WorkItem);
            const assigneeRepo = manager.getRepository(work_item_assignee_entity_1.WorkItemAssignee);
            // 1. Confirm the project belongs to the authenticated user's organization.
            const project = await projectRepo.findOne({
                where: {
                    id: projectId,
                    organizationId,
                },
            });
            if (!project) {
                throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
            }
            // 2. Only the project creator or project ADMIN/LEAD can create a sprint.
            if (project.createdById !== userId) {
                const membership = await memberRepo.findOne({
                    where: {
                        projectId,
                        userId,
                    },
                });
                if (!membership ||
                    ![project_member_entity_1.ProjectRole.ADMIN, project_member_entity_1.ProjectRole.LEAD].includes(membership.role)) {
                    throw new app_error_1.AppError("You do not have permission to create a sprint in this project.", 403, "SPRINT_CREATE_FORBIDDEN");
                }
            }
            // 3. Validate every requested work item type.
            for (const item of workItems) {
                if (!ALLOWED_SPRINT_WORK_ITEM_TYPES.includes(item.type)) {
                    throw new app_error_1.AppError("Only STORY, TASK, SUBTASK, and BUG are allowed in a sprint.", 400, "INVALID_SPRINT_WORK_ITEM_TYPE");
                }
                if (item.type === work_item_entity_1.WorkItemType.SUBTASK &&
                    !item.parentWorkItemId) {
                    throw new app_error_1.AppError("A SUBTASK must have a parent work item.", 400, "SUBTASK_PARENT_REQUIRED");
                }
            }
            // 4. Validate assignees before inserting any records.
            const allAssigneeIds = [
                ...new Set(workItems.flatMap((item) => item.assigneeIds ?? [])),
            ];
            if (allAssigneeIds.length > 0) {
                const users = await userRepo.find({
                    where: {
                        id: (0, typeorm_1.In)(allAssigneeIds),
                        organizationId,
                        status: user_entity_1.UserStatus.ACTIVE,
                    },
                    select: {
                        id: true,
                    },
                });
                if (users.length !== allAssigneeIds.length) {
                    throw new app_error_1.AppError("One or more assignees are invalid, inactive, or outside your organization.", 400, "INVALID_ASSIGNEES");
                }
                const memberships = await memberRepo.find({
                    where: {
                        projectId,
                        userId: (0, typeorm_1.In)(allAssigneeIds),
                    },
                    select: {
                        userId: true,
                    },
                });
                const projectMemberIds = new Set(memberships.map((membership) => membership.userId));
                if (allAssigneeIds.some((id) => !projectMemberIds.has(id))) {
                    throw new app_error_1.AppError("Every assignee must be a member of this project.", 400, "ASSIGNEE_NOT_PROJECT_MEMBER");
                }
            }
            // 5. Create the sprint.
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
            // 6. Create work items and their assignments inside the same transaction.
            for (const item of workItems) {
                // Validate parent work item, if provided.
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
                const workItem = workItemRepo.create({
                    organizationId,
                    projectId,
                    createdById: userId,
                    sprintId: savedSprint.id,
                    parentWorkItemId: item.parentWorkItemId ?? null,
                    type: item.type,
                    title: item.title,
                    description: item.description ?? null,
                    priority: item.priority ?? work_item_entity_1.WorkItemPriority.MEDIUM,
                    status: item.status ?? work_item_entity_1.WorkItemStatus.BACKLOG,
                    dueDate: item.dueDate ? new Date(item.dueDate) : null,
                });
                const savedWorkItem = await workItemRepo.save(workItem);
                savedWorkItems.push(savedWorkItem);
                // Create the many-to-many assignment records.
                const assigneeIds = item.assigneeIds ?? [];
                if (assigneeIds.length > 0) {
                    const assignments = assigneeIds.map((assigneeId) => assigneeRepo.create({
                        workItemId: savedWorkItem.id,
                        userId: assigneeId,
                        assignedById: userId,
                    }));
                    await assigneeRepo.save(assignments);
                }
            }
            return {
                sprint: savedSprint,
                workItems: savedWorkItems,
            };
        });
        res.status(201).json({
            success: true,
            message: "Sprint created successfully.",
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createSprint = createSprint;
const getProjectSprints = async (req, res, next) => {
    try {
        const projectIdParam = req.params.projectId;
        if (!projectIdParam || typeof projectIdParam !== "string") {
            throw new app_error_1.AppError("Invalid project ID.", 400, "INVALID_PROJECT_ID");
        }
        const sprintRepo = data_source_1.AppDataSource.getRepository(sprint_entities_1.Sprint);
        const sprints = await sprintRepo.find({
            where: { projectId: projectIdParam },
            order: { startDate: "ASC" },
            relations: { workItems: true },
        });
        res.status(200).json({
            success: true,
            data: sprints,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getProjectSprints = getProjectSprints;
