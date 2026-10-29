
import { Request, Response } from "express";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";

import { AppDataSource } from "../config/data.source";
import { User, UserRole, UserStatus } from "../entities/user.entity";
import { Organization } from "../entities/organization.entity";
import { OrganizationSla } from "../entities/organization.sla.entity";
import { UserSession } from "../entities/user.session.entity";
import { loginSchema, onboardingSchema } from "../validations/user.validator";
import { AppError } from "../errors/app.error";
import { config } from "../config/config";

const userRepository = AppDataSource.getRepository(User);
const organizationRepository = AppDataSource.getRepository(Organization);
const sessionRepository = AppDataSource.getRepository(UserSession);

const ACCESS_TOKEN_TTL = "15m";
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

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

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createAccessToken(user: {
  id: string;
  role: UserRole;
  organizationId: string;
}): string {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId,
      type: "ACCESS",
    },
    config.accessTokenSecret,
    {
      algorithm: "HS256",
      expiresIn: ACCESS_TOKEN_TTL,
    },
  );
}

function setAccessCookie(res: Response, token: string): void {
  res.cookie("token", token, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie("refreshToken", token, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie("token", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
}

async function createAuthSession(
  user: {
    id: string;
    role: UserRole;
    organizationId: string;
  },
  res: Response,
): Promise<string> {
  const accessToken = createAccessToken(user);
  const refreshToken = randomBytes(32).toString("hex");

  await sessionRepository.save(
    sessionRepository.create({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      revokedAt: null,
      lastUsedAt: new Date(),
    }),
  );

  setAccessCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
  return accessToken;
}

export async function registerOrganization(req: Request, res: Response) {
  let payload = req.body;
  if (!payload.user && (payload.email || payload.adminName || payload.organizationName)) {
    payload = {
      user: {
        fullName: payload.adminName || payload.fullName || "Workspace Admin",
        email: payload.email,
        password: payload.password,
      },
      organization: {
        name: payload.organizationName || payload.name,
      },
    };
  }

  const { error, value } = onboardingSchema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new AppError(
      error.details.map((d) => `${d.path.join(".")}: ${d.message}`).join(", "),
      400,
      "VALIDATION_ERROR",
    );
  }

  const { user, organization } = value;

  const existingUser = await userRepository.findOne({
    where: { email: user.email.toLowerCase() },
  });
  if (existingUser) {
    throw new AppError(
      "A user with this email address already exists.",
      409,
      "EMAIL_ALREADY_EXISTS",
    );
  }

  const passwordHash = await bcrypt.hash(user.password, 12);

  const result = await AppDataSource.transaction(async (m) => {
    const org = await m.save(Organization, {
      name: organization.name,
    });

    const newUser = await m.save(User, {
      organizationId: org.id,
      fullName: user.fullName,
      email: user.email.toLowerCase(),
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    await m.save(OrganizationSla, {
      organizationId: org.id,
      urgentHours: 4,
      highHours: 8,
      mediumHours: 24,
      lowHours: 72,
      escalateHours: 8,
    });

    return { org, newUser };
  });

  const token = await createAuthSession(
    {
      id: result.newUser.id,
      role: result.newUser.role,
      organizationId: result.org.id,
    },
    res,
  );

  return res.status(201).json({
    success: true,
    token,
    organizationId: result.org.id,
    userId: result.newUser.id,
    data: {
      organizationId: result.org.id,
      userId: result.newUser.id,
      token,
    },
    user: {
      id: result.newUser.id,
      name: result.newUser.fullName,
      email: result.newUser.email,
      role: result.newUser.role,
      companyId: result.org.id,
      companyName: result.org.name,
      onboardingCompleted: false,
    },
    organization: {
      id: result.org.id,
      name: result.org.name,
      createdByUserId: result.newUser.id,
      createdAt: result.org.createdAt,
    },
  });
}

export async function login(req: Request, res: Response) {
  const { error, value } = loginSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new AppError(
      error.details
        .map((detail) => `${detail.path.join(".")}: ${detail.message}`)
        .join(", "),
      400,
      "VALIDATION_ERROR",
    );
  }

  const user = await userRepository.findOne({
    where: { email: value.email.toLowerCase() },
  });

  if (
    !user ||
    (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING) ||
    !user.passwordHash ||
    !(await bcrypt.compare(value.password, user.passwordHash))
  ) {
    throw new AppError(
      "Invalid email or password.",
      401,
      "INVALID_CREDENTIALS",
    );
  }

  if (user.status === UserStatus.PENDING) {
    user.status = UserStatus.ACTIVE;
    user.inviteTokenHash = null;
    user.inviteExpiresAt = null;
    await userRepository.save(user);
  }

  if (!user.organizationId) {
    throw new AppError(
      "Organization not found.",
      404,
      "ORGANIZATION_NOT_FOUND",
    );
  }

  const organization = await organizationRepository.findOne({
    where: { id: user.organizationId },
  });

  if (!organization) {
    throw new AppError(
      "Organization not found.",
      404,
      "ORGANIZATION_NOT_FOUND",
    );
  }

  const token = await createAuthSession(
    {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
    },
    res,
  );

  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
      companyId: organization.id,
      companyName: organization.name,
      onboardingCompleted: true,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      createdByUserId: user.id,
      createdAt: organization.createdAt,
    },
  });
}

/**
* POST /auth/refresh
 * Uses the refresh cookie to issue a new access token
 * and rotates the refresh token.
 */
export async function refreshAccessToken(req: Request, res: Response) {
  const refreshToken = req.cookies?.refreshToken;

  if (typeof refreshToken !== "string" || !refreshToken) {
    clearAuthCookies(res);
    throw new AppError(
      "Refresh token is missing. Please log in again.",
      401,
      "REFRESH_TOKEN_MISSING",
    );
  }

  const newRefreshToken = randomBytes(32).toString("hex");
  const result = await AppDataSource.transaction(async (manager) => {
    const sessions = manager.getRepository(UserSession);
    const session = await sessions
      .createQueryBuilder("session")
      .setLock("pessimistic_write")
      .where("session.tokenHash = :tokenHash", {
        tokenHash: hashRefreshToken(refreshToken),
      })
      .getOne();

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      return {
        error: new AppError(
          "Refresh session is invalid or expired. Please log in again.",
          401,
          "INVALID_REFRESH_TOKEN",
        ),
      };
    }

    const user = await manager.getRepository(User).findOne({
      where: { id: session.userId },
    });

    if (!user || user.status !== UserStatus.ACTIVE || !user.organizationId) {
      session.revokedAt = new Date();
      await sessions.save(session);
      return {
        error: new AppError(
          "Your account is unavailable. Please log in again.",
          401,
          "INVALID_SESSION_USER",
        ),
      };
    }

    const organization = await manager
      .getRepository(Organization)
      .findOne({ where: { id: user.organizationId } });

    if (!organization) {
      session.revokedAt = new Date();
      await sessions.save(session);
      return {
        error: new AppError(
          "Organization not found.",
          401,
          "INVALID_SESSION_ORGANIZATION",
        ),
      };
    }

    session.tokenHash = hashRefreshToken(newRefreshToken);
    session.expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    session.lastUsedAt = new Date();
    await sessions.save(session);

    return {
      accessToken: createAccessToken({
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
      }),
    };
  });

  if ("error" in result) {
    clearAuthCookies(res);
    throw result.error;
  }

  const accessToken = result.accessToken;
  setAccessCookie(res, accessToken);
  setRefreshCookie(res, newRefreshToken);

  return res.status(200).json({
    success: true,
    message: "Access token refreshed successfully.",
    token: accessToken,
  });
}

export async function currentUser(req: Request, res: Response) {
  const user = await userRepository.findOne({
    where: { id: req.user!.id },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      "Invalid authentication token.",
      401,
      "INVALID_TOKEN",
    );
  }

  if (!user.organizationId) {
    throw new AppError(
      "Organization not found.",
      404,
      "ORGANIZATION_NOT_FOUND",
    );
  }

  const organization = await organizationRepository.findOne({
    where: { id: user.organizationId },
  });

  if (!organization) {
    throw new AppError(
      "Organization not found.",
      404,
      "ORGANIZATION_NOT_FOUND",
    );
  }

  return res.json({
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
      companyId: organization.id,
      companyName: organization.name,
      onboardingCompleted: true,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      createdByUserId: user.id,
      createdAt: organization.createdAt,
    },
  });
}

export async function logout(req: Request, res: Response) {
  const refreshToken = req.cookies?.refreshToken;

  if (typeof refreshToken === "string" && refreshToken) {
    const session = await sessionRepository.findOne({
      where: {
        tokenHash: hashRefreshToken(refreshToken),
      },
    });

    if (session && !session.revokedAt) {
      session.revokedAt = new Date();
      await sessionRepository.save(session);
    }
  }

  clearAuthCookies(res);

  return res.json({ success: true });
}

export async function getOrganizationUsers(req: Request, res: Response) {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
  }

  const users = await userRepository.find({
    where: { organizationId, status: UserStatus.ACTIVE },
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
    })),
  });
}
