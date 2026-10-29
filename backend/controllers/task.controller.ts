import { Request, Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../config/data.source";
import {
  WorkItem,
  WorkItemStatus,
  WorkItemType,
  SlaStatus,
} from "../entities/work.item.entity";
import { OrganizationSla } from "../entities/organization.sla.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import { WorkItemComment } from "../entities/work.item.comment.entity";
import { WorkItemTimeEntry } from "../entities/work.item.time.entry.entity";
import { WorkItemAttachment } from "../entities/work.item.attachment.entity";
import { WorkItemDependency } from "../entities/work.item.dependency.entity";
import { AuditLog } from "../entities/audit.log.entity";
import { uploadAndPersistWorkItemAttachments } from "../services/work.item.attachment.service";
import { AppError } from "../errors/app.error";
import { NotificationType } from "../entities/notification.entity";
import { notificationService } from "../services/notification.service";
import {
  applySlaState,
  calculateSlaDeadline,
  ensureSlaData,
  getSlaSnapshot,
  writeSlaAudit,
} from "../services/sla.service";
import { authorizeProjectPermission } from "../middleware/project.permission";
import { getPagination, getPaginationMeta } from "../utils/pagination";
import {
  getActiveActor,
  assertAccessibleProject,
  getAccessibleWorkItem,
  clearSlaState,
  createWorkItemOrchestration,
  updateWorkItemOrchestration,
  CreateWorkItemInput,
  UpdateWorkItemInput,
} from "../services/work-item.service";
import { lockProjectSchedule } from "../services/work-item-dependency.service";

interface ViewWorkItemsQuery {
  page: number;
  limit: number;
  status?: WorkItemStatus;
  type?: WorkItemType;
}

function requireUserId(req: Request): string {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  return userId;
}

function requireWorkItemId(req: Request): string {
  const workItemId = req.params.workItemId;
  if (typeof workItemId !== "string" || !workItemId.trim()) {
    throw new AppError(
      "Invalid work item ID",
      400,
      "INVALID_WORK_ITEM_ID",
    );
  }
  return workItemId;
}

// ==========================================
// CREATE WORK ITEM
// ==========================================
export const createWorkItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const body = req.body as CreateWorkItemInput;

  if (body.slaDeadline !== undefined) {
    await authorizeProjectPermission(req, "sla:manage");
  }

  const result = await createWorkItemOrchestration(actor, body);

  res.status(201).json({
    success: true,
    message: "Work item created successfully",
    data: {
      ...result.workItem,
      label: result.label,
      labels: result.labels,
      assignments: result.assignments,
      assigneeIds: result.assigneeIds,
      assigneeId: result.assigneeId,
      assignees: result.assignees,
      recurrence: result.recurrence,
      sla: getSlaSnapshot(result.workItem),
    },
  });
};

// ==========================================
// UPDATE WORK ITEM
// ==========================================
export const updateWorkItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const workItemId = requireWorkItemId(req);
  const body = req.body as UpdateWorkItemInput;

  if (body.slaDeadline !== undefined) {
    await authorizeProjectPermission(req, "sla:manage");
  }

  const result = await updateWorkItemOrchestration(actor, workItemId, body);

  res.status(200).json({
    success: true,
    message: "Work item updated successfully",
    data: result,
  });
};

// ==========================================
// LIST PROJECT WORK ITEMS
// ==========================================
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
    .leftJoinAndSelect("workItem.label", "label")
    .where("workItem.projectId = :projectId", {
      projectId: project.id,
    })
    .andWhere("workItem.organizationId = :organizationId", {
      organizationId: actor.organizationId,
    })
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
  if (workItems.length > 0) {
    const workItemIds = workItems.map((workItem) => workItem.id);
    const [assignments, comments, timeEntries, children, attachments, dependencies] =
      await Promise.all([
        AppDataSource.getRepository(WorkItemAssignee).find({
          where: { workItemId: In(workItemIds) },
          relations: { user: true },
        }),
        AppDataSource.getRepository(WorkItemComment).find({
          where: { workItemId: In(workItemIds) },
        }),
        AppDataSource.getRepository(WorkItemTimeEntry).find({
          where: { workItemId: In(workItemIds) },
        }),
        AppDataSource.getRepository(WorkItem).find({
          where: { parentWorkItemId: In(workItemIds) },
        }),
        AppDataSource.getRepository(WorkItemAttachment).find({
          where: { workItemId: In(workItemIds) },
        }),
        AppDataSource.getRepository(WorkItemDependency).find({
          where: { workItemId: In(workItemIds) },
          order: { id: "ASC" },
        }),
      ]);

    const assignmentsByWorkItem = new Map<string, WorkItemAssignee[]>();
    for (const assignment of assignments) {
      const current = assignmentsByWorkItem.get(assignment.workItemId) ?? [];
      current.push(assignment);
      assignmentsByWorkItem.set(assignment.workItemId, current);
    }

    const commentsByWorkItem = new Map<string, WorkItemComment[]>();
    for (const comment of comments) {
      const current = commentsByWorkItem.get(comment.workItemId) ?? [];
      current.push(comment);
      commentsByWorkItem.set(comment.workItemId, current);
    }

    const timeEntriesByWorkItem = new Map<string, WorkItemTimeEntry[]>();
    for (const entry of timeEntries) {
      const current = timeEntriesByWorkItem.get(entry.workItemId) ?? [];
      current.push(entry);
      timeEntriesByWorkItem.set(entry.workItemId, current);
    }

    const childrenByParent = new Map<string, WorkItem[]>();
    for (const child of children) {
      if (!child.parentWorkItemId) continue;
      const current = childrenByParent.get(child.parentWorkItemId) ?? [];
      current.push(child);
      childrenByParent.set(child.parentWorkItemId, current);
    }

    const attachmentsByWorkItem = new Map<string, WorkItemAttachment[]>();
    for (const attachment of attachments) {
      const current = attachmentsByWorkItem.get(attachment.workItemId) ?? [];
      current.push(attachment);
      attachmentsByWorkItem.set(attachment.workItemId, current);
    }

    const dependenciesByWorkItem = new Map<string, WorkItemDependency[]>();
    for (const dependency of dependencies) {
      const current =
        dependenciesByWorkItem.get(dependency.workItemId) ?? [];
      current.push(dependency);
      dependenciesByWorkItem.set(dependency.workItemId, current);
    }

    for (const workItem of workItems) {
      workItem.assignments = assignmentsByWorkItem.get(workItem.id) ?? [];
      workItem.comments = commentsByWorkItem.get(workItem.id) ?? [];
      workItem.timeEntries = timeEntriesByWorkItem.get(workItem.id) ?? [];
      workItem.children = childrenByParent.get(workItem.id) ?? [];
      workItem.attachments = attachmentsByWorkItem.get(workItem.id) ?? [];
      workItem.dependencies = dependenciesByWorkItem.get(workItem.id) ?? [];
    }
  }

  const slaPolicy = workItems.some((workItem) => workItem.priority)
    ? await AppDataSource.getRepository(OrganizationSla).findOne({
        where: { organizationId: actor.organizationId },
      })
    : null;

  for (const workItem of workItems) {
    if (!workItem.priority) {
      clearSlaState(workItem);
      continue;
    }

    if (!workItem.slaDeadline) {
      workItem.slaDeadline = calculateSlaDeadline(
        workItem.createdAt,
        workItem.priority,
        slaPolicy,
      );
      workItem.slaDeadlineIsCustom = false;
    }
    applySlaState(workItem, new Date(), slaPolicy);
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

// ==========================================
// UPLOAD ATTACHMENTS
// ==========================================
export const uploadAttachmentsToWorkItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const workItem = await getAccessibleWorkItem(requireWorkItemId(req), actor);
  const uploadedFiles = (req.files as Express.Multer.File[]) || [];

  if (uploadedFiles.length === 0) {
    throw new AppError(
      "At least one attachment is required.",
      400,
      "ATTACHMENT_REQUIRED",
    );
  }

  const attachments = await uploadAndPersistWorkItemAttachments(
    uploadedFiles,
    workItem.id,
    actor.id,
  );

  res.status(201).json({
    success: true,
    attachments,
  });
};

// ==========================================
// DELETE WORK ITEM
// ==========================================
export const deleteWorkItem = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const actor = await getActiveActor(requireUserId(req));
  const workItemId = requireWorkItemId(req);

  await AppDataSource.transaction(async (manager) => {
    const reference = await manager.getRepository(WorkItem).findOne({
      where: { id: workItemId, organizationId: actor.organizationId },
      select: { id: true, projectId: true },
    });
    if (!reference) {
      throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }
    await lockProjectSchedule(
      manager,
      reference.projectId,
      actor.organizationId,
    );

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
      throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
    }

    await assertAccessibleProject(workItem.projectId, actor, manager);
    const assignments = await manager.getRepository(WorkItemAssignee).find({
      where: { workItemId: workItem.id },
      select: { userId: true },
    });
    await manager.getRepository(AuditLog).save(
      manager.getRepository(AuditLog).create({
        organizationId: workItem.organizationId,
        projectId: workItem.projectId,
        userId: actor.id,
        action: "deleted",
        entityType: "task",
        entityId: workItem.id,
        description: `Deleted work item "${workItem.title}"`,
        previousState: {
          title: workItem.title,
          type: workItem.type,
          status: workItem.status,
          priority: workItem.priority,
          assigneeIds: assignments.map((assignment) => assignment.userId),
        },
        newState: null,
        trustedForUndo: false,
      }),
    );
    await manager.getRepository(WorkItem).remove(workItem);
  });

  res.status(200).json({
    success: true,
    message: "Work item deleted successfully",
    data: { id: workItemId },
  });
};

// ==========================================
// ESCALATE WORK ITEM
// ==========================================
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
    throw new AppError(
      "Escalation reason must be 500 characters or fewer",
      400,
      "INVALID_ESCALATION_REASON",
    );
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
    try {
      const assignments = await AppDataSource.getRepository(
        WorkItemAssignee,
      ).find({
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
    } catch (err) {
      console.error("Escalation notification failed:", err);
    }
  }

  res.status(200).json({
    success: true,
    message: result.alreadyEscalated
      ? "Work item is already escalated"
      : "Work item escalated successfully",
    data: {
      ...result.workItem,
      sla: getSlaSnapshot(result.workItem),
      alreadyEscalated: result.alreadyEscalated,
    },
  });
};

// ==========================================
// RESOLVE WORK ITEM ESCALATION
// ==========================================
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

// ==========================================
// GET WORK ITEM SLA
// ==========================================
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

// ==========================================
// GET WORK ITEM SLA AUDIT
// ==========================================
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
      .filter(
        (log) =>
          log.action === "escalated" || log.action.startsWith("sla_"),
      )
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
