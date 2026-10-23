"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const work_item_validations_1 = require("../validations/work.item.validations");
const is_loggedin_1 = require("../middleware/is.loggedin");
const task_controller_1 = require("../controllers/task.controller");
const feature_persistence_controller_1 = require("../controllers/feature-persistence.controller");
const async_handler_1 = require("../middleware/async.handler");
const project_permission_1 = require("../middleware/project.permission");
const router = (0, express_1.Router)();
router.post("/", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("task:create"), work_item_validations_1.validateCreateWorkItem, (0, async_handler_1.asyncHandler)(task_controller_1.createWorkItem));
router.patch("/:workItemId", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("task:update"), work_item_validations_1.validateUpdateWorkItem, (0, async_handler_1.asyncHandler)(task_controller_1.updateWorkItem));
router.delete("/:workItemId", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("task:delete"), (0, async_handler_1.asyncHandler)(task_controller_1.deleteWorkItem));
router.get("/project/:projectId", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("task:read"), work_item_validations_1.validateViewProjectWorkItems, (0, async_handler_1.asyncHandler)(task_controller_1.getProjectWorkItems));
// Comments
router.post("/:workItemId/comments", is_loggedin_1.isLoggedIn, (0, async_handler_1.asyncHandler)(feature_persistence_controller_1.addWorkItemComment));
router.get("/:workItemId/comments", is_loggedin_1.isLoggedIn, (0, async_handler_1.asyncHandler)(feature_persistence_controller_1.getWorkItemComments));
// Time Entries
router.post("/:workItemId/time-entries", is_loggedin_1.isLoggedIn, (0, async_handler_1.asyncHandler)(feature_persistence_controller_1.addWorkItemTimeEntry));
router.get("/:workItemId/time-entries", is_loggedin_1.isLoggedIn, (0, async_handler_1.asyncHandler)(feature_persistence_controller_1.getWorkItemTimeEntries));
// Dependencies
router.post("/:workItemId/dependencies", is_loggedin_1.isLoggedIn, (0, async_handler_1.asyncHandler)(feature_persistence_controller_1.addWorkItemDependency));
router.get("/:workItemId/dependencies", is_loggedin_1.isLoggedIn, (0, async_handler_1.asyncHandler)(feature_persistence_controller_1.getWorkItemDependencies));
router.delete("/:workItemId/dependencies/:depId", is_loggedin_1.isLoggedIn, (0, async_handler_1.asyncHandler)(feature_persistence_controller_1.deleteWorkItemDependency));
exports.default = router;
