"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const project_permission_1 = require("../middleware/project.permission");
const project_member_entity_1 = require("../entities/project.member.entity");
const user_validator_1 = require("../validations/user.validator");
(0, node_test_1.describe)("API Contracts and Onboarding Schemas", () => {
    (0, node_test_1.test)("validates nested onboarding schema", () => {
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
        const { error, value } = user_validator_1.onboardingSchema.validate(payload);
        strict_1.default.equal(error, undefined);
        strict_1.default.equal(value.user.email, "admin@example.com");
        strict_1.default.equal(value.organization.name, "Acme Corp");
    });
    (0, node_test_1.test)("validates invited members schema with array format", () => {
        const payload = [
            { email: "teammate@example.com", role: "TEAMMATE" },
            { email: "manager@example.com", role: "MANAGER" },
        ];
        const { error, value } = user_validator_1.invitedMembersSchema.validate(payload);
        strict_1.default.equal(error, undefined);
        strict_1.default.equal(Array.isArray(value), true);
        strict_1.default.equal(value.length, 2);
    });
    (0, node_test_1.test)("validates invited members schema with members wrapper", () => {
        const payload = {
            members: [
                { email: "teammate@example.com", role: "TEAMMATE" },
            ],
        };
        const { error, value } = user_validator_1.invitedMembersSchema.validate(payload);
        strict_1.default.equal(error, undefined);
        strict_1.default.equal(value.members.length, 1);
    });
    (0, node_test_1.test)("validates project role authorization for member role update", () => {
        // Member cannot update project member roles
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.MEMBER, "member:role:update"), false);
        // Lead and Admin can manage members
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.LEAD, "member:role:update"), true);
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.ADMIN, "member:role:update"), true);
    });
    (0, node_test_1.test)("validates project role authorization for member add and remove", () => {
        // Only Admin and Lead can add members
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.MEMBER, "member:add"), false);
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.LEAD, "member:add"), true);
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.ADMIN, "member:add"), true);
        // Only Admin can remove members
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.MEMBER, "member:remove"), false);
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.LEAD, "member:remove"), false);
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.ADMIN, "member:remove"), true);
    });
});
