import { In } from "typeorm";
import { Request, Response } from "express";
import { AppDataSource } from "../config/data.source";
import { AuditLog } from "../entities/audit.log.entity";
import { ProjectMember } from "../entities/project.member.entity";
import { Project } from "../entities/project.entity";
import { User, UserRole } from "../entities/user.entity";
import {
  WorkItem,
  WorkItemPriority,
  WorkItemStatus,
  WorkItemType,
} from "../entities/work.item.entity";
import { WorkItemAssignee } from "../entities/work.item-assignee.entity";
import { Sprint } from "../entities/sprint.entities";
import { ProjectLabel } from "../entities/project.label.entity";
import { AppError } from "../errors/app.error";
import { hasProjectPermission } from "../middleware/project.permission";
import { validateAssignees } from "../services/work-item.service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RestoredTask = WorkItem & {
  assignments: WorkItemAssignee[];
  assigneeIds: string[];
  assigneeId: string | null;
};

function snapshotString(value: unknown, field: string): string;
function snapshotString(
  value: unknown,
  field: string,
  nullable: true,
): string | null;
function snapshotString(
  value: unknown,
  field: string,
  nullable = false,
): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string") {
    throw new AppError(
      `The stored ${field} value is invalid.`,
      400,
      "ACTION_NOT_REVERSIBLE",
    );
  }
  return value;
}

function snapshotEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  field: string,
): T {
  const normalized =
    typeof value === "string"
      ? value.toUpperCase().replace(/[-\s]/g, "_")
      : "";
  const match = values.find((candidate) => candidate === normalized);
  if (!match) {
    throw new AppError(
      `The stored ${field} value is invalid.`,
      400,
      "ACTION_NOT_REVERSIBLE",
    );
  }
  return match;
}

/**
 * Validates that the user has access to read the project's audit logs.
 */
async function assertAuditProjectAccess(
  projectId: string,
  userId: string,
  organizationId: string,
  role?: string,
): Promise<Project> {
  const project = await AppDataSource.getRepository(Project).findOne({
    where: { id: projectId, organizationId },
  });

  if (!project) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  if (role === UserRole.ADMIN) {
    return project;
  }

  const membership = await AppDataSource.getRepository(ProjectMember).findOne({
    where: { projectId, userId },
  });

  if (!membership && project.visibility !== "PUBLIC") {
    throw new AppError(
      "You do not have access to this project's audit logs.",
      403,
      "FORBIDDEN",
    );
  }

  return project;
}

export async function createAuditLog() {
  throw new AppError(
    "Audit entries must be created by server-side operations.",
    403,
    "FORBIDDEN",
  );
}

export async function undoAuditLog(req: Request, res: Response) {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;
  const logId = String(req.params.logId);
  const requestedProjectId =
    req.params.projectId && req.params.projectId !== "audit-logs"
      ? String(req.params.projectId)
      : null;

  if (!userId || !organizationId) {
    throw new AppError(
      "Authentication and organization context required.",
      401,
      "UNAUTHORIZED",
    );
  }
  if (!UUID_PATTERN.test(logId)) {
    throw new AppError("Audit log ID must be a UUID.", 400, "VALIDATION_ERROR");
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

    if (targetLog.organizationId !== organizationId) {
      throw new AppError("Access denied.", 403, "FORBIDDEN");
    }

    if (!targetLog.trustedForUndo) {
      throw new AppError(
        "This audit entry was not created by a trusted server mutation.",
        400,
        "ACTION_NOT_REVERSIBLE",
      );
    }

    if (targetLog.entityType !== "task" || !targetLog.projectId) {
      throw new AppError(
        "This audit entry has no verifiable task project and cannot be undone.",
        400,
        "ACTION_NOT_REVERSIBLE",
      );
    }
    if (!UUID_PATTERN.test(targetLog.entityId)) {
      throw new AppError(
        "This audit entry has an invalid task identifier.",
        400,
        "ACTION_NOT_REVERSIBLE",
      );
    }

    const workItemRepo = manager.getRepository(WorkItem);
    const workItem = await workItemRepo
      .createQueryBuilder("workItem")
      .setLock("pessimistic_write")
      .where("workItem.id = :workItemId", { workItemId: targetLog.entityId })
      .andWhere("workItem.organization_id = :organizationId", {
        organizationId,
      })
      .getOne();

    if (!workItem) {
      throw new AppError(
        "Target work item no longer exists.",
        404,
        "WORK_ITEM_NOT_FOUND",
      );
    }

    if (
      workItem.projectId !== targetLog.projectId ||
      (requestedProjectId && requestedProjectId !== workItem.projectId)
    ) {
      throw new AppError(
        "Audit entry does not match the target work item's project.",
        403,
        "FORBIDDEN",
      );
    }

    const project = await manager.getRepository(Project).findOne({
      where: { id: workItem.projectId, organizationId },
      select: { id: true },
    });
    if (!project) {
      throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }

    if (req.user?.role !== UserRole.ADMIN) {
      const membership = await manager.getRepository(ProjectMember).findOne({
        where: { projectId: workItem.projectId, userId },
      });
      if (
        !membership ||
        !hasProjectPermission(membership.role, "task:update")
      ) {
        throw new AppError(
          "You do not have permission to undo task changes in this project.",
          403,
          "FORBIDDEN",
        );
      }
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
      typeof targetLog.previousState !== "object" ||
      Array.isArray(targetLog.previousState) ||
      targetLog.action.toLowerCase() === "undone" ||
      targetLog.action.toLowerCase() === "deleted"
    ) {
      throw new AppError(
        "This action cannot be undone.",
        400,
        "ACTION_NOT_REVERSIBLE",
      );
    }

    let restoredTask: RestoredTask | null = null;

    if (targetLog.entityType === "task") {
      const prev: Record<string, unknown> = targetLog.previousState;

      workItem.title = snapshotString(prev.title, "title").trim();
      const description = snapshotString(
        prev.description,
        "description",
        true,
      );
      workItem.description = description?.trim() || null;
      workItem.status = snapshotEnum(
        prev.status,
        Object.values(WorkItemStatus),
        "status",
      );
      workItem.type = snapshotEnum(
        prev.type,
        Object.values(WorkItemType),
        "type",
      );
      workItem.priority =
        prev.priority === null
          ? null
          : snapshotEnum(
              prev.priority,
              Object.values(WorkItemPriority),
              "priority",
            );

      const dueDate = snapshotString(prev.dueDate, "due date", true);
      if (dueDate === null) {
        workItem.dueDate = null;
      } else {
        const parsedDueDate = new Date(dueDate);
        if (Number.isNaN(parsedDueDate.getTime())) {
          throw new AppError(
            "The stored due date is invalid.",
            400,
            "ACTION_NOT_REVERSIBLE",
          );
        }
        workItem.dueDate = parsedDueDate;
      }

      const parentWorkItemId = snapshotString(
        prev.parentWorkItemId,
        "parent work item ID",
        true,
      );
      if (parentWorkItemId === workItem.id) {
        throw new AppError(
          "The stored parent work item is invalid.",
          400,
          "ACTION_NOT_REVERSIBLE",
        );
      }
      if (parentWorkItemId) {
        const parent = await manager.getRepository(WorkItem).findOne({
          where: {
            id: parentWorkItemId,
            projectId: workItem.projectId,
            organizationId,
          },
          select: { id: true },
        });
        if (!parent) {
          throw new AppError(
            "The stored parent work item is unavailable.",
            400,
            "ACTION_NOT_REVERSIBLE",
          );
        }
      }
      workItem.parentWorkItemId = parentWorkItemId;

      const sprintId = snapshotString(prev.sprintId, "sprint ID", true);
      if (sprintId) {
        const sprint = await manager.getRepository(Sprint).findOne({
          where: { id: sprintId, projectId: workItem.projectId },
          select: { id: true },
        });
        if (!sprint) {
          throw new AppError(
            "The stored sprint is unavailable.",
            400,
            "ACTION_NOT_REVERSIBLE",
          );
        }
      }
      workItem.sprintId = sprintId;

      const labelId = snapshotString(prev.labelId, "label ID", true);
      if (labelId) {
        const label = await manager.getRepository(ProjectLabel).findOne({
          where: { id: labelId, projectId: workItem.projectId },
          select: { id: true },
        });
        if (!label) {
          throw new AppError(
            "The stored label is unavailable.",
            400,
            "ACTION_NOT_REVERSIBLE",
          );
        }
      }
      workItem.labelId = labelId;

      await workItemRepo.save(workItem);

      if (
        !Array.isArray(prev.assigneeIds) ||
        !prev.assigneeIds.every(
          (assigneeId): assigneeId is string =>
            typeof assigneeId === "string" &&
            UUID_PATTERN.test(assigneeId),
        )
      ) {
        throw new AppError(
          "The stored assignee list is invalid.",
          400,
          "ACTION_NOT_REVERSIBLE",
        );
      }

      const userIds = prev.assigneeIds;
      await validateAssignees(
        userIds.map((assigneeId) => ({ userId: assigneeId })),
        workItem.projectId,
        organizationId,
        manager,
      );
      const assigneeRepo = manager.getRepository(WorkItemAssignee);
      await assigneeRepo.delete({ workItemId: workItem.id });

      if (userIds.length > 0) {
        const assigneeEntities = userIds.map((assigneeId) =>
          assigneeRepo.create({
            workItemId: workItem.id,
            userId: assigneeId,
            assignedById: userId,
          }),
        );
        await assigneeRepo.save(assigneeEntities);
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

export async function getProjectAuditLogs(req: Request, res: Response) {
  const projectId = req.params.projectId
    ? String(req.params.projectId)
    : undefined;
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;

  if (!organizationId || !userId) {
    throw new AppError(
      "Authentication and organization context required.",
      401,
      "UNAUTHORIZED",
    );
  }

  // Parse pagination params
  const page = Math.max(
    1,
    Number.parseInt(String(req.query.page ?? "1"), 10) || 1,
  );
  const limit = Math.min(
    150,
    Math.max(1, Number.parseInt(String(req.query.limit ?? "50"), 10) || 50),
  );
  const skip = (page - 1) * limit;

  // If projectId is supplied, verify access
  let projectTaskIds: string[] = [];
  if (projectId) {
    await assertAuditProjectAccess(
      projectId,
      userId,
      organizationId,
      req.user?.role,
    );

    try {
      const projectTasks = await AppDataSource.getRepository(WorkItem).find({
        where: { projectId, organizationId },
        select: { id: true, title: true },
      });
      projectTaskIds = projectTasks.map((t) => t.id);
    } catch {
      // Gracefully continue
    }
  }

  const auditRepo = AppDataSource.getRepository(AuditLog);
  const qb = auditRepo
    .createQueryBuilder("audit")
    .leftJoinAndSelect("audit.user", "user")
    .leftJoinAndSelect("audit.project", "project")
    .where("audit.organizationId = :organizationId", { organizationId })
    .orderBy("audit.createdAt", "DESC")
    .addOrderBy("audit.id", "DESC");

  if (projectId) {
    if (projectTaskIds.length > 0) {
      qb.andWhere(
        "(audit.projectId = :projectId OR (audit.entityType = 'task' AND audit.entityId IN (:...projectTaskIds)))",
        { projectId, projectTaskIds },
      );
    } else {
      qb.andWhere("audit.projectId = :projectId", { projectId });
    }
  }

  const total = await qb.getCount();
  const logs = await qb.skip(skip).take(limit).getMany();

  const taskIds = logs
    .filter((l) => l.entityType === "task" && l.entityId)
    .map((l) => l.entityId);

  const taskMap: Record<string, string> = {};
  if (taskIds.length > 0) {
    try {
      const foundTasks = await AppDataSource.getRepository(WorkItem).find({
        where: { id: In(taskIds), organizationId },
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
        Boolean(l.trustedForUndo) &&
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
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getMyAuditLogs(req: Request, res: Response) {
  const userId = req.user?.id;
  const organizationId = req.user?.organizationId;

  if (!userId || !organizationId) {
    throw new AppError(
      "Authentication and organization context required.",
      401,
      "UNAUTHORIZED",
    );
  }

  const page = Math.max(
    1,
    Number.parseInt(String(req.query.page ?? "1"), 10) || 1,
  );
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20),
  );

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

  const auditRepo = AppDataSource.getRepository(AuditLog);
  const qb = auditRepo
    .createQueryBuilder("audit")
    .leftJoinAndSelect("audit.project", "project")
    .leftJoinAndSelect("audit.user", "actor")
    .where("audit.organizationId = :organizationId", { organizationId })
    .andWhere("audit.userId = :userId", { userId })
    .andWhere("audit.projectId IN (:...projectIds)", { projectIds })
    .orderBy("audit.createdAt", "DESC")
    .addOrderBy("audit.id", "DESC");

  const total = await qb.getCount();
  const logs = await qb
    .skip((page - 1) * limit)
    .take(limit)
    .getMany();

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
      .andWhere("task.organizationId = :organizationId", { organizationId })
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
}
