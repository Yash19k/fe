"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEmail = normalizeEmail;
exports.hashPasswordResetToken = hashPasswordResetToken;
exports.requestPasswordReset = requestPasswordReset;
exports.resetPassword = resetPassword;
const crypto_1 = require("crypto");
const bcrypt_1 = __importDefault(require("bcrypt"));
const data_source_1 = require("../config/data.source");
const config_1 = require("../config/config");
const user_entity_1 = require("../entities/user.entity");
const password_reset_token_entity_1 = require("../entities/password-reset-token.entity");
const user_session_entity_1 = require("../entities/user.session.entity");
const app_error_1 = require("../errors/app.error");
const mail_service_1 = require("./mail.service");
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function hashPasswordResetToken(token) {
    return (0, crypto_1.createHash)("sha256").update(token).digest("hex");
}
function generateResetToken() {
    return (0, crypto_1.randomBytes)(32).toString("hex");
}
async function issueResetTokenForUser(userId, manager = data_source_1.AppDataSource.manager) {
    const resetTokenRepository = manager.getRepository(password_reset_token_entity_1.PasswordResetToken);
    await resetTokenRepository.delete({ userId });
    const rawToken = generateResetToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await resetTokenRepository.save(resetTokenRepository.create({
        userId,
        tokenHash: hashPasswordResetToken(rawToken),
        expiresAt,
        usedAt: null,
    }));
    return rawToken;
}
async function requestPasswordReset(email) {
    const normalizedEmail = normalizeEmail(email);
    const userRepository = data_source_1.AppDataSource.getRepository(user_entity_1.User);
    const user = await userRepository.findOne({
        where: { email: normalizedEmail },
    });
    if (!user || !user.passwordHash || user.status === user_entity_1.UserStatus.DISABLED) {
        return;
    }
    const resetToken = await issueResetTokenForUser(user.id);
    const resetLink = `${config_1.config.frontendUrl.replace(/\/$/, "")}/#/reset-password?token=${encodeURIComponent(resetToken)}`;
    try {
        await (0, mail_service_1.sendPasswordResetEmail)({
            email: user.email,
            userName: user.fullName || "there",
            resetLink,
        });
    }
    catch (error) {
        console.error("Password reset email delivery failed:", error);
    }
}
async function resetPassword(token, newPassword) {
    if (!token || token.trim().length === 0) {
        throw new app_error_1.AppError("Reset token is required.", 400, "RESET_TOKEN_REQUIRED");
    }
    const tokenHash = hashPasswordResetToken(token);
    await data_source_1.AppDataSource.transaction(async (manager) => {
        const passwordResetRepository = manager.getRepository(password_reset_token_entity_1.PasswordResetToken);
        const userRepository = manager.getRepository(user_entity_1.User);
        const sessionRepository = manager.getRepository(user_session_entity_1.UserSession);
        const resetRecord = await passwordResetRepository.findOne({
            where: { tokenHash },
            lock: { mode: "pessimistic_write" },
        });
        if (!resetRecord) {
            throw new app_error_1.AppError("This password reset link is invalid or has expired.", 400, "INVALID_RESET_TOKEN");
        }
        if (resetRecord.usedAt || resetRecord.expiresAt.getTime() <= Date.now()) {
            throw new app_error_1.AppError("This password reset link is invalid or has expired.", 400, "INVALID_RESET_TOKEN");
        }
        const user = await userRepository.findOne({
            where: { id: resetRecord.userId },
        });
        if (!user) {
            throw new app_error_1.AppError("This password reset link is invalid or has expired.", 400, "INVALID_RESET_TOKEN");
        }
        if (!user.passwordHash || user.status === user_entity_1.UserStatus.DISABLED) {
            throw new app_error_1.AppError("This password reset link is invalid or has expired.", 400, "INVALID_RESET_TOKEN");
        }
        const passwordHash = await bcrypt_1.default.hash(newPassword, 12);
        user.passwordHash = passwordHash;
        user.status = user_entity_1.UserStatus.ACTIVE;
        await userRepository.save(user);
        resetRecord.usedAt = new Date();
        await passwordResetRepository.save(resetRecord);
        await sessionRepository
            .createQueryBuilder()
            .update(user_session_entity_1.UserSession)
            .set({ revokedAt: new Date() })
            .where("user_id = :userId", { userId: user.id })
            .andWhere("revoked_at IS NULL")
            .execute();
    });
}
