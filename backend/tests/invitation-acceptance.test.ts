import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import nodemailer, { type SendMailOptions } from "nodemailer";
import {
  acceptInvitationSchema,
  inviteMembersController,
} from "../controllers/member-invitation.controller";
import { config, validateFrontendUrl } from "../config/config";
import { AppDataSource } from "../config/data.source";
import { User, UserRole } from "../entities/user.entity";
import { createInvitationUrl } from "../services/member-invitation.service";
import {
  buildInvitationEmailContent,
  validateEmailConfiguration,
} from "../services/mail.service";
import { AppError } from "../errors/app.error";

const validPayload = {
  token: "a".repeat(64),
  fullName: "Invited User",
  password: "A secure password 123",
};

describe("invitation acceptance validation", () => {
  test("accepts a one-time hex token and a permanent password", () => {
    const result = acceptInvitationSchema.validate(validPayload);

    assert.equal(result.error, undefined);
  });

  test("rejects malformed tokens and passwords below the minimum length", () => {
    assert.ok(
      acceptInvitationSchema.validate({
        ...validPayload,
        token: "not-a-token",
      }).error,
    );
    assert.ok(
      acceptInvitationSchema.validate({
        ...validPayload,
        password: "short",
      }).error,
    );
  });

  test("requires the invitation token in the request body", () => {
    assert.ok(
      acceptInvitationSchema.validate({
        fullName: validPayload.fullName,
        password: validPayload.password,
      }).error,
    );
  });
});

describe("invitation links and email content", () => {
  test("uses the configured frontend hash route with the token as a query parameter", () => {
    const previousUrl = config.frontendUrl;
    config.frontendUrl = "http://localhost:5173";

    try {
      const link = new URL(createInvitationUrl(validPayload.token));
      assert.equal(link.origin, "http://localhost:5173");
      assert.equal(
        link.hash,
        `#/accept-invitation?token=${validPayload.token}`,
      );
    } finally {
      config.frontendUrl = previousUrl;
    }
  });

  test("renders a button and fallback link without exposing the token separately", () => {
    const invitationUrl = `http://localhost:5173/#/accept-invitation?token=${validPayload.token}`;
    const content = buildInvitationEmailContent({
      email: "member@example.test",
      organizationName: '<Engineering & "Design">',
      role: "TEAMMATE",
      invitationUrl,
      expiresInHours: 24,
    });
    const escapedInvitationUrl = invitationUrl.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    assert.match(content.html, /You have been invited to TaskFlow/);
    assert.match(content.html, /Accept Invitation/);
    assert.match(content.html, new RegExp(`href="${escapedInvitationUrl}"`));
    assert.match(content.html, /&lt;Engineering &amp; &quot;Design&quot;&gt;/);
    assert.match(content.html, /expires after 24 hours/);
    assert.match(content.html, /can only be used once/);
    assert.match(
      content.text,
      new RegExp(`Accept Invitation: ${escapedInvitationUrl}`),
    );
  });

  test("the invitation endpoint sends the generated token URL as HTML and plain text", async (t) => {
    const recipient = "member@example.com";
    const previousFrontendUrl = config.frontendUrl;
    const previousEmailConfig = { ...config.email };
    config.frontendUrl = "http://localhost:5173";
    Object.assign(config.email, {
      smtpHost: "smtp.example.test",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "test-user",
      smtpPassword: "test-password",
      smtpFrom: "TaskFlow <no-reply@example.test>",
    });

    let savedTokenHash = "";
    let submittedEmail: SendMailOptions | undefined;
    const organizationRepository = {
      findOne: async () => ({ id: "organization-1", name: "Engineering" }),
    };
    const userRepository = {
      createQueryBuilder: () => ({
        setLock: () => ({
          where: () => ({ getOne: async () => null }),
        }),
      }),
      create: (values: Record<string, unknown>) => ({
        ...values,
        id: "user-1",
      }),
      save: async (user: Record<string, unknown>) => user,
    };
    const invitationRepository = {
      update: async () => ({ affected: 0 }),
      create: (invitation: { tokenHash: string }) => ({
        ...invitation,
        id: "invitation-1",
      }),
      save: async (invitation: { tokenHash: string }) => {
        savedTokenHash = invitation.tokenHash;
        return invitation;
      },
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === User ? userRepository : invitationRepository,
    };
    const mockTransport = {
      sendMail: async (message: SendMailOptions) => {
        submittedEmail = message;
        return {
          accepted: [recipient],
          rejected: [],
          messageId: "mock-invitation",
          response: "250 accepted",
        };
      },
    };

    t.mock.method(AppDataSource, "getRepository", () => organizationRepository as never);
    t.mock.method(
      AppDataSource,
      "transaction",
      (async (operation: (manager: never) => Promise<unknown>) =>
        operation(manager as never)) as never,
    );
    t.mock.method(nodemailer, "createTransport", () => mockTransport as never);

    try {
      let responseBody: unknown;
      const request = {
        body: [{ email: recipient, role: UserRole.TEAMMATE }],
        user: { role: UserRole.ADMIN, organizationId: "organization-1" },
      } as Parameters<typeof inviteMembersController>[0];
      const response = {
        status: (statusCode: number) => {
          assert.equal(statusCode, 200);
          return response;
        },
        json: (body: unknown) => {
          responseBody = body;
          return body;
        },
      } as unknown as Parameters<typeof inviteMembersController>[1];

      await inviteMembersController(request, response);

      assert.equal((responseBody as { success?: boolean }).success, true);
      assert.ok(submittedEmail);
      assert.equal(submittedEmail.to, recipient);
      assert.equal(typeof submittedEmail.text, "string");
      assert.equal(typeof submittedEmail.html, "string");

      const html = String(submittedEmail.html);
      const firstLink = html.match(/<a href="([^"]+)"/);
      assert.ok(firstLink);
      const invitationUrl = firstLink[1].replace(/&amp;/g, "&");
      assert.match(html, /You have been invited to TaskFlow/);
      assert.match(html, /Accept Invitation/);
      assert.match(html, /Engineering/);
      assert.match(html, /TEAMMATE/);
      assert.match(html, /expires after 24 hours/);
      assert.match(html, /can only be used once/);
      assert.doesNotMatch(html, /one-time invitation token/i);
      assert.match(
        html,
        new RegExp(`href="${invitationUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
      );
      assert.equal(String(submittedEmail.text).includes(invitationUrl), true);

      const invitationPage = new URL(invitationUrl);
      assert.equal(invitationPage.origin, "http://localhost:5173");
      assert.equal(
        invitationPage.hash.split("?")[0],
        "#/accept-invitation",
      );
      const rawToken = new URLSearchParams(
        invitationPage.hash.split("?")[1],
      ).get("token");
      assert.ok(rawToken);
      assert.doesNotMatch(
        html,
        new RegExp(`<p[^>]*>\\s*${rawToken}\\s*</p>`),
      );
      assert.equal(
        savedTokenHash,
        createHash("sha256").update(rawToken).digest("hex"),
      );
    } finally {
      config.frontendUrl = previousFrontendUrl;
      Object.assign(config.email, previousEmailConfig);
    }
  });
});

describe("frontend URL configuration", () => {
  test("accepts a local development URL and rejects unsafe or malformed URLs", () => {
    assert.equal(
      validateFrontendUrl("http://localhost:5173"),
      "http://localhost:5173",
    );
    assert.throws(() => validateFrontendUrl("not a URL"));
    assert.throws(() => validateFrontendUrl("javascript:alert(1)"));
    assert.throws(() =>
      validateFrontendUrl("http://localhost:5173", true),
    );
    assert.throws(() =>
      validateFrontendUrl("https://user:password@example.com"),
    );
  });
});

describe("email configuration", () => {
  test("requires a valid SMTP sender and port", () => {
    const previousFrom = config.email.smtpFrom;
    const previousPort = config.email.smtpPort;

    try {
      config.email.smtpFrom = "";
      assert.throws(
        validateEmailConfiguration,
        (error) =>
          error instanceof AppError &&
          error.code === "EMAIL_CONFIGURATION_ERROR",
      );

      config.email.smtpFrom = "TaskFlow <no-reply@example.test>";
      config.email.smtpPort = 70000;
      assert.throws(
        validateEmailConfiguration,
        (error) =>
          error instanceof AppError &&
          error.code === "EMAIL_CONFIGURATION_ERROR",
      );
    } finally {
      config.email.smtpFrom = previousFrom;
      config.email.smtpPort = previousPort;
    }
  });
});
