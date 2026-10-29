import type { Request, Response } from "express";

import { authForgotPasswordSchema, authResetPasswordSchema } from "../validations/user.validator";
import { requestPasswordReset, resetPassword } from "../services/password-reset.service";
import { AppError } from "../errors/app.error";

const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function clearAuthCookies(res: Response): void {
  res.clearCookie("token", authCookieOptions);
  res.clearCookie("refreshToken", authCookieOptions);
}

export async function forgotPasswordController(req: Request, res: Response): Promise<Response> {
  const { error, value } = authForgotPasswordSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new AppError(
      error.details.map((detail) => `${detail.path.join(".")}: ${detail.message}`).join(", "),
      400,
      "VALIDATION_ERROR",
    );
  }

  await requestPasswordReset(value.email);

  return res.status(200).json({
    success: true,
    message: "If an account exists for this email, password reset instructions will be sent.",
  });
}

export async function resetPasswordController(req: Request, res: Response): Promise<Response> {
  const { error, value } = authResetPasswordSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new AppError(
      error.details.map((detail) => `${detail.path.join(".")}: ${detail.message}`).join(", "),
      400,
      "VALIDATION_ERROR",
    );
  }

  await resetPassword(value.token, value.newPassword);
  clearAuthCookies(res);

  return res.status(200).json({
    success: true,
    message: "Password has been reset successfully. Please log in with your new password.",
  });
}
