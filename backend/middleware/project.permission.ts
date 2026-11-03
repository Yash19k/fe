
import { Request, Response, NextFunction } from "express";
import { EntityManager } from "typeorm";
import { AppDataSource } from "../config/data.source";
import { Project } from "../entities/project.entity";
import { User, UserRole } from "../entities/user.entity";
import { WorkItem } from "../entities/work.item.entity";
import { WorkItemAttachment } from "../entities/work.item.attachment.entity";
import { WorkItemDependency } from "../entities/work.item.dependency.entity";
import { Whiteboard } from "../entities/whiteboard.entity";
import { AuditLog } from "../entities/audit.log.entity";
import { Sprint } from "../entities/sprint.entities";
import {
  ProjectMember,
  ProjectRole,
} from "../entities/project.member.entity";
import { AppError } from "../errors/app.error";

export type ProjectAction =
  | "project:view"
  | "project:update"
  | "project:delete"
  | "member:add"
  | "member:remove"
  | "member:role:update"
  | "task:create"
  | "task:read"
  | "task:assign"
  | "task:update"
  | "task:escalate"
  | "task:delete"
  | "sla:view"
  | "sla:manage"
  | "sla:resolve"
  | "sla:audit"
  | "sprint:view"
  | "sprint:create"
  | "sprint:update"
  | "sprint:delete";

const permissions: Record<ProjectRole, ProjectAction[]> = {
  [ProjectRole.ADMIN]: [
    "project:view",
    "project:update",
    "project:delete",
    "member:add",
    "member:remove",
    "member:role:update",
    "task:create",
    "task:read",
    "task:assign",
    "task:update",
    "task:escalate",
    "task:delete",
    "sla:view",
    "sla:manage",
    "sla:resolve",
    "sla:audit",
    "sprint:view",
    "sprint:create",
    "sprint:update",
    "sprint:delete",
  ],

  [ProjectRole.LEAD]: [
    "project:view",
    "project:update",
    "member:add",
    "member:role:update",
    "task:create",
    "task:read",
    "task:assign",
    "task:update",
    "task:escalate",
    "task:delete",
    "sla:view",
    "sla:manage",
    "sla:resolve",
    "sla:audit",
    "sprint:view",
    "sprint:create",
    "sprint:update",
    "sprint:delete",
  ],

  [ProjectRole.MEMBER]: [
    "project:view",
    "task:create",
    "task:read",
    "task:assign",
    "task:update",
    "sla:view",
    "sprint:view",
  ],
};

export const hasProjectPermission = (
  role: ProjectRole,
  action: ProjectAction,
): boolean => permissions[role]?.includes(action) ?? false;

export interface ProjectPermissionActor {
  id: string;
  organizationId?: string | null;
}

export const getProjectMembership = (
  projectId: string,
  userId: string,
  manager?: EntityManager,
): Promise<ProjectMember | null> => {
  const repository = manager
    ? manager.getRepository(ProjectMember)
    : AppDataSource.getRepository(ProjectMember);
  return repository.findOne({ where: { projectId, userId } });
};

const normalizeProjectId = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeProjectId(entry);
      if (normalized) {
        return normalized;
      }
    }
  }

  return undefined;
};

const getRequestedProjectId = (req: Request): string | undefined => {
  const candidateIds = [
    req.params?.projectId,
    req.body?.projectId,
    req.query?.projectId,
    req.body?.project_id,
    req.query?.project_id,
  ];

  for (const candidate of candidateIds) {
    const normalized = normalizeProjectId(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
};

const resolveProjectIdFromWorkItem = async (
  workItemId: string,
): Promise<string> => {
  const workItem = await AppDataSource.getRepository(WorkItem).findOne({
    where: { id: workItemId },
    select: { projectId: true },
  });

  if (!workItem) {
    throw new AppError(
      "Work item not found.",
      404,
      "WORK_ITEM_NOT_FOUND",
    );
  }

  return workItem.projectId;
};

const resolveProjectIdFromAttachment = async (
  attachmentId: string,
): Promise<string> => {
  const attachment = await AppDataSource.getRepository(WorkItemAttachment).findOne({
    where: { id: attachmentId },
    select: { workItemId: true },
  });

  if (!attachment) {
    throw new AppError(
      "Attachment not found.",
      404,
      "ATTACHMENT_NOT_FOUND",
    );
  }

  return resolveProjectIdFromWorkItem(attachment.workItemId);
};

const resolveProjectIdFromDependency = async (
  dependencyId: string,
): Promise<string> => {
  const dependency = await AppDataSource.getRepository(WorkItemDependency).findOne({
    where: { id: dependencyId },
    select: { workItemId: true },
  });

  if (!dependency) {
    throw new AppError(
      "Dependency not found.",
      404,
      "DEPENDENCY_NOT_FOUND",
    );
  }

  return resolveProjectIdFromWorkItem(dependency.workItemId);
};

const resolveProjectIdFromRequest = async (
  req: Request,
): Promise<string | undefined> => {
  if (req.params?.workItemId) {
    return resolveProjectIdFromWorkItem(String(req.params.workItemId));
  }

  if (req.params?.attachmentId) {
    return resolveProjectIdFromAttachment(String(req.params.attachmentId));
  }

  if (req.params?.depId) {
    return resolveProjectIdFromDependency(String(req.params.depId));
  }

  if (req.params?.whiteboardId) {
    const whiteboard = await AppDataSource.getRepository(Whiteboard).findOne({
      where: { id: String(req.params.whiteboardId) },
      select: { projectId: true },
    });
    if (!whiteboard) {
      throw new AppError(
        "Whiteboard not found.",
        404,
        "WHITEBOARD_NOT_FOUND",
      );
    }
    return whiteboard.projectId;
  }

  if (req.params?.logId) {
    const auditLog = await AppDataSource.getRepository(AuditLog).findOne({
      where: { id: String(req.params.logId) },
      select: { projectId: true },
    });
    if (!auditLog?.projectId) {
      throw new AppError(
        "Audit log not found.",
        404,
        "AUDIT_LOG_NOT_FOUND",
      );
    }
    return auditLog.projectId;
  }

  if (req.params?.sprintId) {
    const sprint = await AppDataSource.getRepository(Sprint).findOne({
      where: { id: String(req.params.sprintId) },
      select: { projectId: true },
    });
    if (!sprint) {
      throw new AppError("Sprint not found.", 404, "SPRINT_NOT_FOUND");
    }
    return sprint.projectId;
  }

  return getRequestedProjectId(req);
};

export const authorizeWorkItemCreationForActor = async (
  actor: ProjectPermissionActor,
  projectId: string,
  manager?: EntityManager,
): Promise<Project> => {
  const userRepository = manager
    ? manager.getRepository(User)
    : AppDataSource.getRepository(User);
  let organizationId = actor.organizationId ?? undefined;

  if (!organizationId) {
    const user = await userRepository.findOne({
      where: { id: actor.id },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!user) {
      throw new AppError(
        "Authenticated user not found.",
        401,
        "USER_NOT_FOUND",
      );
    }

    organizationId = user.organizationId ?? undefined;
  }

  if (!organizationId) {
    throw new AppError(
      "User is not associated with an organization.",
      403,
      "ORGANIZATION_NOT_FOUND",
    );
  }

  const projectRepository = manager
    ? manager.getRepository(Project)
    : AppDataSource.getRepository(Project);
  const project = await projectRepository.findOne({
    where: { id: projectId, organizationId },
    select: { id: true, organizationId: true },
  });

  if (!project) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }

  const membership = await getProjectMembership(project.id, actor.id, manager);

  if (!membership) {
    throw new AppError(
      "You are not a member of this project.",
      403,
      "PROJECT_MEMBERSHIP_REQUIRED",
    );
  }

  if (!hasProjectPermission(membership.role, "task:create")) {
    throw new AppError(
      "You do not have permission to perform this action.",
      403,
      "PROJECT_PERMISSION_DENIED",
    );
  }

  return project;
};

export const authorizeProjectPermission = async (
  req: Request,
  action: ProjectAction,
): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AppError(
      "Authentication required.",
      401,
      "UNAUTHORIZED",
    );
  }

  const projectId = await resolveProjectIdFromRequest(req);

  if (!projectId) {
    throw new AppError(
      "Project ID is required.",
      400,
      "PROJECT_ID_REQUIRED",
    );
  }

  if (action === "task:create") {
    await authorizeWorkItemCreationForActor(
      {
        id: userId,
        organizationId: req.user?.organizationId,
      },
      projectId,
    );
    return;
  }

  let userRole = req.user?.role;
  let organizationId = req.user?.organizationId;

  if (!userRole || !organizationId) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: {
        id: true,
        organizationId: true,
        role: true,
      },
    });

    if (!user) {
      throw new AppError(
        "Authenticated user not found.",
        401,
        "USER_NOT_FOUND",
      );
    }

    userRole = user.role;
    organizationId = user.organizationId ?? undefined;
  }

  if (!organizationId) {
    throw new AppError(
      "User is not associated with an organization.",
      403,
      "ORGANIZATION_NOT_FOUND",
    );
  }

  const project = await AppDataSource.getRepository(Project).findOne({
    where: {
      id: projectId,
      organizationId,
    },
    select: {
      id: true,
      organizationId: true,
      visibility: true,
    },
  });

  if (!project) {
    throw new AppError(
      "Project not found.",
      404,
      "PROJECT_NOT_FOUND",
    );
  }

  const membership = await AppDataSource
    .getRepository(ProjectMember)
    .findOne({
      where: {
        projectId: project.id,
        userId,
      },
    });

  // Organization ADMINs have full management over projects in their organization
  if (userRole === UserRole.ADMIN) {
    return;
  }

  // Public projects may be viewed without membership.
  if (
    (action === "project:view" || action === "task:read") &&
    project.visibility === "PUBLIC" &&
    !membership
  ) {
    return;
  }

  if (!membership) {
    throw new AppError(
      "You are not a member of this project.",
      403,
      "PROJECT_MEMBERSHIP_REQUIRED",
    );
  }

  if (!hasProjectPermission(membership.role, action)) {
    throw new AppError(
      "You do not have permission to perform this action.",
      403,
      "PROJECT_PERMISSION_DENIED",
    );
  }

  // Only project ADMIN can promote someone to project ADMIN.
  if (
    action === "member:role:update" &&
    req.body?.role === ProjectRole.ADMIN &&
    membership.role !== ProjectRole.ADMIN
  ) {
    throw new AppError(
      "Only a project administrator can assign the administrator role.",
      403,
      "PROJECT_ADMIN_REQUIRED",
    );
  }

  return;
};

export const requireProjectPermission = (action: ProjectAction) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    authorizeProjectPermission(req, action).then(() => next(), next);
  };
};
