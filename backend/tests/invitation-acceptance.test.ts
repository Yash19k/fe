import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { acceptInvitationSchema } from "../controllers/member-invitation.controller";

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
});
