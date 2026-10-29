
import nodemailer from "nodemailer";
import { config } from "../config/config";
import { AppError } from "../errors/app.error";

export function validateEmailConfiguration(): void {
  const requiredEmailConfig = [
    config.email.smtpHost,
    config.email.smtpUser,
    config.email.smtpPassword,
    config.email.smtpFrom,
  ];
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

type InvitationEmailParams = {
  email: string;
  organizationName: string;
  role: string;
  invitationUrl: string;
  expiresInHours: number;
};

function getSmtpFailure(error: unknown): AppError {
  const smtpError =
    typeof error === "object" && error !== null
      ? (error as {
          name?: unknown;
          code?: unknown;
          command?: unknown;
          responseCode?: unknown;
        })
      : {};
  const diagnostic: NonNullable<AppError["diagnostic"]> = {
    provider: "smtp",
    ...(typeof smtpError.name === "string" && { name: smtpError.name }),
    ...(typeof smtpError.code === "string" && { code: smtpError.code }),
    ...(typeof smtpError.command === "string" && {
      command: smtpError.command,
    }),
    ...(typeof smtpError.responseCode === "number" && {
      responseCode: smtpError.responseCode,
    }),
  };
  const errorCode = diagnostic.code;

  if (
    errorCode === "EAUTH" ||
    diagnostic.responseCode === 534 ||
    diagnostic.responseCode === 535
  ) {
    return new AppError(
      "The email service could not authenticate with the SMTP provider.",
      502,
      "EMAIL_AUTHENTICATION_FAILED",
      diagnostic,
    );
  }

  if (
    ["ECONNECTION", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ESOCKET", "ENOTFOUND", "EHOSTUNREACH"].includes(
      errorCode ?? "",
    ) ||
    diagnostic.responseCode === 421 ||
    diagnostic.command === "CONN"
  ) {
    return new AppError(
      "The email service could not connect to the SMTP provider.",
      502,
      "EMAIL_CONNECTION_FAILED",
      diagnostic,
    );
  }

  if (diagnostic.command === "RCPT TO" || errorCode === "EENVELOPE") {
    return new AppError(
      "The SMTP provider rejected the invitation recipient.",
      502,
      "EMAIL_RECIPIENT_REJECTED",
      diagnostic,
    );
  }

  return new AppError(
    "The invitation email could not be submitted. Check backend logs for SMTP diagnostics.",
    502,
    "EMAIL_DELIVERY_FAILED",
    diagnostic,
  );
}

export function buildInvitationEmailContent(params: InvitationEmailParams): {
  subject: string;
  text: string;
  html: string;
} {
  const safeInvitationUrl = escapeHtml(params.invitationUrl);

  return {
    subject: `Your TaskFlow invitation - ${params.organizationName}`,
    text: [
      "You have been invited to TaskFlow.",
      "",
      `Organization: ${params.organizationName}`,
      `Assigned role: ${params.role}`,
      "",
      `Accept Invitation: ${params.invitationUrl}`,
      "",
      `This invitation expires after ${params.expiresInHours} hours and can only be used once.`,
      "If you were not expecting this email, please contact your organization administrator.",
    ].join("\n"),
    html: `
      <div style="margin:0;padding:24px 12px;background-color:#f4f6fb;font-family:Arial,sans-serif;color:#202633;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #e4e8f0;border-radius:12px;">
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:#202633;">You have been invited to TaskFlow</h1>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">
                You have been invited to join <strong>${escapeHtml(params.organizationName)}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">
                Your assigned role: <strong>${escapeHtml(params.role)}</strong>
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" bgcolor="#4f46e5" style="border-radius:8px;">
                    <a href="${safeInvitationUrl}" target="_blank" style="display:inline-block;padding:14px 24px;border:1px solid #4f46e5;border-radius:8px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#4b5563;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word;">
                <a href="${safeInvitationUrl}" target="_blank" style="color:#4338ca;">${safeInvitationUrl}</a>
              </p>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#4b5563;">
                This invitation expires after ${escapeHtml(String(params.expiresInHours))} hours and can only be used once. You will be asked to set a permanent password when accepting.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563;">
                If you were not expecting this email, please contact your organization administrator.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `,
  };
}

export async function sendInvitationEmail(params: InvitationEmailParams) {
  const transporter = getTransporter();
  const content = buildInvitationEmailContent(params);

  try {
    const info = await transporter.sendMail({
      from: config.email.smtpFrom,
      to: params.email,
      ...content,
    });

    const accepted = (info.accepted ?? []).map((address) =>
      String(address).trim().toLowerCase(),
    );
    const rejected = (info.rejected ?? []).map((address) =>
      String(address).trim().toLowerCase(),
    );
    const recipient = params.email.trim().toLowerCase();

    if (!accepted.includes(recipient) || rejected.includes(recipient)) {
      throw new AppError(
        "The SMTP provider rejected the invitation recipient.",
        502,
        "EMAIL_RECIPIENT_REJECTED",
        { provider: "smtp", stage: "recipient-rejection" },
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

    throw getSmtpFailure(error);
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
