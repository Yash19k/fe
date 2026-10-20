
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

export async function sendInvitationEmail(params: {
  email: string;
  organizationName: string;
  role: string;
  temporaryPassword: string;
}) {
  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail({
      from: config.email.smtpFrom,
      to: params.email,
      subject: `Your TaskFlow login details - ${params.organizationName}`,
      text: [
        "Hello,",
        "",
        `You have been invited to join ${params.organizationName} on TaskFlow.`,
        `Your assigned role is ${params.role}.`,
        "",
        `Your temporary login password is: ${params.temporaryPassword}`,
        "",
        "Use your email address and this temporary password to log in to TaskFlow.",
        "Please change your password after logging in.",
        "",
        "If you were not expecting this email, please contact your organization administrator.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2>Welcome to TaskFlow!</h2>
          <p>
            You have been invited to join
            <strong>${escapeHtml(params.organizationName)}</strong>
            on TaskFlow.
          </p>
          <p>
            Your assigned role:
            <strong>${escapeHtml(params.role)}</strong>
          </p>
          <p>Your temporary login password is:</p>
          <p style="font-size: 22px; font-weight: bold; letter-spacing: 2px;">
            ${escapeHtml(params.temporaryPassword)}
          </p>
          <p>
            Use your email address and this temporary password to log in.
          </p>
          <p>
            <strong>Security reminder:</strong>
            Change your password after logging in. Do not share it with anyone.
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
