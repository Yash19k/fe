"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const member_invitation_controller_1 = require("../controllers/member-invitation.controller");
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
});
