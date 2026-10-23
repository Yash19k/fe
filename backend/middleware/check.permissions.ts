
import { Request, Response, NextFunction } from "express";

import { User } from "../entities/user.entity";
import { AppDataSource } from "../config/data.source";

export type Role = "ADMIN" | "MANAGER" | "TEAMMATE";

export type Permission =
  | "user:manage"
  | "role:manage"
  | "project:create"
  | "project:read:all"
  | "project:read"
  | "project:update"
  | "project:delete"
  | "project:member:manage"
  | "task:create"
  | "task:read"
  | "task:update"
  | "task:delete"
  | "task:assign"
  | "task:comment";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "user:manage",
    "role:manage",
    "project:create",
    "project:read:all",
    "project:read",
    "project:update",
    "project:delete",
    "project:member:manage",
    "task:create",
    "task:read",
    "task:update",
    "task:delete",
    "task:assign",
    "task:comment",
  ],

  MANAGER: [
    "project:create",
    "project:read",
    "project:update",
    "project:member:manage",
    "task:create",
    "task:read",
    "task:update",
    "task:delete",
    "task:assign",
    "task:comment",
  ],

  TEAMMATE: [
    "project:read",
    "task:read",
    "task:update",
    "task:comment",
  ],
};

export const checkPermission = (permission: Permission) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOne({
      where: {
        id: req.user.id,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found. Please log in again.",
      });
      return;
    }

    const role = user.role as Role;

   if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role)) {
      res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
      return;
    }

    if (!ROLE_PERMISSIONS[role].includes(permission)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
      return;
    }

    next();
  };
};
