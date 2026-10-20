
import { Request, Response } from "express";
import { AppDataSource } from "../config/data.source";
import { Project } from "../entities/project.entity";
import {
  WorkItem,
  WorkItemType,
  WorkItemStatus,
} from "../entities/work.item.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import { ProjectMember } from "../entities/project.member.entity";
import { User } from "../entities/user.entity";
import { Sprint, SprintStatus } from "../entities/sprint.entities";
import { AppError } from "../errors/app.error";


const projectRepo = () => AppDataSource.getRepository(Project);
const workItemRepo = () => AppDataSource.getRepository(WorkItem);
const sprintRepo = () => AppDataSource.getRepository(Sprint);

const STATUS_LABELS = [
  WorkItemStatus.BACKLOG,
  WorkItemStatus.IN_PROGRESS,
  WorkItemStatus.IN_REVIEW,
  WorkItemStatus.TESTING_QA,
  WorkItemStatus.BLOCKED,
  WorkItemStatus.ON_HOLD,
  WorkItemStatus.DONE,
];

const TYPE_LABELS = [
  WorkItemType.EPIC,
  WorkItemType.STORY,
  WorkItemType.TASK,
  WorkItemType.SUBTASK,
  WorkItemType.BUG,
];

export const getProjectDashboard = async (
  req: Request,
  res: Response
): Promise<void> => {
  // Validate the project ID.
  const projectIdParam = req.params.projectId;

  if (
    typeof projectIdParam !== "string" ||
    projectIdParam.trim().length === 0
  ) {
    throw new AppError("A valid project ID is required", 400);
  }

  const projectId = projectIdParam.trim();

  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: { id: true, organizationId: true, role: true },
  });

  if (!user || !user.organizationId) {
    throw new AppError("Organization not found", 404, "ORGANIZATION_NOT_FOUND");
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
    throw new AppError("Project not found", 404);
  }

  if (project.visibility !== "PUBLIC" && user?.role !== "ADMIN") {
    const membership = await AppDataSource.getRepository(ProjectMember).findOne({
      where: { projectId, userId },
      select: { projectId: true, userId: true },
    });

    if (!membership) {
      throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
    }
  }

  // Base query scoped to the requested project.
  const baseQuery = () =>
    workItemRepo()
      .createQueryBuilder("wi")
      .where("wi.projectId = :projectId", { projectId });

  // Summary metrics.
  const totalItems = await baseQuery().getCount();

  const completedItems = await baseQuery()
    .andWhere("wi.status = :status", {
      status: WorkItemStatus.DONE,
    })
    .getCount();

  const incompleteItems = totalItems - completedItems;

  const overdueItems = await baseQuery()
    .andWhere("wi.status != :done", {
      done: WorkItemStatus.DONE,
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

  const typeCounts = Object.fromEntries(
    TYPE_LABELS.map((type) => [type, 0])
  ) as Record<WorkItemType, number>;

  for (const row of typeRows) {
    typeCounts[row.type as WorkItemType] = Number(row.count);
  }

  // Work-item status distribution.
  const statusRows = await baseQuery()
    .select("wi.status", "status")
    .addSelect("COUNT(*)", "count")
    .groupBy("wi.status")
    .getRawMany();

  const statusMap = new Map<string, number>(
    statusRows.map((row) => [row.status, Number(row.count)])
  );

  const statusCounts = STATUS_LABELS.map((status) => {
    const count = statusMap.get(status) ?? 0;

    return {
      status,
      count,
      percentage:
        totalItems === 0
          ? 0
          : Math.round((count / totalItems) * 100),
    };
  });

  // Workload by assignee.
  const assigneeRows = await AppDataSource
    .getRepository(WorkItemAssignee)
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
    .addSelect(
      `COUNT(wi.id) FILTER (WHERE wi.status = :done)`,
      "completedItems"
    )
    .where("sprint.projectId = :projectId", { projectId })
    .setParameter("done", WorkItemStatus.DONE)
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
      completionPercentage:
        total === 0
          ? 0
          : Math.round((completed / total) * 100),
    };
  });

  // Project membership count.
  const memberCount = await AppDataSource
    .getRepository(ProjectMember)
    .count({
      where: { projectId },
    });

  // Active sprint count.
  const activeSprintCount = await sprintRepo().count({
    where: {
      projectId,
      status: SprintStatus.ACTIVE,
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
        completionPercentage:
          totalItems === 0
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
