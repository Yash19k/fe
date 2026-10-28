
import type { Request, Response } from "express";
import { In } from "typeorm";

import { AppDataSource } from "../config/data.source";
import { Project } from "../entities/project.entity";
import {
  WorkItem,
  WorkItemType,
  WorkItemStatus,
} from "../entities/work.item.entity";
import {
  ProjectMember,
  ProjectRole,
} from "../entities/project.member.entity";

import { AppError } from "../errors/app.error";
import {
  getPagination,
  getPaginationMeta,
} from "../utils/pagination";
import { Sprint, SprintStatus } from "../entities/sprint.entities";
import { NotificationType } from "../entities/notification.entity";
import { createNotificationsBestEffort } from "../services/notification.service";

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    organizationId: string;
    role?: string;
  };
};

type CreateSprintInput = {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  workItemIds?: string[];
};

const ALLOWED_SPRINT_WORK_ITEM_TYPES: WorkItemType[] = [
  WorkItemType.STORY,
  WorkItemType.TASK,
  WorkItemType.SUBTASK,
  WorkItemType.BUG,
];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parsePositiveInteger = (
  value: unknown,
  defaultValue: number,
  maxValue?: number,
): number => {
  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value)
  ) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return defaultValue;
  }

  return maxValue ? Math.min(parsed, maxValue) : parsed;
};

const getProjectId = (req: Request): string => {
  const projectId = req.params.projectId;

  if (
    typeof projectId !== "string" ||
    !projectId.trim()
  ) {
    throw new AppError(
      "Invalid project ID.",
      400,
      "INVALID_PROJECT_ID",
    );
  }

  return projectId;
};

/**
 * Checks that the project belongs to the authenticated
 * user's organization.
 */
const findOrganizationProject = async (
  projectId: string,
  organizationId: string,
): Promise<Project> => {
  const project = await AppDataSource.getRepository(Project).findOne({
    where: {
      id: projectId,
      organizationId,
    },
  });

  if (!project) {
    throw new AppError(
      "Project not found.",
      404,
      "PROJECT_NOT_FOUND",
    );
  }

  return project;
};

/**
 * Organization ADMINs and project creators are treated as
 * project administrators here. Verify that this matches
 * your application's authorization policy.
 */
const isOrganizationAdmin = (userRole?: string): boolean =>
  userRole === "ADMIN";

const getProjectMembership = async (
  projectId: string,
  userId: string,
): Promise<ProjectMember | null> => {
  return AppDataSource.getRepository(ProjectMember).findOne({
    where: {
      projectId,
      userId,
    },
  });
};

const canManageSprint = async (
  project: Project,
  userId: string,
  userRole?: string,
): Promise<boolean> => {
  if (
    project.createdById === userId ||
    isOrganizationAdmin(userRole)
  ) {
    return true;
  }

  const membership = await getProjectMembership(
    project.id,
    userId,
  );

  return Boolean(
    membership &&
      [
        ProjectRole.ADMIN,
        ProjectRole.LEAD,
      ].includes(membership.role),
  );
};

/**
 * Read access: organization admins, project creators,
 * project members, and users who can access a public
 * project within the same organization.
 */
const canReadProject = async (
  project: Project,
  userId: string,
  userRole?: string,
): Promise<boolean> => {
  if (
    project.createdById === userId ||
    isOrganizationAdmin(userRole)
  ) {
    return true;
  }

  const membership = await getProjectMembership(
    project.id,
    userId,
  );

  if (membership) {
    return true;
  }

  return String(project.visibility).toUpperCase() === "PUBLIC";
};


export const createSprint = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  const organizationId = authReq.user.organizationId;
  const projectId = getProjectId(req);

  const { name, goal,startDate,endDate, workItemIds = [], } = req.body as CreateSprintInput;

  if (!Array.isArray(workItemIds)) {
    throw new AppError(
      "workItemIds must be an array.",
      400,
      "INVALID_SPRINT_WORK_ITEMS",
    );
  }

  if (workItemIds.some((id) => typeof id !== "string" || !UUID_REGEX.test(id))) {
    throw new AppError(
      "Every workItemId must be a valid database UUID.",
      400,
      "INVALID_WORK_ITEM_IDS",
    );
  }

  const uniqueWorkItemIds = workItemIds.map((id) => id.trim());

  if (new Set(uniqueWorkItemIds).size !== uniqueWorkItemIds.length) {
    throw new AppError(
      "Duplicate work item IDs are not allowed.",
      400,
      "DUPLICATE_WORK_ITEM_IDS",
    );
  }

  const result = await AppDataSource.transaction(async (manager) => {
    const projectRepo = manager.getRepository(Project);
    const memberRepo = manager.getRepository(ProjectMember);
    const sprintRepo = manager.getRepository(Sprint);
    const workItemRepo = manager.getRepository(WorkItem);

    // 1. Validate project and permission.
    const project = await projectRepo.findOne({
      where: { id: projectId, organizationId },
    });

    if (!project) {
      throw new AppError(
        "Project not found.",
        404,
        "PROJECT_NOT_FOUND",
      );
    }

    let permitted =
      project.createdById === userId ||
      isOrganizationAdmin(authReq.user.role);

    if (!permitted) {
      const membership = await memberRepo.findOne({
        where: { projectId, userId },
      });

      permitted = Boolean(
        membership &&
          [ProjectRole.ADMIN, ProjectRole.LEAD].includes(
            membership.role,
          ),
      );
    }

    if (!permitted) {
      throw new AppError(
        "You do not have permission to create a sprint in this project.",
        403,
        "SPRINT_CREATE_FORBIDDEN",
      );
    }

    // 2. Validate selected existing tasks before writing anything.
    const existingWorkItems = uniqueWorkItemIds.length
      ? await workItemRepo.find({
          where: {
            id: In(uniqueWorkItemIds),
            projectId,
            organizationId,
          },
        })
      : [];

    if (existingWorkItems.length !== uniqueWorkItemIds.length) {
      throw new AppError(
        "One or more selected work items do not exist in this project.",
        400,
        "INVALID_SELECTED_WORK_ITEMS",
      );
    }

    for (const item of existingWorkItems) {
      if (!ALLOWED_SPRINT_WORK_ITEM_TYPES.includes(item.type)) {
        throw new AppError(
          "Only STORY, TASK, SUBTASK, and BUG are allowed in a sprint.",
          400,
          "INVALID_SPRINT_WORK_ITEM_TYPE",
        );
      }

      if (item.sprintId) {
        throw new AppError(
          "A selected task already belongs to a sprint.",
          400,
          "WORK_ITEM_ALREADY_IN_SPRINT",
        );
      }

      if (item.status !== WorkItemStatus.BACKLOG) {
        throw new AppError(
          "Only backlog work items can be added to a new sprint.",
          400,
          "WORK_ITEM_NOT_ELIGIBLE_FOR_SPRINT",
        );
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
            id: In(savedWorkItems.map((item) => item.id)),
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

  const notifications = new Map<
    string,
    { workItemId: string; workItemTitle: string }
  >();

  for (const workItem of result.workItems) {
    for (const assignment of workItem.assignments ?? []) {
      const assigneeId = assignment.userId ?? assignment.user?.id;

      if (!assigneeId || assigneeId === userId) continue;

      notifications.set(assigneeId, {
        workItemId: workItem.id,
        workItemTitle: workItem.title,
      });
    }
  }

  await createNotificationsBestEffort(
    [...notifications.entries()].map(([assigneeId, item]) => ({
        userId: assigneeId,
        organizationId,
        type: NotificationType.TASK_UPDATED,
        title: "Task added to a sprint",
        message: `"${item.workItemTitle}" has been added to sprint "${result.sprint.name}".`,
        workItemId: item.workItemId,
        projectId,
        link: `/projects/${projectId}/sprints`,
        metadata: {
          sprintId: result.sprint.id,
          sprintName: result.sprint.name,
        },
      })),
    {
      operation: "sprint-create",
      organizationId,
      projectId,
    },
  );

  res.status(201).json({
    success: true,
    message: "Sprint created successfully.",
    data: result,
  });
};


export const getProjectSprints = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  const organizationId = authReq.user.organizationId;
  const projectId = getProjectId(req);

  const project = await findOrganizationProject(
    projectId,
    organizationId,
  );

  const hasReadAccess = await canReadProject(
    project,
    userId,
    authReq.user.role,
  );

  if (!hasReadAccess) {
    // Do not reveal the existence of inaccessible private projects.
    throw new AppError(
      "Project not found.",
      404,
      "PROJECT_NOT_FOUND",
    );
  }

  const page = parsePositiveInteger(
    req.query.page,
    DEFAULT_PAGE,
  );

  const limit = parsePositiveInteger(
    req.query.limit,
    DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const sprintRepo = AppDataSource.getRepository(Sprint);

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
    ...getPagination({ page, limit }),
  });

  res.status(200).json({
    success: true,
    data: sprints,
    pagination: getPaginationMeta({
      page,
      limit,
      total,
    }),
  });
};

export const getSprintById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projectId = getProjectId(req);
  const sprintId = req.params.sprintId;

  if (!sprintId || !UUID_REGEX.test(sprintId)) {
    throw new AppError("Invalid sprint ID.", 400, "INVALID_SPRINT_ID");
  }

  const sprintRepo = AppDataSource.getRepository(Sprint);
  const sprint = await sprintRepo.findOne({
    where: { id: sprintId, projectId },
    relations: {
      workItems: {
        assignments: {
          user: true,
        },
      },
    },
  });

  if (!sprint) {
    throw new AppError("Sprint not found.", 404, "SPRINT_NOT_FOUND");
  }

  res.status(200).json({
    success: true,
    data: sprint,
  });
};

export const updateSprint = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projectId = getProjectId(req);
  const sprintId = req.params.sprintId;

  if (!sprintId || !UUID_REGEX.test(sprintId)) {
    throw new AppError("Invalid sprint ID.", 400, "INVALID_SPRINT_ID");
  }

  const sprintRepo = AppDataSource.getRepository(Sprint);
  const sprint = await sprintRepo.findOne({
    where: { id: sprintId, projectId },
  });

  if (!sprint) {
    throw new AppError("Sprint not found.", 404, "SPRINT_NOT_FOUND");
  }

  const { name, goal, startDate, endDate, status } = req.body;

  if (name !== undefined) sprint.name = name;
  if (goal !== undefined) sprint.goal = goal ?? null;
  if (startDate !== undefined) sprint.startDate = startDate;
  if (endDate !== undefined) sprint.endDate = endDate;
  if (status !== undefined) sprint.status = status;

  const updatedSprint = await sprintRepo.save(sprint);

  res.status(200).json({
    success: true,
    message: "Sprint updated successfully.",
    data: updatedSprint,
  });
};

export const startSprint = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projectId = getProjectId(req);
  const sprintId = req.params.sprintId;

  if (!sprintId || !UUID_REGEX.test(sprintId)) {
    throw new AppError("Invalid sprint ID.", 400, "INVALID_SPRINT_ID");
  }

  const sprintRepo = AppDataSource.getRepository(Sprint);
  const sprint = await sprintRepo.findOne({
    where: { id: sprintId, projectId },
  });

  if (!sprint) {
    throw new AppError("Sprint not found.", 404, "SPRINT_NOT_FOUND");
  }

  if (sprint.status === SprintStatus.ACTIVE) {
    throw new AppError("Sprint is already active.", 400, "SPRINT_ALREADY_ACTIVE");
  }

  if (sprint.status === SprintStatus.COMPLETED) {
    throw new AppError("Cannot start a completed sprint.", 400, "SPRINT_ALREADY_COMPLETED");
  }

  const activeSprint = await sprintRepo.findOne({
    where: { projectId, status: SprintStatus.ACTIVE },
  });

  if (activeSprint) {
    throw new AppError(
      `Sprint "${activeSprint.name}" is already active. Complete it before starting another.`,
      400,
      "ANOTHER_SPRINT_ACTIVE",
    );
  }

  sprint.status = SprintStatus.ACTIVE;
  const updatedSprint = await sprintRepo.save(sprint);

  res.status(200).json({
    success: true,
    message: "Sprint started successfully.",
    data: updatedSprint,
  });
};

export const completeSprint = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projectId = getProjectId(req);
  const sprintId = req.params.sprintId;

  if (!sprintId || !UUID_REGEX.test(sprintId)) {
    throw new AppError("Invalid sprint ID.", 400, "INVALID_SPRINT_ID");
  }

  const sprintRepo = AppDataSource.getRepository(Sprint);
  const sprint = await sprintRepo.findOne({
    where: { id: sprintId, projectId },
  });

  if (!sprint) {
    throw new AppError("Sprint not found.", 404, "SPRINT_NOT_FOUND");
  }

  if (sprint.status !== SprintStatus.ACTIVE) {
    throw new AppError("Only active sprints can be completed.", 400, "SPRINT_NOT_ACTIVE");
  }

  sprint.status = SprintStatus.COMPLETED;
  const updatedSprint = await sprintRepo.save(sprint);

  res.status(200).json({
    success: true,
    message: "Sprint completed successfully.",
    data: updatedSprint,
  });
};

export const deleteSprint = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projectId = getProjectId(req);
  const sprintId = req.params.sprintId;

  if (!sprintId || !UUID_REGEX.test(sprintId)) {
    throw new AppError("Invalid sprint ID.", 400, "INVALID_SPRINT_ID");
  }

  const sprintRepo = AppDataSource.getRepository(Sprint);
  const workItemRepo = AppDataSource.getRepository(WorkItem);

  const sprint = await sprintRepo.findOne({
    where: { id: sprintId, projectId },
  });

  if (!sprint) {
    throw new AppError("Sprint not found.", 404, "SPRINT_NOT_FOUND");
  }

  // Safely unlink any work items associated with this sprint before deleting
  await workItemRepo.update({ sprintId }, { sprintId: null });

  await sprintRepo.remove(sprint);

  res.status(200).json({
    success: true,
    message: "Sprint deleted successfully.",
  });
};
