"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forgotPasswordController = forgotPasswordController;
exports.resetPasswordController = resetPasswordController;
const user_validator_1 = require("../validations/user.validator");
const password_reset_service_1 = require("../services/password-reset.service");
const app_error_1 = require("../errors/app.error");
const authCookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
};
function clearAuthCookies(res) {
    res.clearCookie("token", authCookieOptions);
    res.clearCookie("refreshToken", authCookieOptions);
}
async function forgotPasswordController(req, res) {
    const { error, value } = user_validator_1.authForgotPasswordSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        throw new app_error_1.AppError(error.details.map((detail) => `${detail.path.join(".")}: ${detail.message}`).join(", "), 400, "VALIDATION_ERROR");
    }
    await (0, password_reset_service_1.requestPasswordReset)(value.email);
    return res.status(200).json({
        success: true,
        message: "If an account exists for this email, password reset instructions will be sent.",
    });
}
async function resetPasswordController(req, res) {
    const { error, value } = user_validator_1.authResetPasswordSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        throw new app_error_1.AppError(error.details.map((detail) => `${detail.path.join(".")}: ${detail.message}`).join(", "), 400, "VALIDATION_ERROR");
    }
    await (0, password_reset_service_1.resetPassword)(value.token, value.newPassword);
    clearAuthCookies(res);
    return res.status(200).json({
        success: true,
        message: "Password has been reset successfully. Please log in with your new password.",
    });
}
