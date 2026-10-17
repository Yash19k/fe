
import type { Request, Response } from "express";
import { In } from "typeorm";

import { AppDataSource } from "../config/data.source";
import { Project } from "../entities/project.entity";
import {
  WorkItem,
  WorkItemType,
  WorkItemStatus,
  WorkItemPriority,
} from "../entities/work.item.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import {
  ProjectMember,
  ProjectRole,
} from "../entities/project.member.entity";
import { User, UserStatus } from "../entities/user.entity";

import { AppError } from "../errors/app.error";
import {
  getPagination,
  getPaginationMeta,
} from "../utils/pagination";
import { Sprint } from "../entities/sprint.entities";

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    organizationId: string;
    role?: string;
  };
};

type CreateWorkItemInput = {
  type: WorkItemType;
  title: string;
  description?: string | null;
  priority?: WorkItemPriority;
  status?: WorkItemStatus;
  dueDate?: string | null;
  parentWorkItemId?: string | null;
  assigneeIds?: string[];
};

type CreateSprintInput = {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  workItems?: CreateWorkItemInput[];
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

  const {
    name,
    goal,
    startDate,
    endDate,
    workItems = [],
  } = req.body as CreateSprintInput;

  const result = await AppDataSource.transaction(
    async (manager) => {
      const projectRepo = manager.getRepository(Project);
      const memberRepo = manager.getRepository(ProjectMember);
      const userRepo = manager.getRepository(User);
      const sprintRepo = manager.getRepository(Sprint);
      const workItemRepo = manager.getRepository(WorkItem);
      const assigneeRepo = manager.getRepository(WorkItemAssignee);

      const project = await projectRepo.findOne({
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

      let hasPermission =
        project.createdById === userId ||
        isOrganizationAdmin(authReq.user.role);

      if (!hasPermission) {
        const membership = await memberRepo.findOne({
          where: {
            projectId,
            userId,
          },
        });

        hasPermission = Boolean(
          membership &&
            [
              ProjectRole.ADMIN,
              ProjectRole.LEAD,
            ].includes(membership.role),
        );
      }

      if (!hasPermission) {
        throw new AppError(
          "You do not have permission to create a sprint in this project.",
          403,
          "SPRINT_CREATE_FORBIDDEN",
        );
      }

      // Validate all requested work-item types.
      for (const item of workItems) {
        if (
          !ALLOWED_SPRINT_WORK_ITEM_TYPES.includes(item.type)
        ) {
          throw new AppError(
            "Only STORY, TASK, SUBTASK, and BUG are allowed in a sprint.",
            400,
            "INVALID_SPRINT_WORK_ITEM_TYPE",
          );
        }

        if (
          item.type === WorkItemType.SUBTASK &&
          !item.parentWorkItemId
        ) {
          throw new AppError(
            "A SUBTASK must have a parent work item.",
            400,
            "SUBTASK_PARENT_REQUIRED",
          );
        }

        if (
          item.type !== WorkItemType.SUBTASK &&
          item.parentWorkItemId
        ) {
          throw new AppError(
            "Only a SUBTASK may have a parent work item.",
            400,
            "PARENT_NOT_ALLOWED",
          );
        }
      }

      // Validate assignees before inserting any records.
      const allAssigneeIds = [
        ...new Set(
          workItems.flatMap(
            (item) => item.assigneeIds ?? [],
          ),
        ),
      ];

      if (allAssigneeIds.length > 0) {
        const users = await userRepo.find({
          where: {
            id: In(allAssigneeIds),
            organizationId,
            status: UserStatus.ACTIVE,
          },
          select: {
            id: true,
          },
        });

        if (users.length !== allAssigneeIds.length) {
          throw new AppError(
            "One or more assignees are invalid, inactive, or outside your organization.",
            400,
            "INVALID_ASSIGNEES",
          );
        }

        const memberships = await memberRepo.find({
          where: {
            projectId,
            userId: In(allAssigneeIds),
          },
          select: {
            userId: true,
          },
        });

        const projectMemberIds = new Set(
          memberships.map((membership) => membership.userId),
        );

        if (
          allAssigneeIds.some(
            (id) => !projectMemberIds.has(id),
          )
        ) {
          throw new AppError(
            "Every assignee must be a member of this project.",
            400,
            "ASSIGNEE_NOT_PROJECT_MEMBER",
          );
        }
      }

      const sprint = sprintRepo.create({
        projectId,
        createdById: userId,
        name,
        goal: goal ?? null,
        startDate,
        endDate,
      });

      const savedSprint = await sprintRepo.save(sprint);
      const savedWorkItems: WorkItem[] = [];

      // Work-item creation and assignments share this transaction.
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
            throw new AppError(
              "Parent work item must exist in the same project and organization.",
              400,
              "INVALID_PARENT_WORK_ITEM",
            );
          }

          if (
            item.type === WorkItemType.SUBTASK &&
            ![
              WorkItemType.TASK,
              WorkItemType.STORY,
            ].includes(parent.type)
          ) {
            throw new AppError(
              "A SUBTASK parent must be a TASK or STORY.",
              400,
              "INVALID_SUBTASK_PARENT",
            );
          }
        }

        const workItem = workItemRepo.create({
          organizationId,
          projectId,
          createdById: userId,
          sprintId: savedSprint.id,
          parentWorkItemId:
            item.parentWorkItemId ?? null,
          type: item.type,
          title: item.title,
          description: item.description ?? null,
          priority:
            item.priority ?? WorkItemPriority.MEDIUM,
          status: item.status ?? WorkItemStatus.BACKLOG,
          dueDate: item.dueDate
            ? new Date(`${item.dueDate}T00:00:00.000Z`)
            : null,
        });

        const savedWorkItem = await workItemRepo.save(
          workItem,
        );

        savedWorkItems.push(savedWorkItem);

        const assigneeIds = item.assigneeIds ?? [];

        if (assigneeIds.length > 0) {
          const assignments = assigneeIds.map(
            (assigneeId) =>
              assigneeRepo.create({
                workItemId: savedWorkItem.id,
                userId: assigneeId,
                assignedById: userId,
              }),
          );

          await assigneeRepo.save(assignments);
        }
      }

      return {
        sprint: savedSprint,
        workItems: savedWorkItems,
      };
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
