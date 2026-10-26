import { EntityManager, In } from "typeorm";
import { AppDataSource } from "../config/data.source";
import { User, UserStatus } from "../entities/user.entity";
import { Project, ProjectVisibility } from "../entities/project.entity";
import { ProjectMember, ProjectRole } from "../entities/project.member.entity";
import {
  WorkItem,
  WorkItemType,
  WorkItemStatus,
  WorkItemPriority,
  SlaStatus,
} from "../entities/work.item.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import { Sprint } from "../entities/sprint.entities";
import {
  WorkItemRecurrence,
  RecurrenceFrequency,
  MonthlyPattern,
} from "../entities/work.item.recurrence.entity";
import { ProjectLabel } from "../entities/project.label.entity";
import { OrganizationSla } from "../entities/organization.sla.entity";
import {
  DEFAULT_RECURRENCE_TIMEZONE,
  RECURRENCE_TIME_OF_DAY,
  getInitialOccurrenceRunAt,
  validateRecurrence,
  type RecurrenceInput,
} from "./recurrence.service";
import { AppError } from "../errors/app.error";
import { NotificationType } from "../entities/notification.entity";
import { notificationService } from "./notification.service";
import {
  applySlaState,
  calculateSlaDeadline,
  writeSlaAudit,
} from "./sla.service";

export interface AssigneeInput {
  userId: string;
  startDate?: string | null;
  estimatedHours?: number | null;
}

export interface CreateWorkItemInput {
  projectId: string;
  sprintId?: string | null;
  parentWorkItemId?: string | null;
  labelId?: string | null;
  labels?: string[] | null;
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

export interface UpdateWorkItemInput {
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
  labelId?: string | null;
  labels?: string[] | null;
}

export interface Actor {
  id: string;
  organizationId: string;
  status: UserStatus;
  role: string;
}

export const isAdmin = (actor: Actor): boolean => actor.role === "ADMIN";

export function clearSlaState(workItem: WorkItem): void {
  workItem.slaDeadline = null;
  workItem.slaStatus = null;
  workItem.slaDeadlineIsCustom = false;
  workItem.escalatedAt = null;
  workItem.escalatedById = null;
  workItem.escalationReason = null;
  workItem.slaBreachedAt = null;
  workItem.slaResolvedAt = null;
}

export async function getActiveActor(userId: string): Promise<Actor> {
  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      role: true,
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE || !user.organizationId) {
    throw new AppError(
      "Authenticated user is not active or has no organization",
      401,
      "UNAUTHORIZED",
    );
  }

  return {
    id: user.id,
    organizationId: user.organizationId,
    status: user.status,
    role: user.role,
  };
}

export async function assertAccessibleProject(
  projectId: string,
  actor: Actor,
  manager?: EntityManager,
): Promise<Project> {
  const repository = manager
    ? manager.getRepository(Project)
    : AppDataSource.getRepository(Project);

  const project = await repository.findOne({
    where: {
      id: projectId,
      organizationId: actor.organizationId,
    },
    select: {
      id: true,
      organizationId: true,
      visibility: true,
    },
  });

  if (!project) {
    throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  }

  if (isAdmin(actor)) {
    return project;
  }

  const memberRepo = manager
    ? manager.getRepository(ProjectMember)
    : AppDataSource.getRepository(ProjectMember);

  const membership = await memberRepo.findOne({
    where: {
      projectId: project.id,
      userId: actor.id,
    },
    select: {
      projectId: true,
      userId: true,
      role: true,
    },
  });

  if (!membership && project.visibility !== ProjectVisibility.PUBLIC) {
    throw new AppError(
      "You do not have access to this project",
      403,
      "PROJECT_ACCESS_DENIED",
    );
  }

  return project;
}

export async function getAccessibleWorkItem(
  workItemId: string,
  actor: Actor,
): Promise<WorkItem> {
  const workItem = await AppDataSource.getRepository(WorkItem).findOne({
    where: {
      id: workItemId,
      organizationId: actor.organizationId,
    },
    relations: {
      project: true,
    },
  });

  if (!workItem) {
    throw new AppError("Work item not found", 404, "WORK_ITEM_NOT_FOUND");
  }

  await assertAccessibleProject(workItem.projectId, actor);
  return workItem;
}

export async function validateAssignees(
  assignees: AssigneeInput[],
  projectId: string,
  organizationId: string,
  manager: EntityManager,
): Promise<void> {
  if (assignees.length === 0) return;

  const uniqueIds = Array.from(new Set(assignees.map((a) => a.userId)));

  const validUsers = await manager.getRepository(User).find({
    where: {
      id: In(uniqueIds),
      organizationId,
      status: UserStatus.ACTIVE,
    },
    select: { id: true },
  });

  if (validUsers.length !== uniqueIds.length) {
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
    select: { userId: true },
  });

  const memberIds = new Set(memberships.map((m) => m.userId));
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

export async function createWorkItemOrchestration(
  actor: Actor,
  input: CreateWorkItemInput,
) {
  const {
    projectId,
    sprintId,
    parentWorkItemId,
    labelId,
    labels,
    type,
    title,
    description,
    priority,
    status = WorkItemStatus.BACKLOG,
    dueDate,
    assignees = [],
    recurrence,
    slaDeadline,
  } = input;

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

    const targetLabelId =
      labelId || (Array.isArray(labels) && labels.length > 0 ? labels[0] : null);
    let labelToAssign: ProjectLabel | null = null;
    if (targetLabelId) {
      labelToAssign = await manager.getRepository(ProjectLabel).findOne({
        where: { id: targetLabelId, projectId: project.id },
      });

      if (!labelToAssign) {
        throw new AppError(
          "Label not found in this project.",
          400,
          "INVALID_LABEL",
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
      labelId: labelToAssign ? labelToAssign.id : null,
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
      const orgPolicy = await manager.getRepository(OrganizationSla).findOne({
        where: { organizationId: actor.organizationId },
      });
      savedWorkItem.slaDeadline = slaDeadline
        ? new Date(slaDeadline)
        : calculateSlaDeadline(
            savedWorkItem.createdAt,
            savedWorkItem.priority,
            orgPolicy,
          );
      savedWorkItem.slaDeadlineIsCustom = Boolean(slaDeadline);
      applySlaState(savedWorkItem, new Date(), orgPolicy);
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
      label: labelToAssign,
      labels: labelToAssign ? [labelToAssign] : [],
      assignments,
      assigneeIds: assignments.map((assignee) => assignee.userId),
      assigneeId: assignments[0]?.userId || null,
      assignees: assignments.map((a) => a.user).filter(Boolean),
      recurrence: savedRecurrence,
    };
  });

  // Non-blocking notification dispatch
  try {
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
  } catch (error) {
    console.error("Assignment notification delivery failed:", error);
  }

  return result;
}

export async function updateWorkItemOrchestration(
  actor: Actor,
  workItemId: string,
  body: UpdateWorkItemInput,
) {
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

    const project = await assertAccessibleProject(
      workItem.projectId,
      actor,
      manager,
    );

    const previousPriority = workItem.priority;
    const previousStatus = workItem.status;
    const previousSlaState = {
      deadline: workItem.slaDeadline,
      status: workItem.slaStatus,
      breachedAt: workItem.slaBreachedAt,
    };

    if (body.sprintId !== undefined) {
      if (body.sprintId !== null) {
        const sprint = await manager.getRepository(Sprint).findOne({
          where: {
            id: body.sprintId,
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
        workItem.sprintId = body.sprintId;
      } else {
        workItem.sprintId = null;
      }
    }

    if (body.parentWorkItemId !== undefined) {
      if (body.parentWorkItemId !== null) {
        if (body.parentWorkItemId === workItem.id) {
          throw new AppError(
            "Work item cannot be its own parent",
            400,
            "INVALID_PARENT_WORK_ITEM",
          );
        }

        const parent = await manager.getRepository(WorkItem).findOne({
          where: {
            id: body.parentWorkItemId,
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
        workItem.parentWorkItemId = body.parentWorkItemId;
      } else {
        workItem.parentWorkItemId = null;
      }
    }

    const targetLabelId =
      body.labelId !== undefined
        ? body.labelId
        : Array.isArray(body.labels) && body.labels.length > 0
          ? body.labels[0]
          : body.labels === null
            ? null
            : undefined;

    if (targetLabelId !== undefined) {
      if (targetLabelId !== null) {
        const label = await manager.getRepository(ProjectLabel).findOne({
          where: { id: targetLabelId, projectId: project.id },
        });
        if (!label) {
          throw new AppError(
            "Label not found in this project.",
            400,
            "INVALID_LABEL",
          );
        }
        workItem.labelId = label.id;
      } else {
        workItem.labelId = null;
      }
    }

    if (body.title !== undefined) workItem.title = body.title.trim();
    if (body.description !== undefined) {
      workItem.description = body.description?.trim() || null;
    }
    if (body.type !== undefined) workItem.type = body.type;
    if (body.priority !== undefined) workItem.priority = body.priority ?? null;
    if (body.status !== undefined) workItem.status = body.status;
    if (body.dueDate !== undefined) {
      workItem.dueDate = body.dueDate == null ? null : new Date(body.dueDate);
    }

    if (body.slaDeadline !== undefined) {
      if (body.slaDeadline === null) {
        if (workItem.priority) {
          const orgPolicy = await manager.getRepository(OrganizationSla).findOne({
            where: { organizationId: actor.organizationId },
          });
          workItem.slaDeadline = calculateSlaDeadline(
            workItem.createdAt,
            workItem.priority,
            orgPolicy,
          );
          workItem.slaDeadlineIsCustom = false;
        } else {
          clearSlaState(workItem);
        }
      } else {
        if (!workItem.priority) {
          throw new AppError(
            "A priority is required to configure an SLA deadline",
            400,
            "WORK_ITEM_PRIORITY_REQUIRED",
          );
        }
        workItem.slaDeadline = new Date(body.slaDeadline);
        workItem.slaDeadlineIsCustom = true;
      }
    }

    const priorityChanged =
      body.priority !== undefined && body.priority !== previousPriority;
    const statusChanged =
      body.status !== undefined && body.status !== previousStatus;

    if (!workItem.priority) {
      clearSlaState(workItem);
    } else if (priorityChanged && body.slaDeadline === undefined) {
      const orgPolicy = await manager.getRepository(OrganizationSla).findOne({
        where: { organizationId: actor.organizationId },
      });
      workItem.slaDeadline = calculateSlaDeadline(
        workItem.createdAt,
        workItem.priority,
        orgPolicy,
      );
      workItem.slaDeadlineIsCustom = false;
      applySlaState(workItem, new Date(), orgPolicy);
    } else {
      const orgPolicy = await manager.getRepository(OrganizationSla).findOne({
        where: { organizationId: actor.organizationId },
      });
      applySlaState(workItem, new Date(), orgPolicy);
    }

    const savedWorkItem = await manager.getRepository(WorkItem).save(workItem);

    const slaChanged =
      savedWorkItem.slaDeadline?.toISOString() !==
        previousSlaState.deadline?.toISOString() ||
      savedWorkItem.slaStatus !== previousSlaState.status ||
      savedWorkItem.slaBreachedAt?.toISOString() !==
        previousSlaState.breachedAt?.toISOString();

    if (slaChanged) {
      await writeSlaAudit(
        manager,
        savedWorkItem,
        actor.id,
        "sla_updated",
        "Updated work item SLA state",
        previousSlaState,
        {
          deadline: savedWorkItem.slaDeadline,
          status: savedWorkItem.slaStatus,
          custom: savedWorkItem.slaDeadlineIsCustom,
        },
      );
    }

    const previousAssignments = await manager
      .getRepository(WorkItemAssignee)
      .find({
        where: { workItemId: savedWorkItem.id },
      });
    const previousAssigneeIds = previousAssignments.map((a) => a.userId);

    let nextAssignees: AssigneeInput[] | null = null;
    if (body.assignees !== undefined) {
      nextAssignees = body.assignees ?? [];
    } else if (body.assigneeIds !== undefined) {
      nextAssignees = (body.assigneeIds ?? []).map((userId) => ({ userId }));
    } else if (body.assigneeId !== undefined) {
      nextAssignees = body.assigneeId ? [{ userId: body.assigneeId }] : [];
    }

    if (nextAssignees !== null) {
      await validateAssignees(
        nextAssignees,
        project.id,
        actor.organizationId,
        manager,
      );

      await manager.getRepository(WorkItemAssignee).delete({
        workItemId: savedWorkItem.id,
      });

      if (nextAssignees.length > 0) {
        const assignments = nextAssignees.map((assignee) =>
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
    }

    const currentAssignments = await manager
      .getRepository(WorkItemAssignee)
      .find({
        where: { workItemId: savedWorkItem.id },
        relations: { user: true },
      });

    const currentAssigneeIds = currentAssignments.map((a) => a.userId);

    let assignedLabel: ProjectLabel | null = null;
    if (savedWorkItem.labelId) {
      assignedLabel = await manager.getRepository(ProjectLabel).findOne({
        where: { id: savedWorkItem.labelId, projectId: project.id },
      });
    }

    return {
      workItem: savedWorkItem,
      statusChanged,
      previousStatus,
      label: assignedLabel,
      labels: assignedLabel ? [assignedLabel] : [],
      assignments: currentAssignments,
      assigneeIds: currentAssigneeIds,
      assigneeId: currentAssigneeIds[0] || null,
      assignees: currentAssignments.map((a) => a.user).filter(Boolean),
      previousAssigneeIds,
    };
  });

  // Non-blocking notification dispatch
  try {
    const newlyAssigned = result.assigneeIds.filter(
      (id) => !result.previousAssigneeIds.includes(id) && id !== actor.id,
    );

    const notifications: Promise<any>[] = [];

    for (const userId of newlyAssigned) {
      notifications.push(
        notificationService.createNotification({
          userId,
          organizationId: actor.organizationId,
          type: NotificationType.TASK_ASSIGNED,
          title: "Task assigned to you",
          message: `You have been assigned "${result.workItem.title}".`,
          workItemId: result.workItem.id,
          projectId: result.workItem.projectId,
          link: `/tasks/${result.workItem.id}`,
        }),
      );
    }

    if (result.statusChanged) {
      const activeAssignees = result.assigneeIds.filter((id) => id !== actor.id);
      for (const userId of activeAssignees) {
        notifications.push(
          notificationService.createNotification({
            userId,
            organizationId: actor.organizationId,
            type: NotificationType.TASK_UPDATED,
            title: "Task status updated",
            message: `"${result.workItem.title}" moved from ${result.previousStatus} to ${result.workItem.status}.`,
            workItemId: result.workItem.id,
            projectId: result.workItem.projectId,
            link: `/tasks/${result.workItem.id}`,
          }),
        );
      }
    }

    await Promise.all(notifications);
  } catch (err) {
    console.error("Task update notification delivery failed:", err);
  }

  return {
    ...result.workItem,
    label: result.label,
    labels: result.labels,
    assignments: result.assignments,
    assigneeIds: result.assigneeIds,
    assigneeId: result.assigneeId,
    assignees: result.assignees,
  };
}
