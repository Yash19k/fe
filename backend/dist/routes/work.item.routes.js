"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const work_item_validations_1 = require("../validations/work.item.validations");
const is_loggedin_1 = require("../middleware/is.loggedin");
const task_controller_1 = require("../controllers/task.controller");
const work_item_collaboration_controller_1 = require("../controllers/work-item-collaboration.controller");
const async_handler_1 = require("../middleware/async.handler");
const project_permission_1 = require("../middleware/project.permission");
const work_item_attachment_upload_middleware_1 = require("../middleware/work.item.attachment.upload.middleware");
const router = (0, express_1.Router)();
router.post("/", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("task:create"), work_item_validations_1.validateCreateWorkItem, (0, async_handler_1.asyncHandler)(task_controller_1.createWorkItem));
router.patch("/:workItemId", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("task:update"), work_item_validations_1.validateUpdateWorkItem, (0, async_handler_1.asyncHandler)(task_controller_1.updateWorkItem));
router.post("/:workItemId/attachments", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("task:update"), work_item_attachment_upload_middleware_1.uploadWorkItemAttachments, (0, async_handler_1.asyncHandler)(task_controller_1.uploadAttachmentsToWorkItem));
router.patch("/:workItemId/escalate", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("sla:manage"), (0, async_handler_1.asyncHandler)(task_controller_1.escalateWorkItem));
router.get("/:workItemId/sla", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("sla:view"), (0, async_handler_1.asyncHandler)(task_controller_1.getWorkItemSla));
router.get("/:workItemId/sla/audit", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("sla:audit"), (0, async_handler_1.asyncHandler)(task_controller_1.getWorkItemSlaAudit));
router.post("/:workItemId/escalate/resolve", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("sla:resolve"), (0, async_handler_1.asyncHandler)(task_controller_1.resolveWorkItemEscalation));
router.delete("/:workItemId", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("task:delete"), (0, async_handler_1.asyncHandler)(task_controller_1.deleteWorkItem));
router.get("/project/:projectId", is_loggedin_1.isLoggedIn, (0, project_permission_1.requireProjectPermission)("task:read"), work_item_validations_1.validateViewProjectWorkItems, (0, async_handler_1.asyncHandler)(task_controller_1.getProjectWorkItems));
// Comments
router.post("/:workItemId/comments", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("task:update"), (0, async_handler_1.asyncHandler)(work_item_collaboration_controller_1.addWorkItemComment));
router.get("/:workItemId/comments", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("task:read"), (0, async_handler_1.asyncHandler)(work_item_collaboration_controller_1.getWorkItemComments));
// Time Entries
router.post("/:workItemId/time-entries", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("task:update"), (0, async_handler_1.asyncHandler)(work_item_collaboration_controller_1.addWorkItemTimeEntry));
router.get("/:workItemId/time-entries", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("task:read"), (0, async_handler_1.asyncHandler)(work_item_collaboration_controller_1.getWorkItemTimeEntries));
// Dependencies
router.post("/:workItemId/dependencies", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("task:update"), work_item_validations_1.validateWorkItemDependencyBody, (0, async_handler_1.asyncHandler)(work_item_collaboration_controller_1.addWorkItemDependency));
router.get("/:workItemId/dependencies", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemId, (0, project_permission_1.requireProjectPermission)("task:read"), (0, async_handler_1.asyncHandler)(work_item_collaboration_controller_1.getWorkItemDependencies));
router.delete("/:workItemId/dependencies/:depId", is_loggedin_1.isLoggedIn, work_item_validations_1.validateWorkItemDependencyParams, (0, project_permission_1.requireProjectPermission)("task:update"), (0, async_handler_1.asyncHandler)(work_item_collaboration_controller_1.deleteWorkItemDependency));
exports.default = router;
