
import { Request, Response, NextFunction } from "express";

import { User, UserRole } from "../entities/user.entity";
import { AppDataSource } from "../config/data.source";
import { AppError } from "../errors/app.error";

export type Role = UserRole;

export type Permission =
  | "user:manage"
  | "role:manage"
  | "project:create"
  | "project:read:all"
  | "project:read"
  | "sla:manage";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [UserRole.ADMIN]: [
    "user:manage",
    "role:manage",
    "project:create",
    "project:read:all",
    "project:read",
    "sla:manage",
  ],

  [UserRole.MANAGER]: [
    "project:create",
    "project:read",
  ],

  [UserRole.TEAMMATE]: [
    "project:read",
  ],
};

const isRole = (role: string): role is Role =>
  Object.values(UserRole).some((validRole) => validRole === role);

export const hasOrganizationPermission = (
  role: string | undefined,
  permission: Permission,
): boolean =>
  role !== undefined &&
  isRole(role) &&
  ROLE_PERMISSIONS[role].includes(permission);

export const checkPermission = (permission: Permission) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user?.id) {
      next(new AppError("Authentication required.", 401, "UNAUTHORIZED"));
      return;
    }

    let role: string | undefined = req.user.role;

    if (!role) {
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: req.user.id },
        select: { id: true, role: true },
      });

      if (!user) {
        next(new AppError(
          "User not found. Please log in again.",
          401,
          "USER_NOT_FOUND",
        ));
        return;
      }
      role = user.role;
    }

    if (!role || !isRole(role)) {
      next(new AppError("Invalid user role.", 403, "INVALID_ROLE"));
      return;
    }

    if (!hasOrganizationPermission(role, permission)) {
      next(new AppError(
        "You do not have permission to perform this action.",
        403,
        "PERMISSION_DENIED",
      ));
      return;
    }

    next();
  };
};
