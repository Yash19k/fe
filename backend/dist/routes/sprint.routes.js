"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sprint_controller_1 = require("../controllers/sprint.controller");
const is_loggedin_1 = require("../middleware/is.loggedin");
const sprint_validate_1 = require("../middleware/sprint.validate");
const check_permissions_1 = require("../middleware/check.permissions");
const async_handler_1 = require("../middleware/async.handler");
const project_validations_1 = require("../validations/project.validations");
const router = (0, express_1.Router)();
// Create a sprint and optionally create work items inside it
router.post("/projects/:projectId/sprints", is_loggedin_1.isLoggedIn, (0, check_permissions_1.checkPermission)("task:create"), project_validations_1.validateProjectId, sprint_validate_1.validateCreateSprint, (0, async_handler_1.asyncHandler)(sprint_controller_1.createSprint));
// Get all sprints for a project
router.get("/projects/:projectId/sprints", is_loggedin_1.isLoggedIn, (0, check_permissions_1.checkPermission)("task:read"), project_validations_1.validateProjectId, (0, async_handler_1.asyncHandler)(sprint_controller_1.getProjectSprints));
exports.default = router;
