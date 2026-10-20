import { Request, Response } from "express";
import { AppDataSource } from "../config/data.source";
import { WorkItemComment } from "../entities/work.item.comment.entity";
import { WorkItemTimeEntry } from "../entities/work.item.time.entry.entity";
import { ProjectLabel } from "../entities/project.label.entity";
import { WorkItemDependency } from "../entities/work.item.dependency.entity";
import { ProjectWorkflow } from "../entities/project.workflow.entity";
import { AuditLog } from "../entities/audit.log.entity";
import { Notification } from "../entities/notification.entity";
import { WorkItem } from "../entities/work.item.entity";
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

  if (!workItem) {
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

export async function getProjectWorkflow(req: Request, res: Response) {
  const projectId = String(req.params.projectId);

  const workflow = await AppDataSource.getRepository(ProjectWorkflow).findOne({
    where: { projectId },
  });

  return res.json({
    success: true,
    data: workflow
      ? {
          ...workflow,
          stages: workflow.statuses,
        }
      : null,
  });
}

export async function saveProjectWorkflow(req: Request, res: Response) {
  const projectId = String(req.params.projectId);
  const stages = req.body.stages || req.body.statuses;
  const name = req.body.name ? String(req.body.name).trim() : "Custom Engineering Flow";

  if (!stages || !Array.isArray(stages)) {
    throw new AppError(
      "Workflow stages or statuses array is required.",
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

  const logs = await AppDataSource.getRepository(AuditLog).find({
    where: projectId ? { projectId, organizationId } : { organizationId },
    relations: { user: true },
    order: { createdAt: "DESC" },
    take: 100,
  });

  return res.json({
    success: true,
    data: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      description: l.description,
      previousState: l.previousState,
      newState: l.newState,
      projectId: l.projectId,
      userId: l.userId,
      userName: l.user?.fullName || l.user?.email || "User",
      timestamp: l.createdAt,
    })),
  });
}

export async function createAuditLog(req: Request, res: Response) {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  const { action, entityType, entityId, previousState, newState } = req.body;
  const pId = req.body.projectId || (req.params.projectId && req.params.projectId !== "audit-logs" ? req.params.projectId : null);
  const desc = req.body.description || req.body.details?.description || `${action || ""} ${entityType || ""}`.trim() || "Activity";

  if (!action || !entityType) {
    throw new AppError("action and entityType are required.", 400, "VALIDATION_ERROR");
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
    data: log,
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
