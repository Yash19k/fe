"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInvitationEmail = sendInvitationEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const smtpPort = Number(process.env.SMTP_PORT || 587);
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST,
    service: "gmail",
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
async function sendInvitationEmail(params) {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl || !process.env.SMTP_FROM) {
        throw new Error("Missing FRONTEND_URL or SMTP_FROM configuration");
    }
    const invitationUrl = new URL("/accept-invitation", frontendUrl);
    invitationUrl.searchParams.set("token", params.token);
    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: params.email,
        subject: `Invitation to join ${params.organizationName}`,
        text: [
            `You have been invited to join ${params.organizationName}.`,
            `Your assigned role is ${params.role}.`,
            `Accept your invitation: ${invitationUrl.toString()}`,
            "This invitation expires in 24 hours.",
            "If you were not expecting this email, you can ignore it.",
        ].join("\n\n"),
        html: `
      <h2>You're invited!</h2>
      <p>You have been invited to join
        <strong>${escapeHtml(params.organizationName)}</strong>.</p>
      <p>Your role: <strong>${escapeHtml(params.role)}</strong></p>
      <p>
        <a href="${escapeHtml(invitationUrl.toString())}">
          Accept invitation
        </a>
      </p>
      <p>This invitation expires in 24 hours.</p>
      <p>If you were not expecting this email, you can ignore it.</p>
    `,
    });
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
