"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const data_source_1 = require("../config/data.source");
const app_error_1 = require("../errors/app.error");
const project_entity_1 = require("../entities/project.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const user_entity_1 = require("../entities/user.entity");
const project_permission_1 = require("../middleware/project.permission");
const work_item_service_1 = require("../services/work-item.service");
const work_item_entity_1 = require("../entities/work.item.entity");
const projectId = "project-1";
const organizationId = "organization-1";
const userId = "user-1";
function createProject() {
    return Object.assign(new project_entity_1.Project(), {
        id: projectId,
        organizationId,
        visibility: project_entity_1.ProjectVisibility.PUBLIC,
    });
}
function createMembership(role) {
    return Object.assign(new project_member_entity_1.ProjectMember(), {
        projectId,
        userId,
        role,
    });
}
function createWorkItemPermissionRequest(bodyProjectId) {
    const request = Object.create(null);
    request.user = { id: userId, organizationId, role: user_entity_1.UserRole.TEAMMATE };
    request.params = { workItemId: "work-item-1" };
    request.query = {};
    request.body = { projectId: bodyProjectId };
    return request;
}
(0, node_test_1.describe)("work-item project authorization", () => {
    (0, node_test_1.test)("requires project membership even for public projects and organization admins", async (t) => {
        const project = createProject();
        t.mock.method(data_source_1.AppDataSource, "getRepository", ((entity) => ({
            findOne: async () => entity === project_entity_1.Project ? project : null,
        })));
        for (const role of [user_entity_1.UserRole.TEAMMATE, user_entity_1.UserRole.ADMIN]) {
            await strict_1.default.rejects((0, project_permission_1.authorizeProjectPermission)({
                user: { id: userId, organizationId, role },
                params: {},
                query: {},
                body: { projectId },
            }, "task:create"), (error) => error instanceof app_error_1.AppError &&
                error.statusCode === 403 &&
                error.code === "PROJECT_MEMBERSHIP_REQUIRED");
        }
    });
    (0, node_test_1.test)("rejects projects outside the authenticated user's organization", async (t) => {
        t.mock.method(data_source_1.AppDataSource, "getRepository", (() => ({ findOne: async () => null })));
        await strict_1.default.rejects((0, project_permission_1.authorizeWorkItemCreationForActor)({ id: userId, organizationId }, projectId), (error) => error instanceof app_error_1.AppError &&
            error.statusCode === 404 &&
            error.code === "PROJECT_NOT_FOUND");
    });
    (0, node_test_1.test)("retains work-item creation permission for all project roles", async (t) => {
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.ADMIN, "task:create"), true);
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.LEAD, "task:create"), true);
        strict_1.default.equal((0, project_permission_1.hasProjectPermission)(project_member_entity_1.ProjectRole.MEMBER, "task:create"), true);
        const project = createProject();
        let membershipRole = project_member_entity_1.ProjectRole.MEMBER;
        t.mock.method(data_source_1.AppDataSource, "getRepository", ((entity) => ({
            findOne: async () => entity === project_entity_1.Project ? project : createMembership(membershipRole),
        })));
        for (const role of Object.values(project_member_entity_1.ProjectRole)) {
            membershipRole = role;
            await (0, project_permission_1.authorizeWorkItemCreationForActor)({ id: userId, organizationId }, projectId);
        }
    });
    (0, node_test_1.test)("enforces membership in the creation service, not only the HTTP route", async (t) => {
        const project = createProject();
        const manager = {
            getRepository: (entity) => ({
                findOne: async () => entity === project_entity_1.Project ? project : null,
            }),
        };
        t.mock.method(data_source_1.AppDataSource, "transaction", (async (operation) => operation(manager)));
        const actor = {
            id: userId,
            organizationId,
            status: user_entity_1.UserStatus.ACTIVE,
            role: "TEAMMATE",
        };
        const input = {
            projectId,
            type: work_item_entity_1.WorkItemType.TASK,
            title: "Test task",
        };
        await strict_1.default.rejects((0, work_item_service_1.createWorkItemOrchestration)(actor, input), (error) => error instanceof app_error_1.AppError &&
            error.statusCode === 403 &&
            error.code === "PROJECT_MEMBERSHIP_REQUIRED");
    });
    (0, node_test_1.test)("rejects a nonmember even when the body names a project they can access", async (t) => {
        const targetProjectId = "project-b";
        let authorizedProjectId;
        t.mock.method(data_source_1.AppDataSource, "getRepository", ((entity) => ({
            findOne: async (options) => {
                if (entity === work_item_entity_1.WorkItem) {
                    return { projectId: targetProjectId };
                }
                if (entity === project_entity_1.Project) {
                    authorizedProjectId = options.where?.id;
                    return Object.assign(new project_entity_1.Project(), {
                        id: targetProjectId,
                        organizationId,
                        visibility: project_entity_1.ProjectVisibility.PUBLIC,
                    });
                }
                return null;
            },
        })));
        await strict_1.default.rejects((0, project_permission_1.authorizeProjectPermission)(createWorkItemPermissionRequest(projectId), "task:update"), (error) => error instanceof app_error_1.AppError &&
            error.statusCode === 403 &&
            error.code === "PROJECT_MEMBERSHIP_REQUIRED");
        strict_1.default.equal(authorizedProjectId, targetProjectId);
    });
    (0, node_test_1.test)("does not let a Project A member use Project A's ID for a Project B work item", async (t) => {
        const targetProjectId = "project-b";
        const membershipProjectIds = [];
        t.mock.method(data_source_1.AppDataSource, "getRepository", ((entity) => ({
            findOne: async (options) => {
                if (entity === work_item_entity_1.WorkItem) {
                    return { projectId: targetProjectId };
                }
                if (entity === project_entity_1.Project) {
                    return Object.assign(new project_entity_1.Project(), {
                        id: options.where?.id,
                        organizationId,
                        visibility: project_entity_1.ProjectVisibility.PRIVATE,
                    });
                }
                membershipProjectIds.push(options.where?.projectId ?? "");
                return options.where?.projectId === projectId
                    ? createMembership(project_member_entity_1.ProjectRole.ADMIN)
                    : null;
            },
        })));
        await strict_1.default.rejects((0, project_permission_1.authorizeProjectPermission)(createWorkItemPermissionRequest(projectId), "task:update"), (error) => error instanceof app_error_1.AppError &&
            error.statusCode === 403 &&
            error.code === "PROJECT_MEMBERSHIP_REQUIRED");
        strict_1.default.deepEqual(membershipProjectIds, [targetProjectId]);
    });
    (0, node_test_1.test)("preserves project-role permissions for work-item updates and deletions", async (t) => {
        const targetProjectId = "project-b";
        let membershipRole = project_member_entity_1.ProjectRole.MEMBER;
        t.mock.method(data_source_1.AppDataSource, "getRepository", ((entity) => ({
            findOne: async (options) => {
                if (entity === work_item_entity_1.WorkItem) {
                    return { projectId: targetProjectId };
                }
                if (entity === project_entity_1.Project) {
                    return Object.assign(new project_entity_1.Project(), {
                        id: targetProjectId,
                        organizationId,
                        visibility: project_entity_1.ProjectVisibility.PRIVATE,
                    });
                }
                return Object.assign(new project_member_entity_1.ProjectMember(), {
                    projectId: targetProjectId,
                    userId,
                    role: membershipRole,
                });
            },
        })));
        const request = createWorkItemPermissionRequest(projectId);
        await (0, project_permission_1.authorizeProjectPermission)(request, "task:update");
        await strict_1.default.rejects((0, project_permission_1.authorizeProjectPermission)(request, "task:delete"), (error) => error instanceof app_error_1.AppError &&
            error.statusCode === 403 &&
            error.code === "PROJECT_PERMISSION_DENIED");
        for (const role of [project_member_entity_1.ProjectRole.LEAD, project_member_entity_1.ProjectRole.ADMIN]) {
            membershipRole = role;
            await (0, project_permission_1.authorizeProjectPermission)(request, "task:update");
            await (0, project_permission_1.authorizeProjectPermission)(request, "task:delete");
        }
    });
    (0, node_test_1.test)("returns 404 when an item route references a missing work item", async (t) => {
        t.mock.method(data_source_1.AppDataSource, "getRepository", ((entity) => ({
            findOne: async () => entity === work_item_entity_1.WorkItem ? null : null,
        })));
        await strict_1.default.rejects((0, project_permission_1.authorizeProjectPermission)(createWorkItemPermissionRequest(projectId), "task:update"), (error) => error instanceof app_error_1.AppError &&
            error.statusCode === 404 &&
            error.code === "WORK_ITEM_NOT_FOUND");
    });
});
