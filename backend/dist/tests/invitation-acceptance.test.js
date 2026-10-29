"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const crypto_1 = require("crypto");
const nodemailer_1 = __importDefault(require("nodemailer"));
const member_invitation_controller_1 = require("../controllers/member-invitation.controller");
const config_1 = require("../config/config");
const data_source_1 = require("../config/data.source");
const user_entity_1 = require("../entities/user.entity");
const member_invitation_service_1 = require("../services/member-invitation.service");
const mail_service_1 = require("../services/mail.service");
const app_error_1 = require("../errors/app.error");
const validPayload = {
    token: "a".repeat(64),
    fullName: "Invited User",
    password: "A secure password 123",
};
(0, node_test_1.describe)("invitation acceptance validation", () => {
    (0, node_test_1.test)("accepts a one-time hex token and a permanent password", () => {
        const result = member_invitation_controller_1.acceptInvitationSchema.validate(validPayload);
        strict_1.default.equal(result.error, undefined);
    });
    (0, node_test_1.test)("rejects malformed tokens and passwords below the minimum length", () => {
        strict_1.default.ok(member_invitation_controller_1.acceptInvitationSchema.validate({
            ...validPayload,
            token: "not-a-token",
        }).error);
        strict_1.default.ok(member_invitation_controller_1.acceptInvitationSchema.validate({
            ...validPayload,
            password: "short",
        }).error);
    });
    (0, node_test_1.test)("requires the invitation token in the request body", () => {
        strict_1.default.ok(member_invitation_controller_1.acceptInvitationSchema.validate({
            fullName: validPayload.fullName,
            password: validPayload.password,
        }).error);
    });
});
(0, node_test_1.describe)("invitation links and email content", () => {
    (0, node_test_1.test)("uses the configured frontend hash route with the token as a query parameter", () => {
        const previousUrl = config_1.config.frontendUrl;
        config_1.config.frontendUrl = "http://localhost:5173";
        try {
            const link = new URL((0, member_invitation_service_1.createInvitationUrl)(validPayload.token));
            strict_1.default.equal(link.origin, "http://localhost:5173");
            strict_1.default.equal(link.hash, `#/accept-invitation?token=${validPayload.token}`);
        }
        finally {
            config_1.config.frontendUrl = previousUrl;
        }
    });
    (0, node_test_1.test)("renders a button and fallback link without exposing the token separately", () => {
        const invitationUrl = `http://localhost:5173/#/accept-invitation?token=${validPayload.token}`;
        const content = (0, mail_service_1.buildInvitationEmailContent)({
            email: "member@example.test",
            organizationName: '<Engineering & "Design">',
            role: "TEAMMATE",
            invitationUrl,
            expiresInHours: 24,
        });
        const escapedInvitationUrl = invitationUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        strict_1.default.match(content.html, /You have been invited to TaskFlow/);
        strict_1.default.match(content.html, /Accept Invitation/);
        strict_1.default.match(content.html, new RegExp(`href="${escapedInvitationUrl}"`));
        strict_1.default.match(content.html, /&lt;Engineering &amp; &quot;Design&quot;&gt;/);
        strict_1.default.match(content.html, /expires after 24 hours/);
        strict_1.default.match(content.html, /can only be used once/);
        strict_1.default.match(content.text, new RegExp(`Accept Invitation: ${escapedInvitationUrl}`));
    });
    (0, node_test_1.test)("the invitation endpoint sends the generated token URL as HTML and plain text", async (t) => {
        const recipient = "member@example.com";
        const previousFrontendUrl = config_1.config.frontendUrl;
        const previousEmailConfig = { ...config_1.config.email };
        config_1.config.frontendUrl = "http://localhost:5173";
        Object.assign(config_1.config.email, {
            smtpHost: "smtp.example.test",
            smtpPort: 587,
            smtpSecure: false,
            smtpUser: "test-user",
            smtpPassword: "test-password",
            smtpFrom: "TaskFlow <no-reply@example.test>",
        });
        let savedTokenHash = "";
        let submittedEmail;
        const organizationRepository = {
            findOne: async () => ({ id: "organization-1", name: "Engineering" }),
        };
        const userRepository = {
            createQueryBuilder: () => ({
                setLock: () => ({
                    where: () => ({ getOne: async () => null }),
                }),
            }),
            create: (values) => ({
                ...values,
                id: "user-1",
            }),
            save: async (user) => user,
        };
        const invitationRepository = {
            update: async () => ({ affected: 0 }),
            create: (invitation) => ({
                ...invitation,
                id: "invitation-1",
            }),
            save: async (invitation) => {
                savedTokenHash = invitation.tokenHash;
                return invitation;
            },
        };
        const manager = {
            getRepository: (entity) => entity === user_entity_1.User ? userRepository : invitationRepository,
        };
        const mockTransport = {
            sendMail: async (message) => {
                submittedEmail = message;
                return {
                    accepted: [recipient],
                    rejected: [],
                    messageId: "mock-invitation",
                    response: "250 accepted",
                };
            },
        };
        t.mock.method(data_source_1.AppDataSource, "getRepository", () => organizationRepository);
        t.mock.method(data_source_1.AppDataSource, "transaction", (async (operation) => operation(manager)));
        t.mock.method(nodemailer_1.default, "createTransport", () => mockTransport);
        try {
            let responseBody;
            const request = {
                body: [{ email: recipient, role: user_entity_1.UserRole.TEAMMATE }],
                user: { role: user_entity_1.UserRole.ADMIN, organizationId: "organization-1" },
            };
            const response = {
                status: (statusCode) => {
                    strict_1.default.equal(statusCode, 200);
                    return response;
                },
                json: (body) => {
                    responseBody = body;
                    return body;
                },
            };
            await (0, member_invitation_controller_1.inviteMembersController)(request, response);
            strict_1.default.equal(responseBody.success, true);
            strict_1.default.ok(submittedEmail);
            strict_1.default.equal(submittedEmail.to, recipient);
            strict_1.default.equal(typeof submittedEmail.text, "string");
            strict_1.default.equal(typeof submittedEmail.html, "string");
            const html = String(submittedEmail.html);
            const firstLink = html.match(/<a href="([^"]+)"/);
            strict_1.default.ok(firstLink);
            const invitationUrl = firstLink[1].replace(/&amp;/g, "&");
            strict_1.default.match(html, /You have been invited to TaskFlow/);
            strict_1.default.match(html, /Accept Invitation/);
            strict_1.default.match(html, /Engineering/);
            strict_1.default.match(html, /TEAMMATE/);
            strict_1.default.match(html, /expires after 24 hours/);
            strict_1.default.match(html, /can only be used once/);
            strict_1.default.doesNotMatch(html, /one-time invitation token/i);
            strict_1.default.doesNotMatch(html, new RegExp(`<p[^>]*>\\s*${new URLSearchParams(new URL(invitationUrl).hash.split("?")[1]).get("token")}\\s*</p>`));
            strict_1.default.match(html, new RegExp(`href="${invitationUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
            strict_1.default.equal(String(submittedEmail.text).includes(invitationUrl), true);
            const invitationPage = new URL(invitationUrl);
            strict_1.default.equal(invitationPage.origin, "http://localhost:5173");
            strict_1.default.equal(invitationPage.hash.split("?")[0], "#/accept-invitation");
            const rawToken = new URLSearchParams(invitationPage.hash.split("?")[1]).get("token");
            strict_1.default.ok(rawToken);
            strict_1.default.equal(savedTokenHash, (0, crypto_1.createHash)("sha256").update(rawToken).digest("hex"));
        }
        finally {
            config_1.config.frontendUrl = previousFrontendUrl;
            Object.assign(config_1.config.email, previousEmailConfig);
        }
    });
});
(0, node_test_1.describe)("frontend URL configuration", () => {
    (0, node_test_1.test)("accepts a local development URL and rejects unsafe or malformed URLs", () => {
        strict_1.default.equal((0, config_1.validateFrontendUrl)("http://localhost:5173"), "http://localhost:5173");
        strict_1.default.throws(() => (0, config_1.validateFrontendUrl)("not a URL"));
        strict_1.default.throws(() => (0, config_1.validateFrontendUrl)("javascript:alert(1)"));
        strict_1.default.throws(() => (0, config_1.validateFrontendUrl)("http://localhost:5173", true));
        strict_1.default.throws(() => (0, config_1.validateFrontendUrl)("https://user:password@example.com"));
    });
});
(0, node_test_1.describe)("email configuration", () => {
    (0, node_test_1.test)("requires a valid SMTP sender and port", () => {
        const previousFrom = config_1.config.email.smtpFrom;
        const previousPort = config_1.config.email.smtpPort;
        try {
            config_1.config.email.smtpFrom = "";
            strict_1.default.throws(mail_service_1.validateEmailConfiguration, (error) => error instanceof app_error_1.AppError &&
                error.code === "EMAIL_CONFIGURATION_ERROR");
            config_1.config.email.smtpFrom = "TaskFlow <no-reply@example.test>";
            config_1.config.email.smtpPort = 70000;
            strict_1.default.throws(mail_service_1.validateEmailConfiguration, (error) => error instanceof app_error_1.AppError &&
                error.code === "EMAIL_CONFIGURATION_ERROR");
        }
        finally {
            config_1.config.email.smtpFrom = previousFrom;
            config_1.config.email.smtpPort = previousPort;
        }
    });
});
