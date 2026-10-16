
import type { Request, Response, NextFunction } from "express";
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
import { Sprint } from "../entities/sprint.entities";

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    organizationId: string;
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

export const createSprint = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;

    const userId = authReq.user.id;
    const organizationId = authReq.user.organizationId;

    // Express may type route params as string | string[].
    // Narrow it to a string before using it in TypeORM queries.
    const projectIdParam = req.params.projectId;

    if (typeof projectIdParam !== "string" || !projectIdParam.trim()) {
      return next(
        new AppError("Invalid project ID.", 400, "INVALID_PROJECT_ID"),
      );
    }

    const projectId: string = projectIdParam;

    // The validation middleware must run before this controller.
    const {
      name,
      goal,
      startDate,
      endDate,
      workItems = [],
    } = req.body as CreateSprintInput;

    const result = await AppDataSource.transaction(async (manager) => {
      const projectRepo = manager.getRepository(Project);
      const memberRepo = manager.getRepository(ProjectMember);
      const userRepo = manager.getRepository(User);
      const sprintRepo = manager.getRepository(Sprint);
      const workItemRepo = manager.getRepository(WorkItem);
      const assigneeRepo = manager.getRepository(WorkItemAssignee);

      // 1. Confirm the project belongs to the authenticated user's organization.
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

      // 2. Only the project creator or project ADMIN/LEAD can create a sprint.
      if (project.createdById !== userId) {
        const membership = await memberRepo.findOne({
          where: {
            projectId,
            userId,
          },
        });

        if (
          !membership ||
          ![ProjectRole.ADMIN, ProjectRole.LEAD].includes(membership.role)
        ) {
          throw new AppError(
            "You do not have permission to create a sprint in this project.",
            403,
            "SPRINT_CREATE_FORBIDDEN",
          );
        }
      }

      // 3. Validate every requested work item type.
      for (const item of workItems) {
        if (!ALLOWED_SPRINT_WORK_ITEM_TYPES.includes(item.type)) {
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
      }

      // 4. Validate assignees before inserting any records.
      const allAssigneeIds = [
        ...new Set(workItems.flatMap((item) => item.assigneeIds ?? [])),
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

        if (allAssigneeIds.some((id) => !projectMemberIds.has(id))) {
          throw new AppError(
            "Every assignee must be a member of this project.",
            400,
            "ASSIGNEE_NOT_PROJECT_MEMBER",
          );
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

      const savedWorkItems: WorkItem[] = [];

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
            throw new AppError(
              "Parent work item must exist in the same project and organization.",
              400,
              "INVALID_PARENT_WORK_ITEM",
            );
          }

          if (
            item.type === WorkItemType.SUBTASK &&
            ![WorkItemType.TASK, WorkItemType.STORY].includes(parent.type)
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
          parentWorkItemId: item.parentWorkItemId ?? null,
          type: item.type,
          title: item.title,
          description: item.description ?? null,
          priority: item.priority ?? WorkItemPriority.MEDIUM,
          status: item.status ?? WorkItemStatus.BACKLOG,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
        });

        const savedWorkItem = await workItemRepo.save(workItem);

        savedWorkItems.push(savedWorkItem);

        // Create the many-to-many assignment records.
        const assigneeIds = item.assigneeIds ?? [];

        if (assigneeIds.length > 0) {
          const assignments = assigneeIds.map((assigneeId) =>
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
    });

    res.status(201).json({
      success: true,
      message: "Sprint created successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectSprints = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const projectIdParam = req.params.projectId;
    if (!projectIdParam || typeof projectIdParam !== "string") {
      throw new AppError("Invalid project ID.", 400, "INVALID_PROJECT_ID");
    }

    const sprintRepo = AppDataSource.getRepository(Sprint);
    const sprints = await sprintRepo.find({
      where: { projectId: projectIdParam },
      order: { startDate: "ASC" },
      relations: { workItems: true },
    });

    res.status(200).json({
      success: true,
      data: sprints,
    });
  } catch (error) {
    next(error);
  }
};

