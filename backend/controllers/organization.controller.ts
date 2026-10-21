import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import * as bcrypt from "bcrypt";
import { AppDataSource } from "../config/data.source";
import { User, UserRole, UserStatus } from "../entities/user.entity";
import { Organization } from "../entities/organization.entity";
import { ProjectMember } from "../entities/project.member.entity";
import { Project } from "../entities/project.entity";
import { onboardingSchema } from "../validations/user.validator";
import { generateAccessToken, generateRefreshToken } from "../utils/auth.token";
import Joi from "joi";
import { UserSession } from "../entities/user.session.entity";
import { AppError } from "../errors/app.error";

const invitedMemberSchema = Joi.array().items(
  Joi.object({
    email: Joi.string().email().required(),
    role: Joi.string()
      .valid(UserRole.ADMIN, UserRole.MANAGER, UserRole.TEAMMATE)
      .default(UserRole.TEAMMATE),
  })
);

const userRepository = AppDataSource.getRepository(User);

export interface InvitedMember {
  email: string;
  role: UserRole;
}

export interface RegisterOrganizationPayload {
  fullName: string;
  email: string;
  passwordHash: string;
  orgName: string;
  invitedMembers?: InvitedMember[];
}

export async function registerOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { error, value } = onboardingSchema.validate(req.body, {
    abortEarly: false, // return all errors, not just the first
    stripUnknown: true, // drop fields you didn't define
  });

  if (error) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      })),
    });
  }
  const { user, organization } = value;

  try {
    // hash before the transaction so the DB connection isn't held while hashing

    const passwordHash = await bcrypt.hash(user.password, 12);

    const result = await AppDataSource.transaction(async (m) => {
      // step 2 data: organization
      const Exiuser = await m.findOne(User, {
        where: { email: user.email },
      });
      if (Exiuser) {
        return null;
      }

      const org = await m.save(Organization, {
        name: organization.name,
      });

      // step 1 data: user, linked to the organization
      const newUser = await m.save(User, {
        organizationId: org.id,
        fullName: user.fullName,
        email: user.email.toLowerCase(),
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      });

      const { rawRefreshToken, tokenHash, refreshExpiry } =
        generateRefreshToken();

      const uses = await m.save(UserSession, {
        userId: newUser.id,
        tokenHash,
        expiresAt: refreshExpiry,
        revokedAt: null,
        lastUsedAt: null,
      });
      if (!uses) {
        return null;
      }
      return { org, newUser, rawRefreshToken, refreshExpiry };
    });

    if (!result) {
      return res.status(409).json({
        message: "email already in use",
        errors: [{ field: "user.email", message: "already in use" }],
      });
    }

    const { org, newUser, rawRefreshToken, refreshExpiry } = result;

    const accessToken = generateAccessToken({
      userId: newUser.id,
      organizationId: org.id,
      role: newUser.role,
    });

    res.cookie("refreshToken", rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/refresh",
      expires: refreshExpiry,
    });

    req.user = { id: newUser.id, email: newUser.email, role: newUser.role };

    return res.status(201).json({
      success: true,
      accessToken,
      data: {
        organizationId: org.id,
        userId: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
      },
    });
  } catch (err: any) {
    // Postgres unique violation: email already exists
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ message: "Email already in use" });
    }
    console.error(err);
    // return res.status(500).json({ message: "Something went wrong" });
    return next(err);
  }
}

// import { Request, Response, NextFunction } from "express";
import { QueryFailedError } from "typeorm";

type AuthenticatedUser = {
  id: string;
  email: string;
  organizationId?: string;
  role: UserRole;
};

export async function addOrganizationMembers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { error, value } = invitedMemberSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.details.map((detail: any) => ({
        field: detail.path.join("."),
        message: detail.message,
      })),
    });
  }

  const authUser = req.user as AuthenticatedUser | undefined;

  if (!authUser) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  if (authUser.role !== UserRole.ADMIN) {
    return res.status(403).json({
      message: "Only organization admins can add members",
    });
  }

  const organizationId = authUser.organizationId;
  if (!organizationId) {
    return res.status(403).json({
      message: "Admin must belong to an organization",
    });
  }

  const members: { email: string; role: UserRole }[] = value.map(
    (member: { email: string; role: UserRole }) => ({
      email: member.email.trim().toLowerCase(),
      role: member.role,
    }),
  );

  // Prevent duplicate emails that differ only by capitalization.
  const emails = members.map((member) => member.email);

  if (new Set(emails).size !== emails.length) {
    return res.status(400).json({
      message: "Duplicate email addresses are not allowed",
    });
  }

  try {
    const result = await AppDataSource.transaction(async (manager) => {
      const added: {
        userId: string;
        email: string;
        role: UserRole;
      }[] = [];

      const failed: {
        email: string;
        reason: string;
      }[] = [];

      for (const item of members) {
        const existingUser = await manager.findOne(User, {
          where: { email: item.email },
        });

        if (!existingUser) {
          failed.push({
            email: item.email,
            reason: "User does not exist",
          });
          continue;
        }

        if (existingUser.organizationId === authUser.organizationId) {
          failed.push({
            email: item.email,
            reason: "User already belongs to this organization",
          });
          continue;
        }

        if (existingUser.organizationId) {
          failed.push({
            email: item.email,
            reason: "User already belongs to another organization",
          });
          continue;
        }

        existingUser.organizationId = organizationId;
        existingUser.role = item.role;

        const savedUser = await manager.save(User, existingUser);

        added.push({
          userId: savedUser.id,
          email: savedUser.email,
          role: savedUser.role,
        });
      }

      return { added, failed };
    });

    return res.status(200).json({
      message: "Member processing completed",
      data: {
        added: result.added,
        failed: result.failed,
        totalAdded: result.added.length,
        totalFailed: result.failed.length,
      },
    });
  } catch (err: unknown) {
    if (err instanceof QueryFailedError) {
      const dbError = err.driverError as { code?: string };

      if (dbError.code === "23505") {
        return res.status(409).json({
          message: "A unique constraint was violated",
        });
      }
    }

    return next(err);
  }
}

export async function getOrganizationMembers(req: Request, res: Response) {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
  }

  const users = await userRepository.find({
    where: { organizationId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
    order: { fullName: "ASC" },
  });

  return res.json({
    success: true,
    data: users.map((u) => ({
      id: u.id,
      name: u.fullName || u.email.split("@")[0],
      email: u.email,
      role: u.role,
      status: u.status,
      initials: (u.fullName || u.email).slice(0, 2).toUpperCase(),
      createdAt: u.createdAt,
    })),
  });
}

export async function updateOrganizationMemberRole(req: Request, res: Response) {
  const authUser = req.user;
  if (!authUser || !authUser.organizationId) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }

  if (authUser.role !== UserRole.ADMIN) {
    throw new AppError("Only organization administrators can update member roles.", 403, "ADMIN_REQUIRED");
  }

  const targetUserId = String(req.params.userId);
  const { role: newRole } = req.body;

  if (!newRole || !Object.values(UserRole).includes(newRole as UserRole)) {
    throw new AppError(
      `Invalid role. Must be one of: ${Object.values(UserRole).join(", ")}`,
      400,
      "INVALID_ROLE"
    );
  }

  const targetUser = await userRepository.findOne({
    where: { id: targetUserId, organizationId: authUser.organizationId },
  });

  if (!targetUser) {
    throw new AppError("Member not found in this organization.", 404, "MEMBER_NOT_FOUND");
  }

  // Prevent demoting the last organization administrator
  if (targetUser.role === UserRole.ADMIN && newRole !== UserRole.ADMIN) {
    const adminCount = await userRepository.count({
      where: {
        organizationId: authUser.organizationId,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    if (adminCount <= 1) {
      throw new AppError(
        "Cannot demote the last organization administrator.",
        400,
        "LAST_ADMIN_PROTECTED"
      );
    }
  }

  targetUser.role = newRole as UserRole;
  const saved = await userRepository.save(targetUser);

  return res.json({
    success: true,
    message: `Member role updated to ${saved.role}.`,
    data: {
      id: saved.id,
      name: saved.fullName,
      email: saved.email,
      role: saved.role,
      status: saved.status,
    },
  });
}

export async function removeOrganizationMember(req: Request, res: Response) {
  const authUser = req.user;
  if (!authUser || !authUser.organizationId) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }

  if (authUser.role !== UserRole.ADMIN) {
    throw new AppError("Only organization administrators can remove members.", 403, "ADMIN_REQUIRED");
  }

  const targetUserId = String(req.params.userId);

  if (targetUserId === authUser.id) {
    throw new AppError("You cannot remove yourself from the organization.", 400, "CANNOT_REMOVE_SELF");
  }

  const targetUser = await userRepository.findOne({
    where: { id: targetUserId, organizationId: authUser.organizationId },
  });

  if (!targetUser) {
    throw new AppError("Member not found in this organization.", 404, "MEMBER_NOT_FOUND");
  }

  // Check last admin protection
  if (targetUser.role === UserRole.ADMIN) {
    const adminCount = await userRepository.count({
      where: {
        organizationId: authUser.organizationId,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    if (adminCount <= 1) {
      throw new AppError(
        "Cannot remove the last organization administrator.",
        400,
        "LAST_ADMIN_PROTECTED"
      );
    }
  }

  // Check organization owner protection
  const org = await AppDataSource.getRepository(Organization).findOne({
    where: { id: authUser.organizationId },
  });

  if (org && (org as any).createdByUserId === targetUserId) {
    throw new AppError("Cannot remove the organization owner.", 400, "CANNOT_REMOVE_OWNER");
  }

  // Transactionally remove project memberships and detach user from organization
  await AppDataSource.transaction(async (manager) => {
    // Find all projects belonging to this organization
    const orgProjects = await manager.find(Project, {
      where: { organizationId: authUser.organizationId },
      select: { id: true },
    });

    const projectIds = orgProjects.map((p) => p.id);
    if (projectIds.length > 0) {
      await manager
        .createQueryBuilder()
        .delete()
        .from(ProjectMember)
        .where("userId = :userId AND projectId IN (:...projectIds)", {
          userId: targetUserId,
          projectIds,
        })
        .execute();
    }

    // Detach user from organization without deleting global account
    targetUser.organizationId = null as any;
    targetUser.role = UserRole.TEAMMATE;
    await manager.save(User, targetUser);
  });

  return res.json({
    success: true,
    message: "Member removed from organization successfully.",
  });
}

