"use strict";
/**
 * Feature Persistence Controller Facade
 *
 * This controller re-exports logically separated handlers for:
 * - Work Item Collaboration (Comments, Time Entries, Dependencies) -> work-item-collaboration.controller.ts
 * - Project Settings (Labels, Workflows) -> project-settings.controller.ts
 * - Audit Logs -> auditlog.controller.ts
 * - Notifications -> notification.controller.ts
 *
 * This preserves full backward compatibility for existing imports while maintaining
 * a clean separation of concerns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllNotificationsRead = exports.markNotificationRead = exports.getUserNotifications = exports.undoAuditLog = exports.createAuditLog = exports.getProjectAuditLogs = exports.DEFAULT_WORKFLOW_STATUSES = exports.DEFAULT_WORKFLOW_NAME = exports.saveProjectWorkflow = exports.getProjectWorkflow = exports.deleteProjectLabel = exports.createProjectLabel = exports.getProjectLabels = exports.deleteWorkItemDependency = exports.getWorkItemDependencies = exports.addWorkItemDependency = exports.getWorkItemTimeEntries = exports.addWorkItemTimeEntry = exports.getWorkItemComments = exports.addWorkItemComment = void 0;
var work_item_collaboration_controller_1 = require("./work-item-collaboration.controller");
Object.defineProperty(exports, "addWorkItemComment", { enumerable: true, get: function () { return work_item_collaboration_controller_1.addWorkItemComment; } });
Object.defineProperty(exports, "getWorkItemComments", { enumerable: true, get: function () { return work_item_collaboration_controller_1.getWorkItemComments; } });
Object.defineProperty(exports, "addWorkItemTimeEntry", { enumerable: true, get: function () { return work_item_collaboration_controller_1.addWorkItemTimeEntry; } });
Object.defineProperty(exports, "getWorkItemTimeEntries", { enumerable: true, get: function () { return work_item_collaboration_controller_1.getWorkItemTimeEntries; } });
Object.defineProperty(exports, "addWorkItemDependency", { enumerable: true, get: function () { return work_item_collaboration_controller_1.addWorkItemDependency; } });
Object.defineProperty(exports, "getWorkItemDependencies", { enumerable: true, get: function () { return work_item_collaboration_controller_1.getWorkItemDependencies; } });
Object.defineProperty(exports, "deleteWorkItemDependency", { enumerable: true, get: function () { return work_item_collaboration_controller_1.deleteWorkItemDependency; } });
var project_settings_controller_1 = require("./project-settings.controller");
Object.defineProperty(exports, "getProjectLabels", { enumerable: true, get: function () { return project_settings_controller_1.getProjectLabels; } });
Object.defineProperty(exports, "createProjectLabel", { enumerable: true, get: function () { return project_settings_controller_1.createProjectLabel; } });
Object.defineProperty(exports, "deleteProjectLabel", { enumerable: true, get: function () { return project_settings_controller_1.deleteProjectLabel; } });
Object.defineProperty(exports, "getProjectWorkflow", { enumerable: true, get: function () { return project_settings_controller_1.getProjectWorkflow; } });
Object.defineProperty(exports, "saveProjectWorkflow", { enumerable: true, get: function () { return project_settings_controller_1.saveProjectWorkflow; } });
Object.defineProperty(exports, "DEFAULT_WORKFLOW_NAME", { enumerable: true, get: function () { return project_settings_controller_1.DEFAULT_WORKFLOW_NAME; } });
Object.defineProperty(exports, "DEFAULT_WORKFLOW_STATUSES", { enumerable: true, get: function () { return project_settings_controller_1.DEFAULT_WORKFLOW_STATUSES; } });
var auditlog_controller_1 = require("./auditlog.controller");
Object.defineProperty(exports, "getProjectAuditLogs", { enumerable: true, get: function () { return auditlog_controller_1.getProjectAuditLogs; } });
Object.defineProperty(exports, "createAuditLog", { enumerable: true, get: function () { return auditlog_controller_1.createAuditLog; } });
Object.defineProperty(exports, "undoAuditLog", { enumerable: true, get: function () { return auditlog_controller_1.undoAuditLog; } });
var notification_controller_1 = require("./notification.controller");
Object.defineProperty(exports, "getUserNotifications", { enumerable: true, get: function () { return notification_controller_1.getUserNotifications; } });
Object.defineProperty(exports, "markNotificationRead", { enumerable: true, get: function () { return notification_controller_1.markNotificationRead; } });
Object.defineProperty(exports, "markAllNotificationsRead", { enumerable: true, get: function () { return notification_controller_1.markAllNotificationsRead; } });
