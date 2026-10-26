import { In } from "typeorm";
// import { WorkItemComment } from "../entities/work.item.comment.entity";
// import { WorkItemTimeEntry } from "../entities/work.item.time.entry.entity";
// import { ProjectLabel } from "../entities/project.label.entity";
// import { WorkItemDependency } from "../entities/work.item.dependency.entity";
// import { ProjectWorkflow } from "../entities/project.workflow.entity";
// import { Notification } from "../entities/notification.entity";

import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../config/data.source";
import { AuditLog } from "../entities/audit.log.entity";
import { ProjectMember } from "../entities/project.member.entity";
import { User } from "../entities/user.entity";

import {
  WorkItem,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType,
} from "../entities/work.item.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import { AppError } from "../errors/app.error";

export async function createAuditLog(req: Request, res: Response) {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  const { action, entityType, entityId, previousState, newState } = req.body;
  let pId =
    req.body.projectId ||
    (req.params.projectId && req.params.projectId !== "audit-logs"
      ? req.params.projectId
      : null);

  const desc =
    req.body.description ||
    req.body.details?.description ||
    `${action || ""} ${entityType || ""}`.trim() ||
    "Activity";

  if (!action || !entityType) {
    throw new AppError(
      "action and entityType are required.",
      400,
      "VALIDATION_ERROR",
    );
  }

  // If pId is missing and this is a task event, attempt to resolve from WorkItem record
  if (!pId && entityType === "task" && entityId) {
    try {
      const task = await AppDataSource.getRepository(WorkItem).findOne({
        where: { id: String(entityId) },
        select: { id: true, projectId: true },
      });
      if (task?.projectId) {
        pId = task.projectId;
      }
    } catch {
      // non-uuid entityId
    }
  }

  const repo = AppDataSource.getRepository(AuditLog);
  const log = await repo.save(
    repo.create({
      organizationId: organizationId!,
      projectId: pId ? String(pId) : null,
      userId: userId!,
      action: String(action),
      entityType: String(entityType),
      entityId: String(entityId || ""),
      description: String(desc),
      previousState: previousState || req.body.details?.previousValue || null,
      newState: newState || req.body.details?.newValue || null,
    }),
  );

  return res.status(201).json({
    success: true,
    data: {
      ...log,
      timestamp: log.createdAt,
    },
  });
}

export async function undoAuditLog(req: Request, res: Response) {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;
  const logId = String(req.params.logId);
  const requestedProjectId =req.params.projectId && req.params.projectId !== "audit-logs"
      ? String(req.params.projectId)
      : null;

  if (!userId) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }

  const result = await AppDataSource.transaction(async (manager) => {
    const auditRepo = manager.getRepository(AuditLog);
    const targetLog = await auditRepo
      .createQueryBuilder("audit")
      .setLock("pessimistic_write")
      .where("audit.id = :logId", { logId })
      .getOne();

    if (!targetLog) {
      throw new AppError(
        "Audit log entry not found.",
        404,
        "AUDIT_LOG_NOT_FOUND",
      );
    }

    if (organizationId && targetLog.organizationId !== organizationId) {
      throw new AppError("Access denied.", 403, "FORBIDDEN");
    }

    if (
      requestedProjectId &&
      targetLog.projectId &&
      targetLog.projectId !== requestedProjectId
    ) {
      throw new AppError(
        "Audit log does not belong to specified project.",
        403,
        "FORBIDDEN",
      );
    }

    if (targetLog.isUndone) {
      throw new AppError(
        "This action has already been undone.",
        400,
        "ALREADY_UNDONE",
      );
    }

    if (
      !targetLog.previousState ||
      targetLog.action.toLowerCase() === "undone" ||
      targetLog.action.toLowerCase() === "deleted"
    ) {
      throw new AppError(
        "This action cannot be undone.",
        400,
        "ACTION_NOT_REVERSIBLE",
      );
    }

    let restoredTask: any = null;

    if (targetLog.entityType === "task") {
      const workItemRepo = manager.getRepository(WorkItem);
      const workItem = await workItemRepo.findOne({
        where: { id: targetLog.entityId },
      });

      if (!workItem) {
        throw new AppError(
          "Target work item no longer exists.",
          404,
          "WORK_ITEM_NOT_FOUND",
        );
      }

      if (organizationId && workItem.organizationId !== organizationId) {
        throw new AppError("Access denied to work item.", 403, "FORBIDDEN");
      }

      const prev = targetLog.previousState;

      if (prev.title !== undefined && prev.title !== null) {
        workItem.title = String(prev.title).trim();
      }
      if (prev.description !== undefined) {
        workItem.description = prev.description
          ? String(prev.description).trim()
          : null;
      }
      if (prev.status !== undefined && prev.status !== null) {
        const normStatus = String(prev.status)
          .toUpperCase()
          .replace(/[-\s]/g, "_");
        if (
          Object.values(WorkItemStatus).includes(normStatus as WorkItemStatus)
        ) {
          workItem.status = normStatus as WorkItemStatus;
        }
      }
      
      if (prev.priority !== undefined && prev.priority !== null) {
        const normPriority = String(prev.priority).toUpperCase();
        if (
          Object.values(WorkItemPriority).includes(
            normPriority as WorkItemPriority,
          )
        ) {
          workItem.priority = normPriority as WorkItemPriority;
        }
      }
      if (prev.type !== undefined && prev.type !== null) {
        const normType = String(prev.type).toUpperCase();
        if (Object.values(WorkItemType).includes(normType as WorkItemType)) {
          workItem.type = normType as WorkItemType;
        }
      }
      if (prev.dueDate !== undefined) {
        workItem.dueDate = prev.dueDate ? new Date(prev.dueDate) : null;
      }
      if (prev.parentWorkItemId !== undefined || prev.parentId !== undefined) {
        workItem.parentWorkItemId =
          prev.parentWorkItemId || prev.parentId || null;
      }

      await workItemRepo.save(workItem);

      if (
        prev.assigneeId !== undefined ||
        prev.assignees !== undefined ||
        prev.assigneeIds !== undefined
      ) {
        const assigneeRepo = manager.getRepository(WorkItemAssignee);
        await assigneeRepo.delete({ workItemId: workItem.id });
        let userIds: string[] = [];
        if (Array.isArray(prev.assignees)) {
          userIds = prev.assignees
            .map((a: any) => (typeof a === "string" ? a : a.userId || a.id))
            .filter(Boolean);
        } else if (Array.isArray(prev.assigneeIds)) {
          userIds = prev.assigneeIds.filter(Boolean);
        } else if (prev.assigneeId) {
          userIds = [prev.assigneeId];
        }

        if (userIds.length > 0) {
          const assigneeEntities = userIds.map((uId) =>
            assigneeRepo.create({
              workItemId: workItem.id,
              userId: uId,
              assignedById: userId,
            }),
          );
          await assigneeRepo.save(assigneeEntities);
        }
      }

      const assignments = await manager.getRepository(WorkItemAssignee).find({
        where: { workItemId: workItem.id },
      });

      restoredTask = {
        ...workItem,
        assignments,
        assigneeIds: assignments.map((a) => a.userId),
        assigneeId: assignments[0]?.userId || null,
      };
    }

    const reversalDesc = `Undid change: ${targetLog.description || targetLog.action}`;
    const reversalLog = await auditRepo.save(
      auditRepo.create({
        organizationId: targetLog.organizationId,
        projectId: targetLog.projectId,
        userId: userId,
        action: "undone",
        entityType: targetLog.entityType,
        entityId: targetLog.entityId,
        description: reversalDesc,
        previousState: targetLog.newState,
        newState: targetLog.previousState,
        isUndone: false,
      }),
    );

    targetLog.isUndone = true;
    targetLog.undoneAt = new Date();
    targetLog.undoneById = userId;
    targetLog.reversalLogId = reversalLog.id;
    await auditRepo.save(targetLog);

    return {
      targetLog,
      reversalLog,
      restoredTask,
    };
  });

  return res.status(200).json({
    success: true,
    message: "Action undone successfully.",
    data: {
      undoneLogId: result.targetLog.id,
      reversalLog: {
        ...result.reversalLog,
        timestamp: result.reversalLog.createdAt,
        actorId: result.reversalLog.userId,
      },
      restoredTask: result.restoredTask,
    },
  });
}

///////////////////
// for get
// /////////////////

export async function getProjectAuditLogs(req: Request, res: Response) {
  const projectId = req.params.projectId
    ? String(req.params.projectId)
    : undefined;
  const organizationId = req.user?.organizationId;

  // Find all task IDs for this project if projectId is supplied
  let projectTaskIds: string[] = [];
  if (projectId) {
    try {
      const projectTasks = await AppDataSource.getRepository(WorkItem).find({
        where: { projectId },
        select: { id: true, title: true },
      });
      projectTaskIds = projectTasks.map((t) => t.id);
    } catch {
      // Gracefully continue
    }
  }

  let logs: AuditLog[] = [];
  const auditRepo = AppDataSource.getRepository(AuditLog);

  if (projectId) {
    const qb = auditRepo
      .createQueryBuilder("audit")
      .leftJoinAndSelect("audit.user", "user")
      .leftJoinAndSelect("audit.project", "project")
      .orderBy("audit.createdAt", "DESC")
      .take(150);

    if (organizationId) {
      qb.where("audit.organizationId = :organizationId", { organizationId });
      if (projectTaskIds.length > 0) {
        qb.andWhere(
          "(audit.projectId = :projectId OR (audit.entityType = 'task' AND audit.entityId IN (:...projectTaskIds)))",
          { projectId, projectTaskIds },
        );
      } else {
        qb.andWhere("audit.projectId = :projectId", { projectId });
      }
    } else {
      if (projectTaskIds.length > 0) {
        qb.where(
          "(audit.projectId = :projectId OR (audit.entityType = 'task' AND audit.entityId IN (:...projectTaskIds)))",
          { projectId, projectTaskIds },
        );
      } else {
        qb.where("audit.projectId = :projectId", { projectId });
      }
    }

    logs = await qb.getMany();
  } else {
    logs = await auditRepo.find({
      where: organizationId ? { organizationId } : {},
      relations: { user: true, project: true },
      order: { createdAt: "DESC" },
      take: 150,
    });
  }

  const taskIds = logs
    .filter((l) => l.entityType === "task" && l.entityId)
    .map((l) => l.entityId);

  const taskMap: Record<string, string> = {};
  if (taskIds.length > 0) {
    try {
      const foundTasks = await AppDataSource.getRepository(WorkItem).find({
        where: { id: In(taskIds) },
        select: { id: true, title: true },
      });
      foundTasks.forEach((t) => {
        taskMap[t.id] = t.title;
      });
    } catch {
      // In case of non-uuid entityId, gracefully continue
    }
  }

  return res.json({
    success: true,
    data: logs.map((l) => {
      let entityTitle: string | null = null;
      if (l.entityType === "task") {
        entityTitle =
          taskMap[l.entityId] ||
          l.newState?.title ||
          l.previousState?.title ||
          null;
      } else if (l.entityType === "project") {
        entityTitle = l.project?.name || null;
      }

      const userName =
        l.user?.fullName?.trim() || l.user?.email || "Unknown user";

      const canUndo =
        !l.isUndone &&
        Boolean(l.previousState) &&
        l.action !== "undone" &&
        l.action !== "UNDONE" &&
        l.action !== "deleted" &&
        l.action !== "DELETED" &&
        (l.entityType !== "task" || Boolean(taskMap[l.entityId]));

      return {
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        entityTitle,
        description: l.description,
        previousState: l.previousState,
        newState: l.newState,
        previousValue: l.previousState,
        newValue: l.newState,
        canUndo,
        isUndone: Boolean(l.isUndone),
        undoneAt: l.undoneAt || null,
        reversalLogId: l.reversalLogId || null,
        projectId: l.projectId,
        userId: l.userId,
        actorId: l.userId,
        userName,
        actorName: userName,
        userEmail: l.user?.email || null,
        timestamp: l.createdAt,
        createdAt: l.createdAt,
      };
    }),
  });
}



export async function getMyAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Identity comes from authentication middleware, never from req.params.
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;

    if (!userId || !organizationId) {
      return res.status(401).json({
        success: false,
        message: "Authentication and organization context are required",
      });
    }

    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1,
    );
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20),
    );

    // Confirm the authenticated user belongs to the organization.
    const userExists = await AppDataSource.getRepository(User)
      .createQueryBuilder("user")
      .where("user.id = :userId", { userId })
      .andWhere("user.organizationId = :organizationId", {
        organizationId,
      })
      .getExists();

    if (!userExists) {
      return res.status(403).json({
        success: false,
        message: "User does not belong to this organization",
      });
    }

    // Find only projects this user is enrolled in.
    const memberships = await AppDataSource.getRepository(ProjectMember)
      .createQueryBuilder("member")
      .innerJoin("member.project", "project")
      .select("member.projectId", "projectId")
      .where("member.userId = :userId", { userId })
      .andWhere("project.organizationId = :organizationId", {
        organizationId,
      })
      .getRawMany<{ projectId: string }>();

    const projectIds = [
      ...new Set(memberships.map((membership) => membership.projectId)),
    ];

    if (projectIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Only logs made by this user in their enrolled projects.
    const auditRepo = AppDataSource.getRepository(AuditLog);

    const qb = auditRepo
      .createQueryBuilder("audit")
      .leftJoinAndSelect("audit.project", "project")
      .leftJoinAndSelect("audit.user", "actor")
      .where("audit.organizationId = :organizationId", {
        organizationId,
      })
      .andWhere("audit.userId = :userId", { userId })
      .andWhere("audit.projectId IN (:...projectIds)", { projectIds })
      .orderBy("audit.createdAt", "DESC");

    const total = await qb.clone().getCount();

    const logs = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // Resolve task titles only for UUID-based task entity IDs.
    const taskIds = [
      ...new Set(
        logs
          .filter((log) => log.entityType === "task" && log.entityId)
          .map((log) => log.entityId),
      ),
    ];

    const taskMap = new Map<string, string>();

    if (taskIds.length > 0) {
      const tasks = await AppDataSource.getRepository(WorkItem)
        .createQueryBuilder("task")
        .select(["task.id", "task.title"])
        .where("task.id IN (:...taskIds)", { taskIds })
        .getMany();

      for (const task of tasks) {
        taskMap.set(task.id, task.title);
      }
    }

    return res.status(200).json({
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        entityTitle:
          (log.entityType === "task"
            ? taskMap.get(log.entityId)
            : log.entityType === "project"
              ? log.project?.name
              : null) ??
          log.newState?.title ??
          log.previousState?.title ??
          null,
        description: log.description,
        previousState: log.previousState,
        newState: log.newState,
        projectId: log.projectId,
        projectName: log.project?.name ?? null,
        userId: log.userId,
        userName:
          log.user?.fullName?.trim() || log.user?.email || "Unknown user",
        timestamp: log.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}
