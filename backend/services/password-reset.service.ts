import { createHash, randomBytes } from "crypto";
import bcrypt from "bcrypt";

import { AppDataSource } from "../config/data.source";
import { config } from "../config/config";
import { User, UserStatus } from "../entities/user.entity";
import { PasswordResetToken } from "../entities/password-reset-token.entity";
import { UserSession } from "../entities/user.session.entity";
import { AppError } from "../errors/app.error";
import { sendPasswordResetEmail } from "./mail.service";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

async function issueResetTokenForUser(
  userId: string,
  manager = AppDataSource.manager,
): Promise<string> {
  const resetTokenRepository = manager.getRepository(PasswordResetToken);

  await resetTokenRepository.delete({ userId });

  const rawToken = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await resetTokenRepository.save(
    resetTokenRepository.create({
      userId,
      tokenHash: hashPasswordResetToken(rawToken),
      expiresAt,
      usedAt: null,
    }),
  );

  return rawToken;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({
    where: { email: normalizedEmail },
  });

  if (!user || !user.passwordHash || user.status === UserStatus.DISABLED) {
    return;
  }

  const resetToken = await issueResetTokenForUser(user.id);
  const resetLink = `${config.frontendUrl.replace(/\/$/, "")}/#/reset-password?token=${encodeURIComponent(resetToken)}`;

  try {
    await sendPasswordResetEmail({
      email: user.email,
      userName: user.fullName || "there",
      resetLink,
    });
  } catch (error) {
    console.error("Password reset email delivery failed:", error);
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!token || token.trim().length === 0) {
    throw new AppError("Reset token is required.", 400, "RESET_TOKEN_REQUIRED");
  }

  const tokenHash = hashPasswordResetToken(token);

  await AppDataSource.transaction(async (manager) => {
    const passwordResetRepository = manager.getRepository(PasswordResetToken);
    const userRepository = manager.getRepository(User);
    const sessionRepository = manager.getRepository(UserSession);

    const resetRecord = await passwordResetRepository.findOne({
      where: { tokenHash },
      lock: { mode: "pessimistic_write" },
    });

    if (!resetRecord) {
      throw new AppError("This password reset link is invalid or has expired.", 400, "INVALID_RESET_TOKEN");
    }

    if (resetRecord.usedAt || resetRecord.expiresAt.getTime() <= Date.now()) {
      throw new AppError("This password reset link is invalid or has expired.", 400, "INVALID_RESET_TOKEN");
    }

    const user = await userRepository.findOne({
      where: { id: resetRecord.userId },
    });

    if (!user) {
      throw new AppError("This password reset link is invalid or has expired.", 400, "INVALID_RESET_TOKEN");
    }

    if (!user.passwordHash || user.status === UserStatus.DISABLED) {
      throw new AppError("This password reset link is invalid or has expired.", 400, "INVALID_RESET_TOKEN");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    user.passwordHash = passwordHash;
    user.status = UserStatus.ACTIVE;
    await userRepository.save(user);

    resetRecord.usedAt = new Date();
    await passwordResetRepository.save(resetRecord);

    await sessionRepository
      .createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: new Date() })
      .where("user_id = :userId", { userId: user.id })
      .andWhere("revoked_at IS NULL")
      .execute();
  });
}
