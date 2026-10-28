import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { app } from "../app";
import {
  hasProjectPermission,
  ProjectAction,
} from "../middleware/project.permission";
import { ProjectRole } from "../entities/project.member.entity";
import { onboardingSchema, invitedMembersSchema } from "../validations/user.validator";

describe("API Contracts and Onboarding Schemas", () => {
  test("validates nested onboarding schema", () => {
    const payload = {
      user: {
        fullName: "Test Admin",
        email: "admin@example.com",
        password: "ValidPassword123!",
      },
      organization: {
        name: "Acme Corp",
      },
    };

    const { error, value } = onboardingSchema.validate(payload);
    assert.equal(error, undefined);
    assert.equal(value.user.email, "admin@example.com");
    assert.equal(value.organization.name, "Acme Corp");
  });

  test("validates invited members schema with array format", () => {
    const payload = [
      { email: "teammate@example.com", role: "TEAMMATE" },
      { email: "manager@example.com", role: "MANAGER" },
    ];

    const { error, value } = invitedMembersSchema.validate(payload);
    assert.equal(error, undefined);
    assert.equal(Array.isArray(value), true);
    assert.equal(value.length, 2);
  });

  test("validates invited members schema with members wrapper", () => {
    const payload = {
      members: [
        { email: "teammate@example.com", role: "TEAMMATE" },
      ],
    };

    const { error, value } = invitedMembersSchema.validate(payload);
    assert.equal(error, undefined);
    assert.equal(value.members.length, 1);
  });

  test("validates project role authorization for member role update", () => {
    // Member cannot update project member roles
    assert.equal(hasProjectPermission(ProjectRole.MEMBER, "member:role:update"), false);

    // Lead and Admin can manage members
    assert.equal(hasProjectPermission(ProjectRole.LEAD, "member:role:update"), true);
    assert.equal(hasProjectPermission(ProjectRole.ADMIN, "member:role:update"), true);
  });

  test("validates project role authorization for member add and remove", () => {
    // Only Admin and Lead can add members
    assert.equal(hasProjectPermission(ProjectRole.MEMBER, "member:add"), false);
    assert.equal(hasProjectPermission(ProjectRole.LEAD, "member:add"), true);
    assert.equal(hasProjectPermission(ProjectRole.ADMIN, "member:add"), true);

    // Only Admin can remove members
    assert.equal(hasProjectPermission(ProjectRole.MEMBER, "member:remove"), false);
    assert.equal(hasProjectPermission(ProjectRole.LEAD, "member:remove"), false);
    assert.equal(hasProjectPermission(ProjectRole.ADMIN, "member:remove"), true);
  });
});
