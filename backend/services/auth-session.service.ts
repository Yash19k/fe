import { createHash, randomBytes } from "crypto";
import type { Response } from "express";
import type { EntityManager } from "typeorm";
import jwt from "jsonwebtoken";
import { config } from "../config/config";
import { UserSession } from "../entities/user.session.entity";
import { UserRole } from "../entities/user.entity";

const ACCESS_TOKEN_TTL = "15m";
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createAccessToken(user: {
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

export async function createAuthSession(
  manager: EntityManager,
  user: {
    id: string;
    role: UserRole;
    organizationId: string;
  },
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = createAccessToken(user);
  const refreshToken = randomBytes(32).toString("hex");

  await manager.getRepository(UserSession).save(
    manager.getRepository(UserSession).create({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      revokedAt: null,
      lastUsedAt: new Date(),
    }),
  );

  return { accessToken, refreshToken };
}

export function setAuthCookies(
  res: Response,
  session: { accessToken: string; refreshToken: string },
): void {
  res.cookie("token", session.accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookie("refreshToken", session.refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie("token", token, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie("refreshToken", token, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie("token", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
}
