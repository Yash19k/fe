"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const is_loggedin_1 = require("../middleware/is.loggedin");
const project_permission_1 = require("../middleware/project.permission");
const async_handler_1 = require("../middleware/async.handler");
const controller = __importStar(require("../controllers/whiteboard.controller"));
const whiteboard_validation_1 = require("../validations/whiteboard.validation");
const router = (0, express_1.Router)();
router.post("/projects/:projectId/whiteboards", is_loggedin_1.isLoggedIn, whiteboard_validation_1.validateProjectWhiteboardParams, whiteboard_validation_1.validateCreateWhiteboard, (0, project_permission_1.requireProjectPermission)("project:update"), (0, async_handler_1.asyncHandler)(controller.createWhiteboard));
router.get("/projects/:projectId/whiteboards", is_loggedin_1.isLoggedIn, whiteboard_validation_1.validateProjectWhiteboardParams, whiteboard_validation_1.validateListWhiteboards, (0, project_permission_1.requireProjectPermission)("project:view"), (0, async_handler_1.asyncHandler)(controller.listWhiteboards));
router.get("/whiteboards/:whiteboardId", is_loggedin_1.isLoggedIn, whiteboard_validation_1.validateWhiteboardParams, (0, project_permission_1.requireProjectPermission)("project:view"), (0, async_handler_1.asyncHandler)(controller.getWhiteboard));
router.get("/whiteboards/:whiteboardId/revisions", is_loggedin_1.isLoggedIn, whiteboard_validation_1.validateWhiteboardParams, whiteboard_validation_1.validateListWhiteboards, (0, project_permission_1.requireProjectPermission)("project:view"), (0, async_handler_1.asyncHandler)(controller.listWhiteboardRevisions));
router.get("/whiteboards/:whiteboardId/revisions/:revisionNumber", is_loggedin_1.isLoggedIn, whiteboard_validation_1.validateWhiteboardRevisionParams, (0, project_permission_1.requireProjectPermission)("project:view"), (0, async_handler_1.asyncHandler)(controller.getWhiteboardRevision));
router.patch("/whiteboards/:whiteboardId", is_loggedin_1.isLoggedIn, whiteboard_validation_1.validateWhiteboardParams, whiteboard_validation_1.validateUpdateWhiteboard, (0, project_permission_1.requireProjectPermission)("project:update"), (0, async_handler_1.asyncHandler)(controller.updateWhiteboard));
router.patch("/whiteboards/:whiteboardId/name", is_loggedin_1.isLoggedIn, whiteboard_validation_1.validateWhiteboardParams, whiteboard_validation_1.validateRenameWhiteboard, (0, project_permission_1.requireProjectPermission)("project:update"), (0, async_handler_1.asyncHandler)(controller.renameWhiteboard));
router.delete("/whiteboards/:whiteboardId", is_loggedin_1.isLoggedIn, whiteboard_validation_1.validateWhiteboardParams, (0, project_permission_1.requireProjectPermission)("project:delete"), (0, async_handler_1.asyncHandler)(controller.deleteWhiteboard));
exports.default = router;
