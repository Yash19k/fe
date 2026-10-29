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

export {
  addWorkItemComment,
  getWorkItemComments,
  addWorkItemTimeEntry,
  getWorkItemTimeEntries,
  addWorkItemDependency,
  getWorkItemDependencies,
  deleteWorkItemDependency,
} from "./work-item-collaboration.controller";

export {
  getProjectLabels,
  createProjectLabel,
  deleteProjectLabel,
  getProjectWorkflow,
  saveProjectWorkflow,
  DEFAULT_WORKFLOW_NAME,
  DEFAULT_WORKFLOW_STATUSES,
} from "./project-settings.controller";

export {
  getProjectAuditLogs,
  createAuditLog,
  undoAuditLog,
} from "./auditlog.controller";

export {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./notification.controller";
