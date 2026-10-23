
import { Request, Response } from "express";
import { In } from "typeorm";

import { AppDataSource } from "../config/data.source";
import { User, UserStatus } from "../entities/user.entity";
import {
  Project,
  ProjectVisibility,
} from "../entities/project.entity";
import { ProjectMember, ProjectRole } from "../entities/project.member.entity";
import {
  WorkItem,
  WorkItemType,
  WorkItemStatus,
  WorkItemPriority,
  SlaStatus,
} from "../entities/work.item.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import { AuditLog } from "../entities/audit.log.entity";
import { Sprint } from "../entities/sprint.entities";
import {
  WorkItemRecurrence,
  RecurrenceFrequency,
  MonthlyPattern,
} from "../entities/work.item.recurrence.entity";
import {
  DEFAULT_RECURRENCE_TIMEZONE,
  RECURRENCE_TIME_OF_DAY,
  getInitialOccurrenceRunAt,
  validateRecurrence,
  type RecurrenceInput,
} from "../services/recurrence.service";
import { AppError } from "../errors/app.error";
import {
  NotificationType,
} from "../entities/notification.entity";
import { notificationService } from "../services/notification.service";
import {
  applySlaState,
  calculateSlaDeadline,
  ensureSlaData,
  getSlaSnapshot,
  writeSlaAudit,
} from "../services/sla.service";
import { authorizeProjectPermission } from "../middleware/project.permission";
import {
  getPagination,
  getPaginationMeta,
} from "../utils/pagination";

interface AssigneeInput {
  userId: string;
  startDate?: string | null;
  estimatedHours?: number | null;
}

interface CreateWorkItemBody {
  projectId: string;
  sprintId?: string | null;
  parentWorkItemId?: string | null;
  type: WorkItemType;
  title: string;
  description?: string | null;
  priority?: WorkItemPriority | null;
  status?: WorkItemStatus;
  dueDate?: string | Date | null;
  slaDeadline?: string | Date | null;
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
  sprintId?: string | null;
  title?: string;
  description?: string | null;
  type?: WorkItemType;
  priority?: WorkItemPriority | null;
  status?: WorkItemStatus;
  dueDate?: string | Date | null;
  slaDeadline?: string | Date | null;
  parentWorkItemId?: string | null;
  assignees?: AssigneeInput[] | null;
  assigneeId?: string | null;
  assigneeIds?: string[] | null;
}

interface Actor {
  id: string;
  organizationId: string;
  status: UserStatus;
  role: string;
}

const isAdmin = (actor: Actor): boolean => actor.role === "ADMIN";

function clearSlaState(workItem: WorkItem): void {
  workItem.slaDeadline = null;
  workItem.slaStatus = null;
  workItem.slaDeadlineIsCustom = false;
  workItem.escalatedAt = null;
  workItem.escalatedById = null;
  workItem.escalationReason = null;
  workItem.slaBreachedAt = null;
  workItem.slaResolvedAt = null;
}

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
  const missingMemberIds = uniqueIds.filter((id) => !memberIds.has(id));

  if (missingMemberIds.length > 0) {
    const newMembers = missingMemberIds.map((userId) =>
      manager.getRepository(ProjectMember).create({
        projectId,
        userId,
        role: ProjectRole.MEMBER,
      }),
    );
    await manager.getRepository(ProjectMember).save(newMembers);
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
    sprintId,
    parentWorkItemId,
    type,
    title,
    description,
    priority,
    status = WorkItemStatus.BACKLOG,
    dueDate,
    assignees = [],
    recurrence,
    slaDeadline,
  } = body;

  if (slaDeadline !== undefined) {
    await authorizeProjectPermission(req, "sla:manage");
  }

  if (recurrence) {
    validateRecurrence(recurrence, type);
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

    if (sprintId) {
      const sprint = await manager.getRepository(Sprint).findOne({
        where: {
          id: sprintId,
          projectId: project.id,
        },
        select: { id: true },
      });

      if (!sprint) {
        throw new AppError(
          "Sprint not found in this project.",
          400,
          "INVALID_SPRINT",
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
      sprintId: sprintId ?? null,
      parentWorkItemId: parentWorkItemId ?? null,
      type,
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority ?? null,
      status,
      dueDate: dueDate == null ? null : new Date(dueDate),
    });

    const savedWorkItem = await workItemRepository.save(workItem);

    if (slaDeadline && !savedWorkItem.priority) {
      throw new AppError(
        "A priority is required to configure an SLA deadline",
        400,
        "WORK_ITEM_PRIORITY_REQUIRED",
      );
    }

    if (savedWorkItem.priority) {
      savedWorkItem.slaDeadline = slaDeadline
        ? new Date(slaDeadline)
        : calculateSlaDeadline(
            savedWorkItem.createdAt,
            savedWorkItem.priority,
          );
      savedWorkItem.slaDeadlineIsCustom = Boolean(slaDeadline);
      applySlaState(savedWorkItem);
      await workItemRepository.save(savedWorkItem);
      await writeSlaAudit(
        manager,
        savedWorkItem,
        actor.id,
        "sla_initialized",
        "Initialized SLA for work item",
        null,
        {
          deadline: savedWorkItem.slaDeadline,
          status: savedWorkItem.slaStatus,
          custom: savedWorkItem.slaDeadlineIsCustom,
        },
      );
    } else {
      clearSlaState(savedWorkItem);
      await workItemRepository.save(savedWorkItem);
    }

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
      const recurrenceRepository = manager.getRepository(WorkItemRecurrence);
      const timezone = DEFAULT_RECURRENCE_TIMEZONE;
      const recurrenceRule = recurrenceRepository.create({
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
        nextRunAt: null,
        timezone,
        timeOfDay: RECURRENCE_TIME_OF_DAY,
        weekdaysOnly:
          recurrence.frequency === RecurrenceFrequency.DAILY &&
          Boolean(recurrence.weekdaysOnly),
        isActive: true,
      });

      // If today's 09:00 has passed, begin with the next eligible date instead
      // of generating a stale occurrence tomorrow for today's date.
      recurrenceRule.nextRunAt = getInitialOccurrenceRunAt(recurrenceRule);
      recurrenceRule.isActive = recurrenceRule.nextRunAt !== null;
      savedRecurrence = await recurrenceRepository.save(recurrenceRule);
    }

    const assignments = await manager
      .getRepository(WorkItemAssignee)
      .find({
        where: { workItemId: savedWorkItem.id },
        relations: { user: true },
      });

    return {
      workItem: savedWorkItem,
      assignments,
      assigneeIds: assignments.map((assignee) => assignee.userId),
      assigneeId: assignments[0]?.userId || null,
      assignees: assignments.map((a) => a.user).filter(Boolean),
      recurrence: savedRecurrence,
    };
  });

  // Notify newly assigned users after the work item transaction commits.
  await Promise.all(
    result.assigneeIds
      .filter((assigneeId) => assigneeId !== actor.id)
      .map((assigneeId) =>
        notificationService.createNotification({
          userId: assigneeId,
          organizationId: actor.organizationId,
          type: NotificationType.TASK_ASSIGNED,
          title: "Task assigned to you",
          message: `You have been assigned "${result.workItem.title}".`,
          workItemId: result.workItem.id,
          projectId: result.workItem.projectId,
          link: `/tasks/${result.workItem.id}`,
        }),
      ),
  );

  res.status(201).json({
    success: true,
    message: "Work item created successfully",
    data: {
      ...result.workItem,
      assignments: result.assignments,
      assigneeIds: result.assigneeIds,
      assigneeId: result.assigneeId,
      assignees: result.assignees,
      recurrence: result.recurrence,
      sla: getSlaSnapshot(result.workItem),
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
    .leftJoinAndSelect("workItem.assignments", "assignments")
    .leftJoinAndSelect("assignments.user", "assigneeUser")
    .leftJoinAndSelect("workItem.comments", "comments")
    .leftJoinAndSelect("workItem.timeEntries", "timeEntries")
    .leftJoinAndSelect("workItem.children", "children")
    .leftJoinAndSelect("workItem.attachments", "attachments")
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
  for (const workItem of workItems) {
    if (!workItem.priority) {
      clearSlaState(workItem);
      continue;
    }

    if (!workItem.slaDeadline) {
      workItem.slaDeadline = calculateSlaDeadline(
        workItem.createdAt,
        workItem.priority,
      );
      workItem.slaDeadlineIsCustom = false;
    }
    applySlaState(workItem);
  }

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
  const previousStatus = workItem.status;
  const previousAssigneeIds = (
    await AppDataSource.getRepository(WorkItemAssignee).find({
      where: { workItemId: workItem.id },
      select: { userId: true },
    })
  ).map((assignment) => assignment.userId);

  if (body.slaDeadline !== undefined) {
    await authorizeProjectPermission(req, "sla:manage");
  }

  if (body.parentWorkItemId !== undefined) {
    await validateParentWorkItem(
      body.parentWorkItemId,
      workItem.projectId,
      actor.organizationId,
      workItem.id,
    );
  }

  let newAssignees: AssigneeInput[] | undefined = undefined;
  if (body.assignees !== undefined) {
    newAssignees = body.assignees || [];
  } else if (body.assigneeIds !== undefined) {
    newAssignees = (body.assigneeIds || []).map((uid) => ({ userId: uid }));
  } else if (body.assigneeId !== undefined) {
    newAssignees = body.assigneeId ? [{ userId: body.assigneeId }] : [];
  }

  const result = await AppDataSource.transaction(async (manager) => {
    const previousSlaDeadline = workItem.slaDeadline;
    const previousSlaStatus = workItem.slaStatus;
    if (body.sprintId !== undefined && body.sprintId !== null) {
      const sprint = await manager.getRepository(Sprint).findOne({
        where: {
          id: body.sprintId,
          projectId: workItem.projectId,
        },
        select: { id: true },
      });

      if (!sprint) {
        throw new AppError(
          "Sprint not found in this project.",
          400,
          "INVALID_SPRINT",
        );
      }
    }

    if (newAssignees !== undefined) {
      await validateAssignees(
        newAssignees,
        workItem.projectId,
        actor.organizationId,
        manager,
      );

      await manager.getRepository(WorkItemAssignee).delete({
        workItemId: workItem.id,
      });

      if (newAssignees.length > 0) {
        const assigneeEntities = newAssignees.map((assignee) =>
          manager.getRepository(WorkItemAssignee).create({
            workItemId: workItem.id,
            userId: assignee.userId,
            assignedById: actor.id,
            startDate: assignee.startDate ?? null,
            estimatedHours:
              assignee.estimatedHours !== undefined &&
              assignee.estimatedHours !== null
                ? assignee.estimatedHours.toString()
                : null,
          }),
        );
        await manager.getRepository(WorkItemAssignee).save(assigneeEntities);
      }
    }

    // Explicit allow-list: do not mass-assign req.body onto the entity.
    if (body.title !== undefined) {
      workItem.title = body.title.trim();
    }

    if (body.type !== undefined) {
      workItem.type = body.type;
    }

    if (body.description !== undefined) {
      workItem.description = body.description?.trim() || null;
    }

    if (body.priority !== undefined) {
      const previousPriority = workItem.priority;
      workItem.priority = body.priority ?? null;

      if (!workItem.priority) {
        clearSlaState(workItem);
      } else if (
        previousPriority !== workItem.priority &&
        !workItem.slaDeadlineIsCustom
      ) {
        workItem.slaDeadline = calculateSlaDeadline(
          workItem.createdAt,
          workItem.priority,
        );
      }
    }

    if (body.status !== undefined) {
      workItem.status = body.status;
    }

    if (body.dueDate !== undefined) {
      workItem.dueDate =
        body.dueDate === null ? null : new Date(body.dueDate);
    }

    if (body.slaDeadline !== undefined) {
      if (body.slaDeadline && !workItem.priority) {
        throw new AppError(
          "A priority is required to configure an SLA deadline",
          400,
          "WORK_ITEM_PRIORITY_REQUIRED",
        );
      }

      workItem.slaDeadline = body.slaDeadline
        ? new Date(body.slaDeadline)
        : workItem.priority
          ? calculateSlaDeadline(workItem.createdAt, workItem.priority)
          : null;
      workItem.slaDeadlineIsCustom = Boolean(body.slaDeadline);
    }

    if (body.parentWorkItemId !== undefined) {
      workItem.parentWorkItemId = body.parentWorkItemId;
    }

    if (body.sprintId !== undefined) {
      workItem.sprintId = body.sprintId;
    }

    const savedWorkItem = await manager
      .getRepository(WorkItem)
      .save(workItem);

    if (!savedWorkItem.priority) {
      clearSlaState(savedWorkItem);
    } else {
      if (!savedWorkItem.slaDeadline) {
        savedWorkItem.slaDeadline = calculateSlaDeadline(
          savedWorkItem.createdAt,
          savedWorkItem.priority,
        );
        savedWorkItem.slaDeadlineIsCustom = false;
      }
      applySlaState(savedWorkItem);
    }

    await manager.getRepository(WorkItem).save(savedWorkItem);
    if (
      previousSlaDeadline?.getTime() !== savedWorkItem.slaDeadline?.getTime()
    ) {
      await writeSlaAudit(
        manager,
        savedWorkItem,
        actor.id,
        "sla_deadline_changed",
        "Changed SLA deadline",
        { deadline: previousSlaDeadline },
        { deadline: savedWorkItem.slaDeadline },
      );
    }
    if (previousSlaStatus !== savedWorkItem.slaStatus) {
      await writeSlaAudit(
        manager,
        savedWorkItem,
        actor.id,
        "sla_status_changed",
        "Changed SLA status",
        { status: previousSlaStatus },
        { status: savedWorkItem.slaStatus },
      );
    }

    const assignments = await manager
      .getRepository(WorkItemAssignee)
      .find({
        where: { workItemId: savedWorkItem.id },
        relations: { user: true },
      });

    return {
      ...savedWorkItem,
      assignments,
      assigneeIds: assignments.map((a) => a.userId),
      assigneeId: assignments[0]?.userId || null,
      assignees: assignments.map((a) => a.user).filter(Boolean),
      sla: getSlaSnapshot(savedWorkItem),
    };
  });

  const currentAssigneeIds = result.assigneeIds as string[];
  const previousAssigneeSet = new Set(previousAssigneeIds);
  const currentAssigneeSet = new Set(currentAssigneeIds);
  const newlyAssignedIds = currentAssigneeIds.filter(
    (assigneeId) => !previousAssigneeSet.has(assigneeId),
  );
  const statusChanged = previousStatus !== result.status;
  const completedNow =
    statusChanged && result.status === WorkItemStatus.DONE;
  const reopenedNow =
    statusChanged &&
    previousStatus === WorkItemStatus.DONE &&
    result.status !== WorkItemStatus.DONE;

  // Notify newly added assignees, including additional assignees.
  const assignmentNotifications = newlyAssignedIds
    .filter((assigneeId) => assigneeId !== actor.id)
    .map((assigneeId) =>
      notificationService.createNotification({
        userId: assigneeId,
        organizationId: actor.organizationId,
        type: NotificationType.TASK_ASSIGNED,
        title: "Task assigned to you",
        message: `You have been assigned "${result.title}".`,
        workItemId: result.id,
        projectId: result.projectId,
        link: `/tasks/${result.id}`,
      }),
    );

  // Completion/reopening notifications go to the current assignees and creator.
  const statusRecipients = new Set<string>([
    ...currentAssigneeIds,
    result.createdById,
  ]);
  statusRecipients.delete(actor.id);

  const statusNotifications =
    completedNow || reopenedNow
      ? [...statusRecipients].map((userId) =>
          notificationService.createNotification({
            userId,
            organizationId: actor.organizationId,
            type: completedNow
              ? NotificationType.TASK_COMPLETED
              : NotificationType.TASK_UPDATED,
            title: completedNow ? "Task completed" : "Task reopened",
            message: completedNow
              ? `"${result.title}" has been marked as completed.`
              : `"${result.title}" has been reopened.`,
            workItemId: result.id,
            projectId: result.projectId,
            link: `/tasks/${result.id}`,
          }),
        )
      : [];

  // Notify existing assignees when task details change, without duplicating
  // assignment or completion/reopening notifications for this update.
  const taskDetailsChanged =
    body.title !== undefined ||
    body.description !== undefined ||
    body.priority !== undefined ||
    body.dueDate !== undefined ||
    body.sprintId !== undefined ||
    body.parentWorkItemId !== undefined ||
    body.type !== undefined ||
    body.slaDeadline !== undefined;

  const updateNotifications =
    taskDetailsChanged && !completedNow && !reopenedNow
      ? currentAssigneeIds
          .filter(
            (assigneeId) =>
              assigneeId !== actor.id &&
              previousAssigneeSet.has(assigneeId) &&
              currentAssigneeSet.has(assigneeId),
          )
          .map((userId) =>
            notificationService.createNotification({
              userId,
              organizationId: actor.organizationId,
              type: NotificationType.TASK_UPDATED,
              title: "Assigned task updated",
              message: `"${result.title}" has been updated.`,
              workItemId: result.id,
              projectId: result.projectId,
              link: `/tasks/${result.id}`,
            }),
          )
      : [];

  await Promise.all([
    ...assignmentNotifications,
    ...statusNotifications,
    ...updateNotifications,
  ]);

  res.status(200).json({
    success: true,
    message: "Work item updated successfully",
    data: result,
  });
};

export const escalateWorkItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const workItemId = requireWorkItemId(req);
  const reason =
    req.body?.reason === undefined || req.body.reason === null
      ? null
      : String(req.body.reason).trim();

  if (reason && reason.length > 500) {
    throw new AppError("Escalation reason must be 500 characters or fewer", 400, "INVALID_ESCALATION_REASON");
  }

  const result = await AppDataSource.transaction(async (manager) => {
    const workItem = await manager
      .getRepository(WorkItem)
      .createQueryBuilder("workItem")
      .where("workItem.id = :workItemId", { workItemId })
      .andWhere("workItem.organizationId = :organizationId", {
        organizationId: actor.organizationId,
      })
      .setLock("pessimistic_write")
      .getOne();
    if (!workItem) {
      throw new AppError("Work item not found", 404, "WORK_ITEM_NOT_FOUND");
    }

    await assertAccessibleProject(workItem.projectId, actor, manager);

    if (!workItem.priority) {
      throw new AppError(
        "Cannot escalate a work item without a priority",
        400,
        "WORK_ITEM_PRIORITY_REQUIRED",
      );
    }

    if (workItem.escalatedAt) {
      applySlaState(workItem);
      return { workItem, alreadyEscalated: true };
    }

    const previous = {
      status: workItem.slaStatus,
      escalatedAt: workItem.escalatedAt,
      reason: workItem.escalationReason,
    };
    await ensureSlaData(workItem, manager);
    workItem.escalatedAt = new Date();
    workItem.escalatedById = actor.id;
    workItem.escalationReason = reason;
    workItem.slaStatus = SlaStatus.ESCALATED;
    const saved = await manager.getRepository(WorkItem).save(workItem);
    await writeSlaAudit(
      manager,
      saved,
      actor.id,
      "escalated",
      "Escalated work item",
      previous,
      { status: saved.slaStatus, escalatedAt: saved.escalatedAt, reason },
    );
    return { workItem: saved, alreadyEscalated: false };
  });

  if (!result.alreadyEscalated) {
    const assignments = await AppDataSource.getRepository(WorkItemAssignee).find({
      where: { workItemId: result.workItem.id },
      select: { userId: true },
    });
    const recipients = new Set<string>([
      ...assignments.map((assignment) => assignment.userId),
      result.workItem.createdById,
    ]);
    recipients.delete(actor.id);

    await Promise.all(
      [...recipients].map((userId) =>
        notificationService.createNotification({
          userId,
          organizationId: actor.organizationId,
          type: NotificationType.SLA_ESCALATED,
          title: "SLA escalation",
          message: `"${result.workItem.title}" has been escalated because of its SLA status.`,
          workItemId: result.workItem.id,
          projectId: result.workItem.projectId,
          link: `/tasks/${result.workItem.id}`,
          metadata: {
            reason: result.workItem.escalationReason,
            escalatedAt: result.workItem.escalatedAt?.toISOString() ?? null,
          },
        }),
      ),
    );
  }

  res.status(200).json({
    success: true,
    message: result.alreadyEscalated ? "Work item is already escalated" : "Work item escalated successfully",
    data: { ...result.workItem, sla: getSlaSnapshot(result.workItem), alreadyEscalated: result.alreadyEscalated },
  });
};

export const getWorkItemSla = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const workItem = await getAccessibleWorkItem(requireWorkItemId(req), actor);

  if (!workItem.priority) {
    clearSlaState(workItem);
  } else {
    applySlaState(workItem);
  }
  res.status(200).json({
    success: true,
    data: {
      workItemId: workItem.id,
      projectId: workItem.projectId,
      sla: getSlaSnapshot(workItem),
    },
  });
};

export const getWorkItemSlaAudit = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const workItem = await getAccessibleWorkItem(requireWorkItemId(req), actor);
  const logs = await AppDataSource.getRepository(AuditLog).find({
    where: {
      organizationId: actor.organizationId,
      projectId: workItem.projectId,
      entityType: "work_item",
      entityId: workItem.id,
    },
    relations: { user: true },
    order: { createdAt: "DESC" },
    take: 150,
  });

  res.status(200).json({
    success: true,
    data: logs
      .filter((log) => log.action === "escalated" || log.action.startsWith("sla_"))
      .map((log) => ({
        id: log.id,
        action: log.action,
        description: log.description,
        previousState: log.previousState,
        newState: log.newState,
        actorId: log.userId,
        actorName: log.user?.fullName || log.user?.email || "Unknown user",
        createdAt: log.createdAt,
      })),
  });
};

export const resolveWorkItemEscalation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const workItemId = requireWorkItemId(req);

  const workItem = await AppDataSource.transaction(async (manager) => {
    const item = await manager
      .getRepository(WorkItem)
      .createQueryBuilder("workItem")
      .where("workItem.id = :workItemId", { workItemId })
      .andWhere("workItem.organizationId = :organizationId", {
        organizationId: actor.organizationId,
      })
      .setLock("pessimistic_write")
      .getOne();

    if (!item) {
      throw new AppError("Work item not found", 404, "WORK_ITEM_NOT_FOUND");
    }

    await assertAccessibleProject(item.projectId, actor, manager);
    const previous = {
      status: item.slaStatus,
      escalatedAt: item.escalatedAt,
      reason: item.escalationReason,
    };

    item.escalatedAt = null;
    item.escalatedById = null;
    item.escalationReason = null;
    item.slaResolvedAt = new Date();

    if (!item.priority) {
      clearSlaState(item);
    } else {
      applySlaState(item);
    }

    const saved = await manager.getRepository(WorkItem).save(item);
    await writeSlaAudit(
      manager,
      saved,
      actor.id,
      "sla_escalation_resolved",
      "Resolved work item escalation",
      previous,
      { status: saved.slaStatus, resolvedAt: saved.slaResolvedAt },
    );
    return saved;
  });

  res.status(200).json({
    success: true,
    message: "Work item escalation resolved successfully",
    data: { ...workItem, sla: getSlaSnapshot(workItem) },
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
