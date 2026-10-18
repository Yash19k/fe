
import { Request, Response } from "express";
import { In } from "typeorm";

import { AppDataSource } from "../config/data.source";
import { User, UserStatus } from "../entities/user.entity";
import {
  Project,
  ProjectVisibility,
} from "../entities/project.entity";
import { ProjectMember } from "../entities/project.member.entity";
import {
  WorkItem,
  WorkItemType,
  WorkItemStatus,
  WorkItemPriority,
} from "../entities/work.item.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import {
  WorkItemRecurrence,
  RecurrenceFrequency,
  MonthlyPattern,
} from "../entities/work.item.recurrence.entity";
import { AppError } from "../errors/app.error";
import {
  getPagination,
  getPaginationMeta,
} from "../utils/pagination";

interface AssigneeInput {
  userId: string;
  startDate?: string | null;
  estimatedHours?: number | null;
}

interface RecurrenceInput {
  frequency: RecurrenceFrequency;
  interval?: number;
  daysOfWeek?: number[] | null;
  monthlyPattern?: MonthlyPattern | null;
  dayOfMonth?: number | null;
  startsOn: string;
  endsOn?: string | null;
  timezone?: string;
}

interface CreateWorkItemBody {
  projectId: string;
  parentWorkItemId?: string | null;
  type: WorkItemType;
  title: string;
  description?: string | null;
  priority?: WorkItemPriority;
  status?: WorkItemStatus;
  dueDate?: string | Date | null;
  assignees?: AssigneeInput[];
  recurrence?: RecurrenceInput | null;
}

interface ViewWorkItemsQuery {
  page: number;
  limit: number;
  status?: WorkItemStatus;
  type?: WorkItemType;
}

interface UpdateWorkItemBody {
  title?: string;
  description?: string | null;
  priority?: WorkItemPriority;
  status?: WorkItemStatus;
  dueDate?: string | Date | null;
  parentWorkItemId?: string | null;
}

interface Actor {
  id: string;
  organizationId: string;
  status: UserStatus;
  role: string;
}

const isAdmin = (actor: Actor): boolean => actor.role === "ADMIN";

function requireUserId(req: Request): string {
  const userId = req.user?.id;

  if (typeof userId !== "string" || !userId) {
    throw new AppError(
      "Authentication required",
      401,
      "UNAUTHORIZED",
    );
  }

  return userId;
}

function requireWorkItemId(req: Request): string {
  const workItemId = req.params.workItemId;

  if (typeof workItemId !== "string" || !workItemId) {
    throw new AppError(
      "Invalid work item ID",
      400,
      "INVALID_WORK_ITEM_ID",
    );
  }

  return workItemId;
}

async function getActiveActor(userId: string): Promise<Actor> {
  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      role: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      "Your account is not active",
      403,
      "ACCOUNT_INACTIVE",
    );
  }

  if (!user.organizationId) {
    throw new AppError(
      "Your account is not associated with an organization",
      403,
      "ORGANIZATION_NOT_FOUND",
    );
  }

  return user as Actor;
}

function isValidDateOnly(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validateRecurrence(input: RecurrenceInput): void {
  if (!Object.values(RecurrenceFrequency).includes(input.frequency)) {
    throw new AppError(
      "Invalid recurrence frequency",
      400,
      "INVALID_RECURRENCE_FREQUENCY",
    );
  }

  const interval = input.interval ?? 1;

  if (!Number.isInteger(interval) || interval < 1) {
    throw new AppError(
      "Recurrence interval must be a positive integer",
      400,
      "INVALID_RECURRENCE_INTERVAL",
    );
  }

  if (!isValidDateOnly(input.startsOn)) {
    throw new AppError(
      "startsOn must be a valid YYYY-MM-DD date",
      400,
      "INVALID_RECURRENCE_START_DATE",
    );
  }

  if (
    input.endsOn != null &&
    (!isValidDateOnly(input.endsOn) || input.endsOn < input.startsOn)
  ) {
    throw new AppError(
      "endsOn must be a valid date on or after startsOn",
      400,
      "INVALID_RECURRENCE_END_DATE",
    );
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: input.timezone ?? "UTC",
    });
  } catch {
    throw new AppError(
      "Invalid IANA timezone",
      400,
      "INVALID_RECURRENCE_TIMEZONE",
    );
  }

  if (input.frequency === RecurrenceFrequency.WEEKLY) {
    const days = input.daysOfWeek;

    if (
      !Array.isArray(days) ||
      days.length === 0 ||
      days.some(
        (day) =>
          !Number.isInteger(day) || day < 0 || day > 6,
      ) ||
      new Set(days).size !== days.length
    ) {
      throw new AppError(
        "Weekly recurrence requires unique daysOfWeek values from 0 to 6",
        400,
        "INVALID_RECURRENCE_DAYS",
      );
    }

    if (
      input.monthlyPattern != null ||
      input.dayOfMonth != null
    ) {
      throw new AppError(
        "Monthly recurrence fields cannot be used for weekly recurrence",
        400,
        "INVALID_RECURRENCE_FIELDS",
      );
    }

    return;
  }

  if (input.frequency === RecurrenceFrequency.DAILY) {
    if (
      (input.daysOfWeek != null && input.daysOfWeek.length > 0) ||
      input.monthlyPattern != null ||
      input.dayOfMonth != null
    ) {
      throw new AppError(
        "Daily recurrence cannot contain weekly or monthly fields",
        400,
        "INVALID_RECURRENCE_FIELDS",
      );
    }

    return;
  }

  if (input.frequency === RecurrenceFrequency.MONTHLY) {
    if (
      !input.monthlyPattern ||
      !Object.values(MonthlyPattern).includes(input.monthlyPattern)
    ) {
      throw new AppError(
        "Monthly recurrence requires a valid monthlyPattern",
        400,
        "INVALID_MONTHLY_PATTERN",
      );
    }

    if (
      input.daysOfWeek != null &&
      input.daysOfWeek.length > 0
    ) {
      throw new AppError(
        "daysOfWeek cannot be used for monthly recurrence",
        400,
        "INVALID_RECURRENCE_FIELDS",
      );
    }

    if (input.monthlyPattern === MonthlyPattern.DAY_OF_MONTH) {
      if (
        !Number.isInteger(input.dayOfMonth) ||
        (input.dayOfMonth as number) < 1 ||
        (input.dayOfMonth as number) > 31
      ) {
        throw new AppError(
          "DAY_OF_MONTH requires dayOfMonth between 1 and 31",
          400,
          "INVALID_DAY_OF_MONTH",
        );
      }
    } else if (input.dayOfMonth != null) {
      throw new AppError(
        "dayOfMonth is only valid with DAY_OF_MONTH",
        400,
        "UNEXPECTED_DAY_OF_MONTH",
      );
    }
  }
}

async function assertAccessibleProject(
  projectId: string,
  actor: Actor,
  manager = AppDataSource.manager,
): Promise<Project> {
  const project = await manager
    .getRepository(Project)
    .createQueryBuilder("project")
    .leftJoin(
      "project.memberships",
      "membership",
      "membership.userId = :userId",
      { userId: actor.id },
    )
    .where("project.id = :projectId", { projectId })
    .andWhere(
      "project.organizationId = :organizationId",
      { organizationId: actor.organizationId },
    )
    .andWhere(
      `(
        project.visibility = :publicVisibility
        OR membership.userId = :userId
        OR :isAdmin = true
      )`,
      {
        publicVisibility: ProjectVisibility.PUBLIC,
        userId: actor.id,
        isAdmin: isAdmin(actor),
      },
    )
    .getOne();

  if (!project) {
    throw new AppError(
      "Project not found or you do not have access to it",
      404,
      "PROJECT_NOT_FOUND",
    );
  }

  return project;
}

async function getAccessibleWorkItem(
  workItemId: string,
  actor: Actor,
) {
  const workItem = await AppDataSource
    .getRepository(WorkItem)
    .createQueryBuilder("workItem")
    .innerJoin("workItem.project", "project")
    .leftJoin(
      "project.memberships",
      "membership",
      "membership.userId = :userId",
      { userId: actor.id },
    )
    .where("workItem.id = :workItemId", { workItemId })
    .andWhere(
      "workItem.organizationId = :organizationId",
      { organizationId: actor.organizationId },
    )
    .andWhere(
      "project.organizationId = :organizationId",
      { organizationId: actor.organizationId },
    )
    .andWhere(
      `(
        project.visibility = :publicVisibility
        OR membership.userId = :userId
        OR :isAdmin = true
      )`,
      {
        publicVisibility: ProjectVisibility.PUBLIC,
        userId: actor.id,
        isAdmin: isAdmin(actor),
      },
    )
    .getOne();

  if (!workItem) {
    throw new AppError(
      "Work item not found or you do not have access to it",
      404,
      "WORK_ITEM_NOT_FOUND",
    );
  }

  return workItem;
}

async function validateParentWorkItem(
  parentWorkItemId: string | null,
  projectId: string,
  organizationId: string,
  currentWorkItemId?: string,
): Promise<void> {
  if (!parentWorkItemId) {
    return;
  }

  if (currentWorkItemId && parentWorkItemId === currentWorkItemId) {
    throw new AppError(
      "A work item cannot be its own parent",
      400,
      "INVALID_PARENT_WORK_ITEM",
    );
  }

  const repository = AppDataSource.getRepository(WorkItem);

  const parent = await repository.findOne({
    where: {
      id: parentWorkItemId,
      projectId,
      organizationId,
    },
    select: {
      id: true,
      parentWorkItemId: true,
    },
  });

  if (!parent) {
    throw new AppError(
      "Parent work item not found in this project",
      404,
      "PARENT_WORK_ITEM_NOT_FOUND",
    );
  }

  // If updating, walk up the proposed parent's ancestors.
  // The current item must never appear in that chain.
  if (currentWorkItemId) {
    const visited = new Set<string>();
    let ancestorId: string | null = parent.id;

    while (ancestorId) {
      if (ancestorId === currentWorkItemId) {
        throw new AppError(
          "This parent would create a circular work-item hierarchy",
          400,
          "WORK_ITEM_HIERARCHY_CYCLE",
        );
      }

      if (visited.has(ancestorId)) {
        throw new AppError(
          "An existing circular work-item hierarchy was detected",
          409,
          "EXISTING_WORK_ITEM_HIERARCHY_CYCLE",
        );
      }

      visited.add(ancestorId);

      const ancestor = await repository.findOne({
        where: {
          id: ancestorId,
          projectId,
          organizationId,
        },
        select: {
          id: true,
          parentWorkItemId: true,
        },
      });

      if (!ancestor) {
        break;
      }

      ancestorId = ancestor.parentWorkItemId;
    }
  }
}

async function validateAssignees(
  assignees: AssigneeInput[],
  projectId: string,
  organizationId: string,
  manager = AppDataSource.manager,
): Promise<void> {
  if (!Array.isArray(assignees)) {
    throw new AppError(
      "assignees must be an array",
      400,
      "INVALID_ASSIGNEES",
    );
  }

  const assigneeIds = assignees.map((assignee) => assignee.userId);
  const uniqueIds = [...new Set(assigneeIds)];

  if (uniqueIds.length !== assigneeIds.length) {
    throw new AppError(
      "An assignee can only be included once",
      400,
      "DUPLICATE_ASSIGNEE",
    );
  }

  if (uniqueIds.length === 0) {
    return;
  }

  const eligibleUsers = await manager.getRepository(User).find({
    where: {
      id: In(uniqueIds),
      organizationId,
      status: UserStatus.ACTIVE,
    },
    select: { id: true },
  });

  if (eligibleUsers.length !== uniqueIds.length) {
    throw new AppError(
      "All assignees must be active users in your organization",
      400,
      "INVALID_ASSIGNEE",
    );
  }

  const memberships = await manager.getRepository(ProjectMember).find({
    where: {
      projectId,
      userId: In(uniqueIds),
    },
    select: {
      userId: true,
    },
  });

  const memberIds = new Set(memberships.map((member) => member.userId));

  if (uniqueIds.some((id) => !memberIds.has(id))) {
    throw new AppError(
      "All assignees must be members of the selected project",
      400,
      "ASSIGNEE_NOT_PROJECT_MEMBER",
    );
  }
}

// CREATE WORK ITEM
export const createWorkItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const body = req.body as CreateWorkItemBody;

  const {
    projectId,
    parentWorkItemId,
    type,
    title,
    description,
    priority = WorkItemPriority.MEDIUM,
    status = WorkItemStatus.BACKLOG,
    dueDate,
    assignees = [],
    recurrence,
  } = body;

  if (recurrence) {
    validateRecurrence(recurrence);
  }

  const result = await AppDataSource.transaction(async (manager) => {
    const project = await assertAccessibleProject(
      projectId,
      actor,
      manager,
    );

    if (parentWorkItemId) {
      const parent = await manager.getRepository(WorkItem).findOne({
        where: {
          id: parentWorkItemId,
          projectId: project.id,
          organizationId: actor.organizationId,
        },
        select: { id: true },
      });

      if (!parent) {
        throw new AppError(
          "Parent work item not found in this project",
          404,
          "PARENT_WORK_ITEM_NOT_FOUND",
        );
      }
    }

    await validateAssignees(
      assignees,
      project.id,
      actor.organizationId,
      manager,
    );

    const workItemRepository = manager.getRepository(WorkItem);

    const workItem = workItemRepository.create({
      organizationId: actor.organizationId,
      projectId: project.id,
      createdById: actor.id,
      parentWorkItemId: parentWorkItemId ?? null,
      type,
      title: title.trim(),
      description: description?.trim() || null,
      priority,
      status,
      dueDate: dueDate == null ? null : new Date(dueDate),
    });

    const savedWorkItem = await workItemRepository.save(workItem);

    if (assignees.length > 0) {
      const assignments = assignees.map((assignee) =>
        manager.getRepository(WorkItemAssignee).create({
          workItemId: savedWorkItem.id,
          userId: assignee.userId,
          assignedById: actor.id,
          startDate: assignee.startDate ?? null,
          estimatedHours:
            assignee.estimatedHours == null
              ? null
              : String(assignee.estimatedHours),
        }),
      );

      await manager.getRepository(WorkItemAssignee).save(assignments);
    }

    let savedRecurrence: WorkItemRecurrence | null = null;

    if (recurrence) {
      const timezone = recurrence.timezone ?? "UTC";

      savedRecurrence = await manager
        .getRepository(WorkItemRecurrence)
        .save(
          manager.getRepository(WorkItemRecurrence).create({
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
            startsOn: recurrence.startsOn,
            endsOn: recurrence.endsOn ?? null,

            // This is a UTC marker, not a timezone-aware local-midnight
            // calculation. The recurrence worker must interpret startsOn
            // using the stored timezone when calculating actual runs.
            nextRunAt: new Date(`${recurrence.startsOn}T00:00:00.000Z`),
            timezone,
            isActive: true,
          }),
        );
    }

    return {
      workItem: savedWorkItem,
      assigneeIds: assignees.map((assignee) => assignee.userId),
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

// LIST PROJECT WORK ITEMS
export const getProjectWorkItems = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const projectId = req.params.projectId;

  if (typeof projectId !== "string") {
    throw new AppError(
      "Invalid project ID",
      400,
      "INVALID_PROJECT_ID",
    );
  }

  const { page, limit, status, type } =
    res.locals.validatedWorkItemQuery as ViewWorkItemsQuery;

  const project = await assertAccessibleProject(projectId, actor);
  const { skip, take } = getPagination({ page, limit });

  const query = AppDataSource.getRepository(WorkItem)
    .createQueryBuilder("workItem")
    .where("workItem.projectId = :projectId", {
      projectId: project.id,
    })
    .andWhere(
      "workItem.organizationId = :organizationId",
      { organizationId: actor.organizationId },
    )
    .orderBy("workItem.createdAt", "DESC")
    .addOrderBy("workItem.id", "DESC")
    .skip(skip)
    .take(take);

  if (status) {
    query.andWhere("workItem.status = :status", { status });
  }

  if (type) {
    query.andWhere("workItem.type = :type", { type });
  }

  const [workItems, total] = await query.getManyAndCount();

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
};

// UPDATE WORK ITEM
export const updateWorkItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const workItemId = requireWorkItemId(req);
  const body = req.body as UpdateWorkItemBody;

  const workItem = await getAccessibleWorkItem(workItemId, actor);

  if (body.parentWorkItemId !== undefined) {
    await validateParentWorkItem(
      body.parentWorkItemId,
      workItem.projectId,
      actor.organizationId,
      workItem.id,
    );
  }

  // Explicit allow-list: do not mass-assign req.body onto the entity.
  if (body.title !== undefined) {
    workItem.title = body.title.trim();
  }

  if (body.description !== undefined) {
    workItem.description = body.description?.trim() || null;
  }

  if (body.priority !== undefined) {
    workItem.priority = body.priority;
  }

  if (body.status !== undefined) {
    workItem.status = body.status;
  }

  if (body.dueDate !== undefined) {
    workItem.dueDate =
      body.dueDate === null ? null : new Date(body.dueDate);
  }

  if (body.parentWorkItemId !== undefined) {
    workItem.parentWorkItemId = body.parentWorkItemId;
  }

  const savedWorkItem = await AppDataSource
    .getRepository(WorkItem)
    .save(workItem);

  res.status(200).json({
    success: true,
    message: "Work item updated successfully",
    data: savedWorkItem,
  });
};

// DELETE WORK ITEM
export const deleteWorkItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const workItemId = requireWorkItemId(req);

  const workItem = await getAccessibleWorkItem(workItemId, actor);

  await AppDataSource.getRepository(WorkItem).remove(workItem);

  res.status(200).json({
    success: true,
    message: "Work item deleted successfully",
    data: { id: workItemId },
  });
};
