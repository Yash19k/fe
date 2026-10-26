
import { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../config/data.source";
import { Project } from "../entities/project.entity";
import { User, UserRole } from "../entities/user.entity";
import { WorkItem } from "../entities/work.item.entity";
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

export const authorizeProjectPermission = async (
  req: Request,
  action: ProjectAction,
): Promise<void> => {
    const userId = req.user?.id;
    let projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;

    if (!projectId && req.body && req.body.projectId) {
      projectId = req.body.projectId;
    }

    if (!projectId && req.query && typeof req.query.projectId === 'string') {
      projectId = req.query.projectId;
    }

    if (!projectId && req.params.workItemId) {
      const workItem = await AppDataSource.getRepository(WorkItem).findOne({
        where: { id: String(req.params.workItemId) },
        select: { projectId: true },
      });
      if (!workItem) {
        throw new AppError(
          "Work item not found.",
          404,
          "WORK_ITEM_NOT_FOUND",
        );
      }
      projectId = workItem.projectId;
    }

    if (!userId) {
      throw new AppError(
        "Authentication required.",
        401,
        "UNAUTHORIZED",
      );
    }

    if (!projectId) {
      throw new AppError(
        "Project ID is required.",
        400,
        "PROJECT_ID_REQUIRED",
      );
    }

    const userRepo = AppDataSource.getRepository(User);

    const user = await userRepo.findOne({
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

    if (!user.organizationId) {
      throw new AppError(
        "User is not associated with an organization.",
        403,
        "ORGANIZATION_NOT_FOUND",
      );
    }

    const project = await AppDataSource.getRepository(Project).findOne({
      where: {
        id: projectId,
        organizationId: user.organizationId,
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
          userId: user.id,
        },
      });

    // Organization ADMINs have full management over projects in their organization
    if (user.role === UserRole.ADMIN) {
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
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await authorizeProjectPermission(req, action);
      next();
    } catch (error) {
      next(error);
    }
  };
};
