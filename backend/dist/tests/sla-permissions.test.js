"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const project_permission_1 = require("../middleware/project.permission");
const project_member_entity_1 = require("../entities/project.member.entity");
(0, node_test_1.describe)("SLA project permissions", () => {
    (0, node_test_1.test)("allows management actions for project administrators and leads", () => {
        for (const role of [project_member_entity_1.ProjectRole.ADMIN, project_member_entity_1.ProjectRole.LEAD]) {
            for (const action of [
                "sla:view",
                "sla:manage",
                "sla:resolve",
                "sla:audit",
            ]) {
                strict_1.default.equal((0, project_permission_1.hasProjectPermission)(role, action), true);
            }
        }
    });
    (0, node_test_1.test)("allows members to view SLA data but not change it", () => {
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.MEMBER, "sla:view"), true);
        for (const action of [
            "sla:manage",
            "sla:resolve",
            "sla:audit",
        ]) {
            strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.MEMBER, action), false);
        }
    });
});
