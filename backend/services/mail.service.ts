
import nodemailer from "nodemailer";
import { config } from "../config/config";
import { AppError } from "../errors/app.error";

const requiredEmailConfig = [
  config.email.smtpHost,
  config.email.smtpUser,
  config.email.smtpPassword,
  config.email.smtpFrom,
];

export function validateEmailConfiguration(): void {
  const isPortValid =
    Number.isInteger(config.email.smtpPort) &&
    config.email.smtpPort >= 1 &&
    config.email.smtpPort <= 65535;

  if (
    requiredEmailConfig.some(
      (value) => typeof value !== "string" || value.trim().length === 0,
    ) ||
    !isPortValid
  ) {
    throw new AppError(
      "Invitation email service is not configured. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
      503,
      "EMAIL_CONFIGURATION_ERROR",
    );
  }
}

function getTransporter() {
  validateEmailConfiguration();

  return nodemailer.createTransport({
    host: config.email.smtpHost,
    port: config.email.smtpPort,
    secure: config.email.smtpSecure,
    auth: {
      user: config.email.smtpUser,
      pass: config.email.smtpPassword,
    },
  });
}

export async function sendPasswordResetEmail(params: {
  email: string;
  userName: string;
  resetLink: string;
}) {
  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail({
      from: config.email.smtpFrom,
      to: params.email,
      subject: "Reset your TaskFlow password",
      text: [
        "Hello,",
        "",
        `We received a request to reset the password for your TaskFlow account.`,
        "",
        `Reset your password here: ${params.resetLink}`,
        "",
        "This link expires in 30 minutes.",
        "If you did not request this reset, please ignore this email and no changes will be made.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Reset your TaskFlow password</h2>
          <p>Hello ${escapeHtml(params.userName)},</p>
          <p>We received a request to reset the password for your TaskFlow account.</p>
          <p>
            <a href="${escapeHtml(params.resetLink)}" target="_blank" rel="noopener noreferrer">
              Reset your password
            </a>
          </p>
          <p>This link expires in 30 minutes.</p>
          <p>If you did not request this password reset, you can safely ignore this email.</p>
        </div>
      `,
    });

    const accepted = (info.accepted ?? []).map((address) =>
      String(address).trim().toLowerCase(),
    );
    const rejected = (info.rejected ?? []).map((address) =>
      String(address).trim().toLowerCase(),
    );
    const recipient = params.email.trim().toLowerCase();

    if (!accepted.includes(recipient) || rejected.includes(recipient)) {
      console.error("SMTP did not accept the password reset recipient.", {
        recipient,
        accepted,
        rejected,
        response: info.response,
      });

      throw new AppError(
        "The password reset email could not be submitted.",
        502,
        "EMAIL_SUBMISSION_FAILED",
      );
    }

    return {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    const smtpError = error as {
      name?: string;
      message?: string;
      code?: string;
      command?: string;
      response?: string;
      responseCode?: number;
    };

    console.error("Password reset email SMTP failure:", {
      name: smtpError.name,
      message: smtpError.message,
      code: smtpError.code,
      command: smtpError.command,
      response: smtpError.response,
      responseCode: smtpError.responseCode,
    });

    throw new AppError(
      "The password reset email could not be submitted. Check backend logs for SMTP diagnostics.",
      502,
      "EMAIL_SUBMISSION_FAILED",
    );
  }
}

export async function sendInvitationEmail(params: {
  email: string;
  organizationName: string;
  role: string;
  invitationToken: string;
}) {
  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail({
      from: config.email.smtpFrom,
      to: params.email,
      subject: `Your TaskFlow invitation - ${params.organizationName}`,
      text: [
        "Hello,",
        "",
        `You have been invited to join ${params.organizationName} on TaskFlow.`,
        `Your assigned role is ${params.role}.`,
        "",
        `Your one-time invitation token is: ${params.invitationToken}`,
        "",
        "Use this token to accept the invitation and set your permanent password.",
        "The token expires after 48 hours and can only be used once.",
        "",
        "If you were not expecting this email, please contact your organization administrator.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>You have been invited to TaskFlow</h2>
          <p>
            You have been invited to join
            <strong>${escapeHtml(params.organizationName)}</strong>
            on TaskFlow.
          </p>
          <p>
            Your assigned role:
            <strong>${escapeHtml(params.role)}</strong>
          </p>
          <p>Your one-time invitation token is:</p>
          <p style="font-size: 16px; font-weight: bold; word-break: break-all;">
            ${escapeHtml(params.invitationToken)}
          </p>
          <p>
            Use this token to accept the invitation and set your permanent
            password. It expires after 48 hours and can only be used once.
          </p>
          <p>
            If you were not expecting this email, please contact your
            organization administrator.
          </p>
        </div>
      `,
    });

    const accepted = (info.accepted ?? []).map((address) =>
      String(address).trim().toLowerCase(),
    );
    const rejected = (info.rejected ?? []).map((address) =>
      String(address).trim().toLowerCase(),
    );
    const recipient = params.email.trim().toLowerCase();

    if (!accepted.includes(recipient) || rejected.includes(recipient)) {
      console.error("SMTP did not accept the invitation recipient.", {
        recipient,
        accepted,
        rejected,
        response: info.response,
      });

      throw new AppError(
        "The SMTP server did not accept the invitation recipient.",
        502,
        "EMAIL_SUBMISSION_FAILED",
      );
    }

    return {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    const smtpError = error as {
      name?: string;
      message?: string;
      code?: string;
      command?: string;
      response?: string;
      responseCode?: number;
    };

    console.error("Invitation email SMTP failure:", {
      name: smtpError.name,
      message: smtpError.message,
      code: smtpError.code,
      command: smtpError.command,
      response: smtpError.response,
      responseCode: smtpError.responseCode,
    });

    throw new AppError(
      "The invitation email could not be submitted. Check backend logs for SMTP diagnostics.",
      502,
      "EMAIL_SUBMISSION_FAILED",
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}
