import { Request, Response } from "express";
import { AppDataSource } from "../config/data.source";
import { WorkItemComment } from "../entities/work.item.comment.entity";
import { WorkItemTimeEntry } from "../entities/work.item.time.entry.entity";
import { WorkItemDependency } from "../entities/work.item.dependency.entity";
import { WorkItem } from "../entities/work.item.entity";
import { ProjectMember } from "../entities/project.member.entity";
import { UserRole } from "../entities/user.entity";
import { AppError } from "../errors/app.error";
import {
  addWorkItemDependency as addWorkItemDependencyService,
  removeWorkItemDependency as removeWorkItemDependencyService,
} from "../services/work-item-dependency.service";
import {
  assertAccessibleProject,
  getActiveActor,
} from "../services/work-item.service";

/**
 * Validates that the work item exists, belongs to the user's organization,
 * and that the user is authorized to view/access the parent project.
 */
async function assertWorkItemAccess(
  workItemId: string,
  req: Request,
): Promise<WorkItem> {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;

  if (!userId || !organizationId) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }

  const workItem = await AppDataSource.getRepository(WorkItem).findOne({
    where: { id: workItemId },
    select: { id: true, projectId: true, organizationId: true },
  });

  if (!workItem || workItem.organizationId !== organizationId) {
    throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
  }

  // Organization admins have access to all projects in the org
  if (req.user?.role === UserRole.ADMIN) {
    return workItem;
  }

  // Verify membership in the project
  const membership = await AppDataSource.getRepository(ProjectMember).findOne({
    where: { projectId: workItem.projectId, userId },
  });

  if (!membership) {
    throw new AppError(
      "You do not have access to this work item's project.",
      403,
      "FORBIDDEN",
    );
  }

  return workItem;
}

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

  await assertWorkItemAccess(workItemId, req);

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

  await assertWorkItemAccess(workItemId, req);

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
  const durationMinutes =
    req.body.durationMinutes !== undefined
      ? Number(req.body.durationMinutes)
      : req.body.hours !== undefined
        ? Math.round(Number(req.body.hours) * 60)
        : 0;
  const description = req.body.description || req.body.note || "";
  const startTime = req.body.startTime || req.body.date;
  const userId = req.user?.id;

  const duration = Number(durationMinutes);
  if (
    !Number.isSafeInteger(duration) ||
    duration <= 0 ||
    duration > 2_147_483_647
  ) {
    throw new AppError(
      "Duration must be a positive whole number of minutes within the supported range.",
      400,
      "VALIDATION_ERROR",
    );
  }

  await assertWorkItemAccess(workItemId, req);

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

  await assertWorkItemAccess(workItemId, req);

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
    throw new AppError(
      "dependsOnWorkItemId is required.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }
  const actor = await getActiveActor(userId);
  const result = await addWorkItemDependencyService(
    actor,
    workItemId,
    dependsOnWorkItemId,
    req.body.version,
  );

  return res.status(201).json({
    success: true,
    data: result.dependency,
    dependencies: result.dependencies,
    rescheduledTasks: result.rescheduledTasks,
    workItem: result.workItem,
  });
}

export async function getWorkItemDependencies(req: Request, res: Response) {
  const workItemId = String(req.params.workItemId);
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }
  const actor = await getActiveActor(userId);
  const workItem = await AppDataSource.getRepository(WorkItem).findOne({
    where: { id: workItemId, organizationId: actor.organizationId },
    select: { id: true, projectId: true },
  });
  if (!workItem) {
    throw new AppError("Work item not found.", 404, "WORK_ITEM_NOT_FOUND");
  }
  await assertAccessibleProject(workItem.projectId, actor);

  const deps = await AppDataSource.getRepository(WorkItemDependency).find({
    where: { workItemId },
    order: { id: "ASC" },
  });

  return res.json({
    success: true,
    data: deps.map((d) => d.dependsOnWorkItemId),
    dependencies: deps,
  });
}

export async function deleteWorkItemDependency(req: Request, res: Response) {
  const workItemId = String(req.params.workItemId);
  const depId = String(req.params.depId);
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }
  const actor = await getActiveActor(userId);
  const result = await removeWorkItemDependencyService(
    actor,
    workItemId,
    depId,
    req.body.version,
  );
  return res.json({
    success: true,
    data: result.dependency,
    dependencies: result.dependencies,
    rescheduledTasks: result.rescheduledTasks,
    workItem: result.workItem,
  });
}
