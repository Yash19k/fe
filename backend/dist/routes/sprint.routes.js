"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sprint_controller_1 = require("../controllers/sprint.controller");
const is_loggedin_1 = require("../middleware/is.loggedin");
const sprint_validate_1 = require("../middleware/sprint.validate");
const project_permission_1 = require("../middleware/project.permission");
const async_handler_1 = require("../middleware/async.handler");
const project_validations_1 = require("../validations/project.validations");
const router = (0, express_1.Router)();
// Create a sprint and optionally attach existing backlog work items
router.post("/projects/:projectId/sprints", is_loggedin_1.isLoggedIn, project_validations_1.validateProjectId, (0, project_permission_1.requireProjectPermission)("sprint:create"), sprint_validate_1.validateCreateSprint, (0, async_handler_1.asyncHandler)(sprint_controller_1.createSprint));
// Get all sprints for a project
router.get("/projects/:projectId/sprints", is_loggedin_1.isLoggedIn, project_validations_1.validateProjectId, (0, project_permission_1.requireProjectPermission)("sprint:view"), (0, async_handler_1.asyncHandler)(sprint_controller_1.getProjectSprints));
// Get a sprint by ID
router.get("/projects/:projectId/sprints/:sprintId", is_loggedin_1.isLoggedIn, project_validations_1.validateProjectId, (0, project_permission_1.requireProjectPermission)("sprint:view"), (0, async_handler_1.asyncHandler)(sprint_controller_1.getSprintById));
// Update sprint details
router.patch("/projects/:projectId/sprints/:sprintId", is_loggedin_1.isLoggedIn, project_validations_1.validateProjectId, (0, project_permission_1.requireProjectPermission)("sprint:update"), sprint_validate_1.validateUpdateSprint, (0, async_handler_1.asyncHandler)(sprint_controller_1.updateSprint));
// Start an active sprint
router.post("/projects/:projectId/sprints/:sprintId/start", is_loggedin_1.isLoggedIn, project_validations_1.validateProjectId, (0, project_permission_1.requireProjectPermission)("sprint:update"), (0, async_handler_1.asyncHandler)(sprint_controller_1.startSprint));
// Complete an active sprint
router.post("/projects/:projectId/sprints/:sprintId/complete", is_loggedin_1.isLoggedIn, project_validations_1.validateProjectId, (0, project_permission_1.requireProjectPermission)("sprint:update"), (0, async_handler_1.asyncHandler)(sprint_controller_1.completeSprint));
// Delete a sprint (unlinks associated work items without deleting them)
router.delete("/projects/:projectId/sprints/:sprintId", is_loggedin_1.isLoggedIn, project_validations_1.validateProjectId, (0, project_permission_1.requireProjectPermission)("sprint:delete"), (0, async_handler_1.asyncHandler)(sprint_controller_1.deleteSprint));
exports.default = router;
