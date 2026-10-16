import { Request, Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../config/data.source";
import { User, UserStatus } from "../entities/user.entity";
import { Project, ProjectVisibility,} from "../entities/project.entity";
import { ProjectMember } from "../entities/project.member.entity";
import { WorkItem, WorkItemType, WorkItemStatus, WorkItemPriority,} from "../entities/work.item.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import {WorkItemRecurrence, RecurrenceFrequency, MonthlyPattern,} from "../entities/work.item.recurrence.entity";
import { AppError } from "../errors/app.error";
import {getPagination,getPaginationMeta,} from "../utils/pagination";
interface AssigneeInput { userId: string;startDate?: string | null; estimatedHours?: number | null;}
interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  interval?: number;
  // Weekday numbering: Sunday = 0 through Saturday = 6.
  daysOfWeek?: number[] | null;
  monthlyPattern?: MonthlyPattern | null;
  dayOfMonth?: number | null;
  startsOn: string; // YYYY-MM-DD
  endsOn?: string | null; // YYYY-MM-DD
  timezone?: string;
}

interface CreateWorkItemBody {
  projectId: string;
  parentWorkItemId?: string | null;
  type: WorkItemType;
  title: string;
  description?: string | null;
  priority: WorkItemPriority;
  status: WorkItemStatus;
  dueDate?: string | Date | null;
  assignees?: AssigneeInput[];
  recurrence?: RecurrenceInput | null;
}

function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

function validateRecurrence(input: RecurrenceInput): void {
  if (!Object.values(RecurrenceFrequency).includes(input.frequency)) {
    throw new AppError("Invalid recurrence frequency", 400, "INVALID_RECURRENCE_FREQUENCY");
  }

  const interval = input.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1) {
    throw new AppError("Recurrence interval must be a positive integer", 400, "INVALID_RECURRENCE_INTERVAL");
  }

  if (!isValidDateOnly(input.startsOn)) {
    throw new AppError("startsOn must be a valid YYYY-MM-DD date", 400, "INVALID_RECURRENCE_START_DATE");
  }

  if (input.endsOn != null) {
    if (!isValidDateOnly(input.endsOn) || input.endsOn < input.startsOn) {
      throw new AppError("endsOn must be a valid date on or after startsOn", 400, "INVALID_RECURRENCE_END_DATE");
    }
  }

  const timezone = input.timezone ?? "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new AppError("Invalid IANA timezone", 400, "INVALID_RECURRENCE_TIMEZONE");
  }

  if (input.frequency === RecurrenceFrequency.WEEKLY) {
    const days = input.daysOfWeek;
    if (
      !Array.isArray(days) ||
      days.length === 0 ||
      days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
      new Set(days).size !== days.length
    ) {
      throw new AppError(
        "Weekly recurrence requires unique daysOfWeek values from 0 (Sunday) to 6 (Saturday)",
        400,
        "INVALID_RECURRENCE_DAYS",
      );
    }
  }

  if (input.frequency === RecurrenceFrequency.MONTHLY) {
    if (
      !input.monthlyPattern ||
      !Object.values(MonthlyPattern).includes(input.monthlyPattern)
    ) {
      throw new AppError("Monthly recurrence requires a valid monthlyPattern", 400, "INVALID_MONTHLY_PATTERN");
    }

    if (input.monthlyPattern === MonthlyPattern.DAY_OF_MONTH) {
      if (
        !Number.isInteger(input.dayOfMonth) ||
        (input.dayOfMonth as number) < 1 ||
        (input.dayOfMonth as number) > 31
      ) {
        throw new AppError(
          "DAY_OF_MONTH recurrence requires dayOfMonth between 1 and 31",
          400,
          "INVALID_DAY_OF_MONTH",
        );
      }
    } else if (input.dayOfMonth != null) {
      throw new AppError(
        "dayOfMonth should only be supplied with DAY_OF_MONTH pattern",
        400,
        "UNEXPECTED_DAY_OF_MONTH",
      );
    }
  }
}
export const createWorkItem = 
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const {
      projectId,
      parentWorkItemId,
      type,
      title,
      description,
      priority,
      status,
      dueDate,
      assignees = [],
      recurrence,
    } = req.body as CreateWorkItemBody;

    if (typeof title !== "string" || !title.trim()) {
      throw new AppError("Work item title is required", 400, "TITLE_REQUIRED");
    }

    if (!Array.isArray(assignees)) {
      throw new AppError("assignees must be an array", 400, "INVALID_ASSIGNEES");
    }

    if (recurrence) {
      validateRecurrence(recurrence);
    }

    const result = await AppDataSource.transaction(
      async (manager) => {
        const userRepository = manager.getRepository(User);
        const projectRepository = manager.getRepository(Project);
        const projectMemberRepository =
          manager.getRepository(ProjectMember);
        const workItemRepository = manager.getRepository(WorkItem);
        const assigneeRepository =
          manager.getRepository(WorkItemAssignee);
        const recurrenceRepository =
          manager.getRepository(WorkItemRecurrence);

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
          throw new AppError(
            "User not found",
            404,
            "USER_NOT_FOUND"
          );
        }

        if (user.status !== UserStatus.ACTIVE) {
          throw new AppError("Your account is not active", 403, "ACCOUNT_INACTIVE");
        }

        if (!user.organizationId) {
          throw new AppError("Account is not associated with an organization", 403, "ORGANIZATION_NOT_FOUND");
        }
        const organizationId: string = user.organizationId;

        // 2. Check organization isolation and project visibility.
        const project = await projectRepository
          .createQueryBuilder("project")
          .leftJoin(
            "project.memberships",
            "membership",
            "membership.userId = :userId",
            { userId: user.id }
          )
          .where("project.id = :projectId", { projectId })
          .andWhere(
            "project.organizationId = :organizationId",
            { organizationId }
          )
          .andWhere(
            `(
              project.visibility = :publicVisibility
              OR membership.userId = :userId
            )`,
            {
              publicVisibility: ProjectVisibility.PUBLIC,
              userId: user.id,
            }
          )
          .getOne();

        if (!project) {
          throw new AppError(
            "Project not found or you do not have access to it",
            404,
            "PROJECT_NOT_FOUND"
          );
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
            throw new AppError(
              "Parent work item not found in this project",
              404,
              "PARENT_WORK_ITEM_NOT_FOUND"
            );
          }
        }

        // 4. Validate assignees: active users in this organization and project.
        const assigneeIds = assignees.map((assignee) => assignee.userId);
        const uniqueAssigneeIds = [...new Set(assigneeIds)];

        if (uniqueAssigneeIds.length !== assigneeIds.length) {
          throw new AppError(
            "An assignee can only be included once",
            400,
            "DUPLICATE_ASSIGNEE",
          );
        }

        if (assigneeIds.length > 0) {
          const eligibleUsers = await userRepository.find({
            where: {
              id: In(assigneeIds),
              organizationId: user.organizationId,
              status: UserStatus.ACTIVE,
            },
            select: { id: true },
          });

          if (eligibleUsers.length !== assigneeIds.length) {
            throw new AppError(
              "All assignees must be active users in your organization",
              400,
              "INVALID_ASSIGNEE",
            );
          }

          const memberships = await projectMemberRepository.find({
            where: {
              projectId: project.id,
              userId: In(assigneeIds),
            },
            select: { userId: true },
          });

          if (memberships.length !== assigneeIds.length) {
            throw new AppError(
              "All assignees must be members of the selected project",
              400,
              "ASSIGNEE_NOT_PROJECT_MEMBER",
            );
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
          dueDate:
            dueDate == null ? null : new Date(dueDate),
        });

        const savedWorkItem: WorkItem =
          await workItemRepository.save(workItem);

        // 7. Create multiple assignee records.
        if (assignees.length > 0) {
          const assignments = assignees.map((assignee) =>
            assigneeRepository.create({
              workItemId: savedWorkItem.id,
              userId: assignee.userId,
              assignedById: user.id,
              startDate: assignee.startDate ?? null,
              estimatedHours:
                assignee.estimatedHours == null
                  ? null
                  : String(assignee.estimatedHours),
            })
          );

          await assigneeRepository.save(assignments);
        }

        // 8. Save the recurrence rule in the same transaction.
        // The scheduler uses this rule to create future work items.
        let savedRecurrence: WorkItemRecurrence | null = null;

        if (recurrence) {
          const timezone = recurrence.timezone ?? "UTC";
          const startsOn = recurrence.startsOn;
          const endsOn = recurrence.endsOn ?? null;

          savedRecurrence = await recurrenceRepository.save(
            recurrenceRepository.create({
              workItem: savedWorkItem,
              frequency: recurrence.frequency,
              interval: recurrence.interval ?? 1,
              daysOfWeek:
                recurrence.frequency === RecurrenceFrequency.WEEKLY
                  ? recurrence.daysOfWeek ?? []
                  : null,
              monthlyPattern:
                recurrence.frequency === RecurrenceFrequency.MONTHLY
                  ? recurrence.monthlyPattern ?? null
                  : null,
              dayOfMonth:
                recurrence.frequency === RecurrenceFrequency.MONTHLY &&
                recurrence.monthlyPattern === MonthlyPattern.DAY_OF_MONTH
                  ? recurrence.dayOfMonth ?? null
                  : null,
              startsOn,
              endsOn,
              // Date-only start marker. The recurrence worker must interpret
              // calendar dates using the stored timezone when calculating runs.
              nextRunAt: new Date(`${startsOn}T00:00:00.000Z`),
              timezone,
              isActive: true,
            }),
          );
        }

        return {
          workItem: savedWorkItem,
          assigneeIds,
          recurrence: savedRecurrence,
        };
      }
    );

    res.status(201).json({
      success: true,
      message: "Work item created successfully",
      data: {
        ...result.workItem,
        assigneeIds: result.assigneeIds,
        recurrence: result.recurrence,
      },
    });
  }


interface ViewWorkItemsQuery {
  page: number;
  limit: number;
  status?: WorkItemStatus;
  type?: WorkItemType;
}
///View project 
export const getProjectWorkItems =async (req: Request, res: Response) => {
  const userId = req.user?.id;

    if (!userId) {
      throw new AppError(
        "Authentication required",
        401,
        "UNAUTHORIZED"
      );
    }

    const { projectId } = req.params;

    const {
      page,
      limit,
      status,
      type,
    } = res.locals.validatedWorkItemQuery as ViewWorkItemsQuery;

    const userRepository = AppDataSource.getRepository(User);
    const projectRepository = AppDataSource.getRepository(Project);
    const workItemRepository = AppDataSource.getRepository(WorkItem);

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
      throw new AppError(
        "User not found",
        404,
        "USER_NOT_FOUND"
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppError(
        "Your account is not active",
        403,
        "ACCOUNT_INACTIVE"
      );
    }

    // 2. Check project organization and visibility.
    const project = await projectRepository
      .createQueryBuilder("project")
      .leftJoin(
        "project.memberships",
        "membership",
        "membership.userId = :userId",
        { userId }
      )
      .where("project.id = :projectId", { projectId })
      .andWhere(
        "project.organizationId = :organizationId",
        { organizationId: user.organizationId }
      )
      .andWhere(
        `(project.visibility = :publicVisibility
          OR membership.userId = :userId)`,
        {
          publicVisibility: ProjectVisibility.PUBLIC,
          userId,
        }
      )
      .getOne();

    if (!project) {
      throw new AppError(
        "Project not found or you do not have access to it",
        404,
        "PROJECT_NOT_FOUND"
      );
    }

    // 3. Calculate reusable pagination values.
    const { skip, take } = getPagination({ page, limit });

    // 4. Build the project work-items query.
    const query = workItemRepository
      .createQueryBuilder("workItem")
      .where("workItem.projectId = :projectId", {
        projectId: project.id,
      })
      .andWhere(
        "workItem.organizationId = :organizationId",
        { organizationId: user.organizationId }
      )
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
        pagination: getPaginationMeta({
          page,
          limit,
          total,
        }),
      },
    });
  }

export const updateWorkItem = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const workItemId = req.params.workItemId;
  if (!userId || typeof workItemId !== "string") {
    throw new AppError("Invalid work item request.", 400, "INVALID_WORK_ITEM_ID");
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: { id: true, organizationId: true },
  });
  if (!user || !user.organizationId) {
    throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
  }
  const organizationId = user.organizationId;
  const project = await AppDataSource.getRepository(Project)
    .createQueryBuilder("project")
    .leftJoin("project.memberships", "membership", "membership.userId = :userId", { userId })
    .where("project.id = (SELECT work_item.project_id FROM work_items work_item WHERE work_item.id = :workItemId)", { workItemId })
    .andWhere("project.organizationId = :organizationId", { organizationId })
    .andWhere("(project.visibility = :publicVisibility OR membership.userId = :userId)", {
      publicVisibility: ProjectVisibility.PUBLIC,
      userId,
    })
    .getOne();
  const workItemRepository = AppDataSource.getRepository(WorkItem);
  const workItem = await workItemRepository.findOne({
    where: { id: workItemId, organizationId, projectId: project?.id },
  });
  if (!workItem) {
    throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
  }

  Object.assign(workItem, {
    ...req.body,
    dueDate: req.body.dueDate == null ? req.body.dueDate : new Date(req.body.dueDate),
  });
  const saved = await workItemRepository.save(workItem);
  res.json({ success: true, data: saved });
};

export const deleteWorkItem = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const workItemId = req.params.workItemId;
  if (!userId || typeof workItemId !== "string") {
    throw new AppError("Invalid work item request.", 400, "INVALID_WORK_ITEM_ID");
  }

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: { id: true, organizationId: true },
  });
  if (!user || !user.organizationId) {
    throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
  }
  const organizationId = user.organizationId;
  const project = await AppDataSource.getRepository(Project)
    .createQueryBuilder("project")
    .leftJoin("project.memberships", "membership", "membership.userId = :userId", { userId })
    .where("project.id = (SELECT work_item.project_id FROM work_items work_item WHERE work_item.id = :workItemId)", { workItemId })
    .andWhere("project.organizationId = :organizationId", { organizationId })
    .andWhere("(project.visibility = :publicVisibility OR membership.userId = :userId)", {
      publicVisibility: ProjectVisibility.PUBLIC,
      userId,
    })
    .getOne();
  const workItemRepository = AppDataSource.getRepository(WorkItem);
  const workItem = await workItemRepository.findOne({
    where: { id: workItemId, organizationId, projectId: project?.id },
  });
  if (!workItem) {
    throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
  }

  await workItemRepository.remove(workItem);
  res.json({ success: true, data: { id: workItemId } });
};
