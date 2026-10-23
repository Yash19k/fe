import { Request, Response } from "express";
import { In } from "typeorm";
import { AppDataSource } from "../config/data.source";
import { WorkItemComment } from "../entities/work.item.comment.entity";
import { WorkItemTimeEntry } from "../entities/work.item.time.entry.entity";
import { ProjectLabel } from "../entities/project.label.entity";
import { WorkItemDependency } from "../entities/work.item.dependency.entity";
import { ProjectWorkflow } from "../entities/project.workflow.entity";
import { AuditLog } from "../entities/audit.log.entity";
import { Notification } from "../entities/notification.entity";
import {
  WorkItem,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType,
} from "../entities/work.item.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import { AppError } from "../errors/app.error";

// ==========================================
// Comments
// ==========================================

export async function addWorkItemComment(req: Request, res: Response) {
  const workItemId = String(req.params.workItemId);
  const text = req.body.body || req.body.content || req.body.text;
  const userId = req.user?.id;

  if (!text || typeof text !== "string" || !text.trim()) {
    throw new AppError("Comment body is required.", 400, "VALIDATION_ERROR");
  }

  const workItem = await AppDataSource.getRepository(WorkItem).findOne({
    where: { id: workItemId },
    select: { id: true, projectId: true, organizationId: true },
  });

  if (!workItem || (req.user?.organizationId && workItem.organizationId !== req.user.organizationId)) {
    throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
  }

  const commentRepo = AppDataSource.getRepository(WorkItemComment);
  const comment = await commentRepo.save(
    commentRepo.create({
      workItemId,
      authorId: userId!,
      body: text.trim(),
    }),
  );

  return res.status(201).json({
    success: true,
    data: {
      id: comment.id,
      workItemId: comment.workItemId,
      authorId: comment.authorId,
      userId: comment.authorId,
      body: comment.body,
      content: comment.body,
      text: comment.body,
      createdAt: comment.createdAt,
    },
  });
}

export async function getWorkItemComments(req: Request, res: Response) {
  const workItemId = String(req.params.workItemId);

  const workItem = await AppDataSource.getRepository(WorkItem).findOne({
    where: { id: workItemId },
    select: { id: true, projectId: true, organizationId: true },
  });

  if (!workItem || (req.user?.organizationId && workItem.organizationId !== req.user.organizationId)) {
    throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
  }

  const comments = await AppDataSource.getRepository(WorkItemComment).find({
    where: { workItemId },
    relations: { author: true },
    order: { createdAt: "ASC" },
  });

  return res.json({
    success: true,
    data: comments.map((c) => ({
      id: c.id,
      workItemId: c.workItemId,
      authorId: c.authorId,
      userId: c.authorId,
      authorName: c.author?.fullName || c.author?.email || "User",
      body: c.body,
      content: c.body,
      text: c.body,
      createdAt: c.createdAt,
    })),
  });
}

// ==========================================
// Time Entries
// ==========================================

export async function addWorkItemTimeEntry(req: Request, res: Response) {
  const workItemId = String(req.params.workItemId);
  const durationMinutes = req.body.durationMinutes !== undefined
    ? Number(req.body.durationMinutes)
    : (req.body.hours !== undefined ? Math.round(Number(req.body.hours) * 60) : 0);
  const description = req.body.description || req.body.note || "";
  const startTime = req.body.startTime || req.body.date;
  const userId = req.user?.id;

  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new AppError(
      "durationMinutes or hours must be a positive number.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const workItem = await AppDataSource.getRepository(WorkItem).findOne({
    where: { id: workItemId },
    select: { id: true, projectId: true, organizationId: true },
  });

  if (!workItem) {
    throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
  }

  const timeEntryRepo = AppDataSource.getRepository(WorkItemTimeEntry);
  const entry = await timeEntryRepo.save(
    timeEntryRepo.create({
      workItemId,
      userId: userId!,
      durationMinutes: duration,
      description: description ? String(description).trim() : null,
      startTime: startTime ? new Date(startTime) : new Date(),
    }),
  );

  return res.status(201).json({
    success: true,
    data: {
      id: entry.id,
      workItemId: entry.workItemId,
      userId: entry.userId,
      durationMinutes: entry.durationMinutes,
      hours: Number((entry.durationMinutes / 60).toFixed(2)),
      description: entry.description,
      note: entry.description,
      startTime: entry.startTime,
      createdAt: entry.createdAt,
    },
  });
}

export async function getWorkItemTimeEntries(req: Request, res: Response) {
  const workItemId = String(req.params.workItemId);

  const entries = await AppDataSource.getRepository(WorkItemTimeEntry).find({
    where: { workItemId },
    relations: { user: true },
    order: { startTime: "DESC" },
  });

  return res.json({
    success: true,
    data: entries.map((e) => ({
      id: e.id,
      workItemId: e.workItemId,
      userId: e.userId,
      userName: e.user?.fullName || e.user?.email || "User",
      durationMinutes: e.durationMinutes,
      hours: Number((e.durationMinutes / 60).toFixed(2)),
      description: e.description,
      note: e.description,
      startTime: e.startTime,
      createdAt: e.createdAt,
    })),
  });
}

// ==========================================
// Dependencies
// ==========================================

export async function addWorkItemDependency(req: Request, res: Response) {
  const workItemId = String(req.params.workItemId);
  const dependsOnWorkItemId = String(req.body.dependsOnWorkItemId || "").trim();

  if (!dependsOnWorkItemId) {
    throw new AppError("dependsOnWorkItemId is required.", 400, "VALIDATION_ERROR");
  }

  if (workItemId === dependsOnWorkItemId) {
    throw new AppError(
      "A work item cannot depend on itself.",
      400,
      "INVALID_DEPENDENCY",
    );
  }

  const repo = AppDataSource.getRepository(WorkItemDependency);
  const existing = await repo.findOne({
    where: { workItemId, dependsOnWorkItemId },
  });

  if (existing) {
    return res.json({ success: true, data: existing });
  }

  const dep = await repo.save(
    repo.create({
      workItemId,
      dependsOnWorkItemId,
    }),
  );

  return res.status(201).json({ success: true, data: dep });
}

export async function getWorkItemDependencies(req: Request, res: Response) {
  const workItemId = String(req.params.workItemId);

  const deps = await AppDataSource.getRepository(WorkItemDependency).find({
    where: { workItemId },
  });

  return res.json({
    success: true,
    data: deps.map((d) => d.dependsOnWorkItemId),
  });
}

export async function deleteWorkItemDependency(req: Request, res: Response) {
  const workItemId = String(req.params.workItemId);
  const depId = String(req.params.depId);

  await AppDataSource.getRepository(WorkItemDependency).delete({
    workItemId,
    dependsOnWorkItemId: depId,
  });

  return res.json({ success: true });
}

// ==========================================
// Labels
// ==========================================

export async function getProjectLabels(req: Request, res: Response) {
  const projectId = String(req.params.projectId);

  const labels = await AppDataSource.getRepository(ProjectLabel).find({
    where: { projectId },
    order: { name: "ASC" },
  });

  return res.json({
    success: true,
    data: labels,
  });
}

export async function createProjectLabel(req: Request, res: Response) {
  const projectId = String(req.params.projectId);
  const { name, color, description } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new AppError("Label name is required.", 400, "VALIDATION_ERROR");
  }

  const repo = AppDataSource.getRepository(ProjectLabel);
  const existing = await repo.findOne({
    where: { projectId, name: name.trim() },
  });

  if (existing) {
    return res.status(200).json({ success: true, data: existing });
  }

  const label = await repo.save(
    repo.create({
      projectId,
      name: name.trim(),
      color: color ? String(color).trim() : "#3B82F6",
      description: description ? String(description).trim() : null,
    }),
  );

  return res.status(201).json({ success: true, data: label });
}

export async function deleteProjectLabel(req: Request, res: Response) {
  const projectId = String(req.params.projectId);
  const labelId = String(req.params.labelId);

  await AppDataSource.getRepository(ProjectLabel).delete({
    id: labelId,
    projectId,
  });

  return res.json({ success: true });
}

// ==========================================
// Workflows
// ==========================================

export const DEFAULT_WORKFLOW_NAME = "TaskFlow Pro — Final Statuses";

export const DEFAULT_WORKFLOW_STATUSES = [
  { id: "st-backlog", name: "Backlog", category: "unstarted", color: "#6B7280", allowedTransitions: ["In Progress"] },
  { id: "st-inprogress", name: "In Progress", category: "active", color: "#3B82F6", allowedTransitions: ["In Review", "Testing / QA", "Blocked", "On Hold"] },
  { id: "st-inreview", name: "In Review", category: "active", color: "#A855F7", allowedTransitions: ["Testing / QA", "In Progress", "Blocked", "On Hold"] },
  { id: "st-testingqa", name: "Testing / QA", category: "active", color: "#06B6D4", allowedTransitions: ["Done", "In Progress", "Blocked", "On Hold"], roleRestrictions: { Done: ["Manager", "Admin"] } },
  { id: "st-blocked", name: "Blocked", category: "impediment", color: "#EF4444", allowedTransitions: ["Backlog", "In Progress", "In Review", "Testing / QA"] },
  { id: "st-onhold", name: "On Hold", category: "impediment", color: "#F97316", allowedTransitions: ["Backlog", "In Progress", "In Review", "Testing / QA"] },
  { id: "st-done", name: "Done", category: "completed", color: "#22C55E", allowedTransitions: ["In Progress"] },
];

export async function getProjectWorkflow(req: Request, res: Response) {
  const projectId = String(req.params.projectId);

  const workflow = await AppDataSource.getRepository(ProjectWorkflow).findOne({
    where: { projectId },
  });

  if (!workflow) {
    return res.json({
      success: true,
      data: {
        id: `default-${projectId}`,
        projectId,
        name: DEFAULT_WORKFLOW_NAME,
        statuses: DEFAULT_WORKFLOW_STATUSES,
        stages: DEFAULT_WORKFLOW_STATUSES,
        isDefault: true,
      },
    });
  }

  // Normalize legacy generic or raw UUID workflow names
  const isGenericName =
    !workflow.name ||
    workflow.name === "Custom Engineering Flow" ||
    workflow.name.endsWith(" Workflow") ||
    /^[0-9a-fA-F-]{20,}/.test(workflow.name);

  const resolvedName = isGenericName ? DEFAULT_WORKFLOW_NAME : workflow.name;

  return res.json({
    success: true,
    data: {
      ...workflow,
      name: resolvedName,
      stages: workflow.statuses,
    },
  });
}

export async function saveProjectWorkflow(req: Request, res: Response) {
  const projectId = String(req.params.projectId);
  const stages = req.body.stages || req.body.statuses;
  const rawName = req.body.name ? String(req.body.name).trim() : "";
  const name = rawName && rawName !== "Custom Engineering Flow" && !rawName.endsWith(" Workflow")
    ? rawName
    : DEFAULT_WORKFLOW_NAME;

  if (!stages || !Array.isArray(stages) || stages.length === 0) {
    throw new AppError(
      "Workflow stages or statuses array is required and must not be empty.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const repo = AppDataSource.getRepository(ProjectWorkflow);
  let workflow = await repo.findOne({ where: { projectId } });

  if (workflow) {
    workflow.name = name;
    workflow.statuses = stages;
    const saved = await repo.save(workflow);
    return res.json({
      success: true,
      data: {
        id: saved.id,
        projectId: saved.projectId,
        name: saved.name,
        statuses: saved.statuses,
        stages: saved.statuses,
        updatedAt: saved.updatedAt,
      },
    });
  } else {
    const created = repo.create({
      projectId,
      name,
      statuses: stages,
    });
    const saved = await repo.save(created);
    return res.json({
      success: true,
      data: {
        id: saved.id,
        projectId: saved.projectId,
        name: saved.name,
        statuses: saved.statuses,
        stages: saved.statuses,
        createdAt: saved.createdAt,
      },
    });
  }
}

// ==========================================
// Audit Logs
// ==========================================

export async function getProjectAuditLogs(req: Request, res: Response) {
  const projectId = req.params.projectId ? String(req.params.projectId) : undefined;
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
        l.user?.fullName?.trim() ||
        l.user?.email ||
        "Unknown user";

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

export async function createAuditLog(req: Request, res: Response) {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  const { action, entityType, entityId, previousState, newState } = req.body;
  let pId = req.body.projectId || (req.params.projectId && req.params.projectId !== "audit-logs" ? req.params.projectId : null);
  const desc = req.body.description || req.body.details?.description || `${action || ""} ${entityType || ""}`.trim() || "Activity";

  if (!action || !entityType) {
    throw new AppError("action and entityType are required.", 400, "VALIDATION_ERROR");
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
  const requestedProjectId =
    req.params.projectId && req.params.projectId !== "audit-logs"
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
      throw new AppError("Audit log entry not found.", 404, "AUDIT_LOG_NOT_FOUND");
    }

    if (organizationId && targetLog.organizationId !== organizationId) {
      throw new AppError("Access denied.", 403, "FORBIDDEN");
    }

    if (requestedProjectId && targetLog.projectId && targetLog.projectId !== requestedProjectId) {
      throw new AppError("Audit log does not belong to specified project.", 403, "FORBIDDEN");
    }

    if (targetLog.isUndone) {
      throw new AppError("This action has already been undone.", 400, "ALREADY_UNDONE");
    }

    if (
      !targetLog.previousState ||
      targetLog.action.toLowerCase() === "undone" ||
      targetLog.action.toLowerCase() === "deleted"
    ) {
      throw new AppError("This action cannot be undone.", 400, "ACTION_NOT_REVERSIBLE");
    }

    let restoredTask: any = null;

    if (targetLog.entityType === "task") {
      const workItemRepo = manager.getRepository(WorkItem);
      const workItem = await workItemRepo.findOne({
        where: { id: targetLog.entityId },
      });

      if (!workItem) {
        throw new AppError("Target work item no longer exists.", 404, "WORK_ITEM_NOT_FOUND");
      }

      if (organizationId && workItem.organizationId !== organizationId) {
        throw new AppError("Access denied to work item.", 403, "FORBIDDEN");
      }

      const prev = targetLog.previousState;

      if (prev.title !== undefined && prev.title !== null) {
        workItem.title = String(prev.title).trim();
      }
      if (prev.description !== undefined) {
        workItem.description = prev.description ? String(prev.description).trim() : null;
      }
      if (prev.status !== undefined && prev.status !== null) {
        const normStatus = String(prev.status).toUpperCase().replace(/[-\s]/g, "_");
        if (Object.values(WorkItemStatus).includes(normStatus as WorkItemStatus)) {
          workItem.status = normStatus as WorkItemStatus;
        }
      }
      if (prev.priority !== undefined && prev.priority !== null) {
        const normPriority = String(prev.priority).toUpperCase();
        if (Object.values(WorkItemPriority).includes(normPriority as WorkItemPriority)) {
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
        workItem.parentWorkItemId = prev.parentWorkItemId || prev.parentId || null;
      }

      await workItemRepo.save(workItem);

      if (prev.assigneeId !== undefined || prev.assignees !== undefined || prev.assigneeIds !== undefined) {
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
            })
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
      })
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

// ==========================================
// Notifications
// ==========================================

export async function getUserNotifications(req: Request, res: Response) {
  const userId = req.user?.id;

  const notifs = await AppDataSource.getRepository(Notification).find({
    where: { userId: userId! },
    order: { createdAt: "DESC" },
    take: 50,
  });

  return res.json({
    success: true,
    data: notifs.map((n) => ({
      id: n.id,
      userId: n.userId,
      title: n.title,
      message: n.message,
      read: n.read,
      link: n.link,
      createdAt: n.createdAt,
    })),
  });
}

export async function markNotificationRead(req: Request, res: Response) {
  const id = String(req.params.id);
  const userId = req.user?.id;

  await AppDataSource.getRepository(Notification).update(
    { id, userId: userId! },
    { read: true },
  );

  return res.json({ success: true });
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  const userId = req.user?.id;

  await AppDataSource.getRepository(Notification).update(
    { userId: userId! },
    { read: true },
  );

  return res.json({ success: true });
}

export async function createNotification(req: Request, res: Response) {
  const organizationId = req.user?.organizationId;
  const { userId, title, message, link } = req.body;

  if (!title || !message) {
    throw new AppError("title and message are required.", 400, "VALIDATION_ERROR");
  }

  const repo = AppDataSource.getRepository(Notification);
  const notif = await repo.save(
    repo.create({
      userId: userId ? String(userId) : req.user!.id,
      organizationId: organizationId!,
      title: String(title).trim(),
      message: String(message).trim(),
      link: link ? String(link).trim() : null,
      read: false,
    }),
  );

  return res.status(201).json({
    success: true,
    data: notif,
  });
}
