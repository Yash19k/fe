"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPersonalDashboard = exports.getProjectDashboard = void 0;
const data_source_1 = require("../config/data.source");
const project_entity_1 = require("../entities/project.entity");
const work_item_entity_1 = require("../entities/work.item.entity");
const work_item_assignee_entity_1 = require("../entities/work.item-assignee.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const user_entity_1 = require("../entities/user.entity");
const sprint_entities_1 = require("../entities/sprint.entities");
const app_error_1 = require("../errors/app.error");
const projectRepo = () => data_source_1.AppDataSource.getRepository(project_entity_1.Project);
const workItemRepo = () => data_source_1.AppDataSource.getRepository(work_item_entity_1.WorkItem);
const sprintRepo = () => data_source_1.AppDataSource.getRepository(sprint_entities_1.Sprint);
const STATUS_LABELS = [
    work_item_entity_1.WorkItemStatus.BACKLOG,
    work_item_entity_1.WorkItemStatus.IN_PROGRESS,
    work_item_entity_1.WorkItemStatus.IN_REVIEW,
    work_item_entity_1.WorkItemStatus.TESTING_QA,
    work_item_entity_1.WorkItemStatus.BLOCKED,
    work_item_entity_1.WorkItemStatus.ON_HOLD,
    work_item_entity_1.WorkItemStatus.DONE,
];
const TYPE_LABELS = [
    work_item_entity_1.WorkItemType.EPIC,
    work_item_entity_1.WorkItemType.STORY,
    work_item_entity_1.WorkItemType.TASK,
    work_item_entity_1.WorkItemType.SUBTASK,
    work_item_entity_1.WorkItemType.BUG,
];
const getProjectDashboard = async (req, res) => {
    // Validate the project ID.
    const projectIdParam = req.params.projectId;
    if (typeof projectIdParam !== "string" ||
        projectIdParam.trim().length === 0) {
        throw new app_error_1.AppError("A valid project ID is required", 400);
    }
    const projectId = projectIdParam.trim();
    const userId = req.user?.id;
    if (!userId) {
        throw new app_error_1.AppError("Authentication required.", 401, "UNAUTHORIZED");
    }
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({
        where: { id: userId },
        select: { id: true, organizationId: true, role: true },
    });
    if (!user || !user.organizationId) {
        throw new app_error_1.AppError("Organization not found", 404, "ORGANIZATION_NOT_FOUND");
    }
    // Find the project.
    const project = await projectRepo().findOne({
        where: { id: projectId, organizationId: user.organizationId },
        select: {
            id: true,
            name: true,
            key: true,
            organizationId: true,
            visibility: true,
        },
    });
    if (!project) {
        throw new app_error_1.AppError("Project not found", 404);
    }
    if (project.visibility !== "PUBLIC" && user?.role !== "ADMIN") {
        const membership = await data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember).findOne({
            where: { projectId, userId },
            select: { projectId: true, userId: true },
        });
        if (!membership) {
            throw new app_error_1.AppError("Project not found", 404, "PROJECT_NOT_FOUND");
        }
    }
    // Base query scoped to the requested project.
    const baseQuery = () => workItemRepo()
        .createQueryBuilder("wi")
        .where("wi.projectId = :projectId", { projectId });
    // Summary metrics.
    const totalItems = await baseQuery().getCount();
    const completedItems = await baseQuery()
        .andWhere("wi.status = :status", {
        status: work_item_entity_1.WorkItemStatus.DONE,
    })
        .getCount();
    const incompleteItems = totalItems - completedItems;
    const overdueItems = await baseQuery()
        .andWhere("wi.status != :done", {
        done: work_item_entity_1.WorkItemStatus.DONE,
    })
        .andWhere("wi.dueDate IS NOT NULL")
        .andWhere("wi.dueDate < NOW()")
        .getCount();
    // Work-item type distribution.
    const typeRows = await baseQuery()
        .select("wi.type", "type")
        .addSelect("COUNT(*)", "count")
        .groupBy("wi.type")
        .getRawMany();
    const typeCounts = Object.fromEntries(TYPE_LABELS.map((type) => [type, 0]));
    for (const row of typeRows) {
        typeCounts[row.type] = Number(row.count);
    }
    // Work-item status distribution.
    const statusRows = await baseQuery()
        .select("wi.status", "status")
        .addSelect("COUNT(*)", "count")
        .groupBy("wi.status")
        .getRawMany();
    const statusMap = new Map(statusRows.map((row) => [row.status, Number(row.count)]));
    const statusCounts = STATUS_LABELS.map((status) => {
        const count = statusMap.get(status) ?? 0;
        return {
            status,
            count,
            percentage: totalItems === 0
                ? 0
                : Math.round((count / totalItems) * 100),
        };
    });
    // Workload by assignee.
    const assigneeRows = await data_source_1.AppDataSource
        .getRepository(work_item_assignee_entity_1.WorkItemAssignee)
        .createQueryBuilder("assignment")
        .innerJoin("assignment.workItem", "wi")
        .innerJoin("assignment.user", "user")
        .select("user.id", "userId")
        .addSelect("user.fullName", "fullName")
        .addSelect("COUNT(DISTINCT wi.id)", "taskCount")
        .where("wi.projectId = :projectId", { projectId })
        .andWhere("wi.organizationId = :organizationId", {
        organizationId: project.organizationId,
    })
        .groupBy("user.id")
        .addGroupBy("user.fullName")
        .orderBy('"taskCount"', "DESC")
        .getRawMany();
    const workloadByAssignee = assigneeRows.map((row) => ({
        userId: row.userId,
        name: row.fullName,
        taskCount: Number(row.taskCount),
    }));
    // Sprint completion statistics.
    const sprintRows = await sprintRepo()
        .createQueryBuilder("sprint")
        .leftJoin("sprint.workItems", "wi")
        .select("sprint.id", "sprintId")
        .addSelect("sprint.name", "name")
        .addSelect("sprint.status", "status")
        .addSelect("sprint.startDate", "startDate")
        .addSelect("sprint.endDate", "endDate")
        .addSelect("COUNT(wi.id)", "totalItems")
        .addSelect(`COUNT(wi.id) FILTER (WHERE wi.status = :done)`, "completedItems")
        .where("sprint.projectId = :projectId", { projectId })
        .setParameter("done", work_item_entity_1.WorkItemStatus.DONE)
        .groupBy("sprint.id")
        .addGroupBy("sprint.name")
        .addGroupBy("sprint.status")
        .addGroupBy("sprint.startDate")
        .addGroupBy("sprint.endDate")
        .orderBy("sprint.startDate", "ASC")
        .getRawMany();
    const sprintDeliveryVelocity = sprintRows.map((row) => {
        const total = Number(row.totalItems);
        const completed = Number(row.completedItems);
        return {
            sprintId: row.sprintId,
            name: row.name,
            status: row.status,
            startDate: row.startDate,
            endDate: row.endDate,
            totalItems: total,
            completedItems: completed,
            completionPercentage: total === 0
                ? 0
                : Math.round((completed / total) * 100),
        };
    });
    // Project membership count.
    const memberCount = await data_source_1.AppDataSource
        .getRepository(project_member_entity_1.ProjectMember)
        .count({
        where: { projectId },
    });
    // Active sprint count.
    const activeSprintCount = await sprintRepo().count({
        where: {
            projectId,
            status: sprint_entities_1.SprintStatus.ACTIVE,
        },
    });
    // Send dashboard response.
    res.status(200).json({
        success: true,
        data: {
            project: {
                id: project.id,
                name: project.name,
                key: project.key,
            },
            summary: {
                completedItems,
                incompleteItems,
                overdueItems,
                totalItems,
                completionPercentage: totalItems === 0
                    ? 0
                    : Math.round((completedItems / totalItems) * 100),
                memberCount,
                activeSprintCount,
            },
            workItemTypes: TYPE_LABELS.map((type) => ({
                type,
                count: typeCounts[type],
            })),
            statusDistribution: statusCounts,
            workloadByAssignee,
            sprintDeliveryVelocity,
        },
    });
};
exports.getProjectDashboard = getProjectDashboard;
const getPersonalDashboard = async (req, res) => {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    if (!userId || !organizationId) {
        throw new app_error_1.AppError("Authentication required.", 401, "UNAUTHORIZED");
    }
    // Base query for work items assigned to this user in this organization
    const userTasksQuery = () => workItemRepo()
        .createQueryBuilder("wi")
        .innerJoin("wi.assignments", "assignee", "assignee.userId = :userId", { userId })
        .where("wi.organizationId = :organizationId", { organizationId });
    const total = await userTasksQuery().getCount();
    const completed = await userTasksQuery()
        .andWhere("wi.status = :doneStatus", { doneStatus: work_item_entity_1.WorkItemStatus.DONE })
        .getCount();
    const active = total - completed;
    const overdue = await userTasksQuery()
        .andWhere("wi.status != :doneStatus", { doneStatus: work_item_entity_1.WorkItemStatus.DONE })
        .andWhere("wi.dueDate IS NOT NULL")
        .andWhere("wi.dueDate < NOW()")
        .getCount();
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    const dueSoon = await userTasksQuery()
        .andWhere("wi.status != :doneStatus", { doneStatus: work_item_entity_1.WorkItemStatus.DONE })
        .andWhere("wi.dueDate IS NOT NULL")
        .andWhere("wi.dueDate >= NOW()")
        .andWhere("wi.dueDate <= :fiveDays", { fiveDays: fiveDaysFromNow.toISOString() })
        .getCount();
    const blocked = await userTasksQuery()
        .andWhere("wi.status = :blockedStatus", { blockedStatus: work_item_entity_1.WorkItemStatus.BLOCKED })
        .getCount();
    // Tasks requiring immediate attention (Overdue, Due Soon, or Blocked)
    const attentionItems = await userTasksQuery()
        .leftJoinAndSelect("wi.project", "project")
        .andWhere("wi.status != :doneStatus", { doneStatus: work_item_entity_1.WorkItemStatus.DONE })
        .orderBy("wi.dueDate", "ASC", "NULLS LAST")
        .addOrderBy("wi.createdAt", "DESC")
        .take(10)
        .getMany();
    res.status(200).json({
        success: true,
        data: {
            summary: {
                total,
                completed,
                active,
                overdue,
                dueSoon,
                blocked,
            },
            attentionTasks: attentionItems.map((item) => ({
                id: item.id,
                title: item.title,
                type: item.type,
                status: item.status,
                priority: item.priority,
                dueDate: item.dueDate,
                projectId: item.projectId,
                projectName: item.project?.name,
            })),
        },
    });
};
exports.getPersonalDashboard = getPersonalDashboard;
