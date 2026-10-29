"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_1 = require("../controllers/project.controller");
const project_settings_controller_1 = require("../controllers/project-settings.controller");
const auditlog_controller_1 = require("../controllers/auditlog.controller");
const project_validations_1 = require("../validations/project.validations");
const is_loggedin_1 = require("../middleware/is.loggedin");
const async_handler_1 = require("../middleware/async.handler");
const check_permissions_1 = require("../middleware/check.permissions");
const project_permission_1 = require("../middleware/project.permission");
const router = (0, express_1.Router)();
router.post("/", is_loggedin_1.isLoggedIn, (0, check_permissions_1.checkPermission)("project:create"), project_validations_1.validateCreateProject, (0, async_handler_1.asyncHandler)(project_controller_1.createProject));
router.get("/", is_loggedin_1.isLoggedIn, (0, check_permissions_1.checkPermission)("project:read"), (0, async_handler_1.asyncHandler)(project_controller_1.viewProjects));
router.get("/:projectId", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:view"), project_validations_1.validateProjectId, (0, async_handler_1.asyncHandler)(project_controller_1.viewProject));
router.patch("/:projectId", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:update"), project_validations_1.validateProjectId, project_validations_1.validateUpdateProject, (0, async_handler_1.asyncHandler)(project_controller_1.updateProject));
router.delete("/:projectId", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:delete"), project_validations_1.validateProjectId, (0, async_handler_1.asyncHandler)(project_controller_1.deleteProject));
// Project Members
router.get("/:projectId/members", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:view"), project_validations_1.validateProjectId, (0, async_handler_1.asyncHandler)(project_controller_1.getProjectMembers));
router.post("/:projectId/members", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("member:add"), project_validations_1.validateProjectId, project_validations_1.validateAddProjectMember, (0, async_handler_1.asyncHandler)(project_controller_1.addProjectMember));
router.delete("/:projectId/members/:memberId", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("member:remove"), project_validations_1.validateProjectMemberParams, (0, async_handler_1.asyncHandler)(project_controller_1.removeProjectMember));
router.patch("/:projectId/members/:memberId", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("member:role:update"), project_validations_1.validateProjectMemberParams, project_validations_1.validateUpdateProjectMemberRole, (0, async_handler_1.asyncHandler)(project_controller_1.updateProjectMemberRole));
// Labels
router.get("/:projectId/labels", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:view"), (0, async_handler_1.asyncHandler)(project_settings_controller_1.getProjectLabels));
router.post("/:projectId/labels", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:update"), (0, async_handler_1.asyncHandler)(project_settings_controller_1.createProjectLabel));
router.delete("/:projectId/labels/:labelId", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:update"), (0, async_handler_1.asyncHandler)(project_settings_controller_1.deleteProjectLabel));
// Workflows
router.get("/:projectId/workflow", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:view"), project_validations_1.validateProjectId, (0, async_handler_1.asyncHandler)(project_settings_controller_1.getProjectWorkflow));
router.post("/:projectId/workflow", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:update"), project_validations_1.validateProjectId, (0, async_handler_1.asyncHandler)(project_settings_controller_1.saveProjectWorkflow));
router.put("/:projectId/workflow", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:update"), project_validations_1.validateProjectId, (0, async_handler_1.asyncHandler)(project_settings_controller_1.saveProjectWorkflow));
// Audit Logs
router.post("/audit-logs", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("task:update"), (0, async_handler_1.asyncHandler)(auditlog_controller_1.createAuditLog));
router.get("/:projectId/audit-logs", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:view"), (0, async_handler_1.asyncHandler)(auditlog_controller_1.getProjectAuditLogs));
router.post("/:projectId/audit-logs", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:update"), (0, async_handler_1.asyncHandler)(auditlog_controller_1.createAuditLog));
router.post("/:projectId/audit-logs/:logId/undo", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:update"), (0, async_handler_1.asyncHandler)(auditlog_controller_1.undoAuditLog));
router.post("/audit-logs/:logId/undo", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("project:update"), (0, async_handler_1.asyncHandler)(auditlog_controller_1.undoAuditLog));
exports.default = router;
