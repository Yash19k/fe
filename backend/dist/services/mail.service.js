"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEmailConfiguration = validateEmailConfiguration;
exports.sendInvitationEmail = sendInvitationEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("../config/config");
const app_error_1 = require("../errors/app.error");
const requiredEmailConfig = [
    config_1.config.email.smtpHost,
    config_1.config.email.smtpUser,
    config_1.config.email.smtpPassword,
    config_1.config.email.smtpFrom,
];
function validateEmailConfiguration() {
    const isPortValid = Number.isInteger(config_1.config.email.smtpPort) &&
        config_1.config.email.smtpPort >= 1 &&
        config_1.config.email.smtpPort <= 65535;
    if (requiredEmailConfig.some((value) => typeof value !== "string" || value.trim().length === 0) ||
        !isPortValid) {
        throw new app_error_1.AppError("Invitation email service is not configured. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.", 503, "EMAIL_CONFIGURATION_ERROR");
    }
}
function getTransporter() {
    validateEmailConfiguration();
    return nodemailer_1.default.createTransport({
        host: config_1.config.email.smtpHost,
        port: config_1.config.email.smtpPort,
        secure: config_1.config.email.smtpSecure,
        auth: {
            user: config_1.config.email.smtpUser,
            pass: config_1.config.email.smtpPassword,
        },
    });
}
async function sendInvitationEmail(params) {
    const transporter = getTransporter();
    try {
        const info = await transporter.sendMail({
            from: config_1.config.email.smtpFrom,
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
        const accepted = (info.accepted ?? []).map((address) => String(address).trim().toLowerCase());
        const rejected = (info.rejected ?? []).map((address) => String(address).trim().toLowerCase());
        const recipient = params.email.trim().toLowerCase();
        if (!accepted.includes(recipient) || rejected.includes(recipient)) {
            console.error("SMTP did not accept the invitation recipient.", {
                recipient,
                accepted,
                rejected,
                response: info.response,
            });
            throw new app_error_1.AppError("The SMTP server did not accept the invitation recipient.", 502, "EMAIL_SUBMISSION_FAILED");
        }
        return {
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
            response: info.response,
        };
    }
    catch (error) {
        if (error instanceof app_error_1.AppError) {
            throw error;
        }
        const smtpError = error;
        console.error("Invitation email SMTP failure:", {
            name: smtpError.name,
            message: smtpError.message,
            code: smtpError.code,
            command: smtpError.command,
            response: smtpError.response,
            responseCode: smtpError.responseCode,
        });
        throw new app_error_1.AppError("The invitation email could not be submitted. Check backend logs for SMTP diagnostics.", 502, "EMAIL_SUBMISSION_FAILED");
    }
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };
        return entities[char];
    });
}
