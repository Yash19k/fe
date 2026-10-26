import { Router } from "express";
import {
  validateCreateWorkItem,
  validateUpdateWorkItem,
  validateViewProjectWorkItems,
  validateWorkItemId,
  validateWorkItemDependencyParams,
  validateWorkItemDependencyBody,
} from "../validations/work.item.validations";

import { isLoggedIn } from "../middleware/is.loggedin";
import { undoAuditLog } from "../controllers/auditlog.controller";
import {
  createWorkItem,
  deleteWorkItem,
  getProjectWorkItems,
  updateWorkItem,
  escalateWorkItem,
  getWorkItemSla,
  getWorkItemSlaAudit,
  resolveWorkItemEscalation,
  uploadAttachmentsToWorkItem,
} from "../controllers/task.controller";
import {
  addWorkItemComment,
  getWorkItemComments,
  addWorkItemTimeEntry,
  getWorkItemTimeEntries,
  addWorkItemDependency,
  getWorkItemDependencies,
  deleteWorkItemDependency,
 
} from "../controllers/feature-persistence.controller";
import { asyncHandler } from "../middleware/async.handler";
import { requireProjectPermission } from "../middleware/project.permission";
import { uploadWorkItemAttachments } from "../middleware/work.item.attachment.upload.middleware";

const router = Router();

router.post(
  "/",
  isLoggedIn,
  requireProjectPermission("task:create"),
  validateCreateWorkItem,
  asyncHandler(createWorkItem)
);

router.patch(
  "/:workItemId",
  isLoggedIn,
  validateWorkItemId,
  requireProjectPermission("task:update"),
  validateUpdateWorkItem,
  asyncHandler(updateWorkItem)
);

router.post(
  "/:workItemId/attachments",
  isLoggedIn,
  validateWorkItemId,
  requireProjectPermission("task:update"),
  uploadWorkItemAttachments,
  asyncHandler(uploadAttachmentsToWorkItem)
);

router.patch(
  "/:workItemId/escalate",
  isLoggedIn,
  validateWorkItemId,
  requireProjectPermission("sla:manage"),
  asyncHandler(escalateWorkItem),
);

router.get(
  "/:workItemId/sla",
  isLoggedIn,
  validateWorkItemId,
  requireProjectPermission("sla:view"),
  asyncHandler(getWorkItemSla),
);

router.get(
  "/:workItemId/sla/audit",
  isLoggedIn,
  validateWorkItemId,
  requireProjectPermission("sla:audit"),
  asyncHandler(getWorkItemSlaAudit),
);

router.post(
  "/:workItemId/escalate/resolve",
  isLoggedIn,
  validateWorkItemId,
  requireProjectPermission("sla:resolve"),
  asyncHandler(resolveWorkItemEscalation),
);

router.delete(
  "/:workItemId",
  isLoggedIn,
  validateWorkItemId,
  requireProjectPermission("task:delete"),
  asyncHandler(deleteWorkItem)
);

router.get(
  "/project/:projectId",
  isLoggedIn,
  requireProjectPermission("task:read"),
  validateViewProjectWorkItems,
  asyncHandler(getProjectWorkItems)
);

// Comments
router.post(
  "/:workItemId/comments",
  isLoggedIn,
  validateWorkItemId,
  asyncHandler(addWorkItemComment)
);
router.get(
  "/:workItemId/comments",
  isLoggedIn,
  validateWorkItemId,
  asyncHandler(getWorkItemComments)
);

// Time Entries
router.post(
  "/:workItemId/time-entries",
  isLoggedIn,
  validateWorkItemId,
  asyncHandler(addWorkItemTimeEntry)
);
router.get(
  "/:workItemId/time-entries",
  isLoggedIn,
  validateWorkItemId,
  asyncHandler(getWorkItemTimeEntries)
);

// Dependencies
router.post(
  "/:workItemId/dependencies",
  isLoggedIn,
  validateWorkItemId,
  validateWorkItemDependencyBody,
  asyncHandler(addWorkItemDependency)
);
router.get(
  "/:workItemId/dependencies",
  isLoggedIn,
  validateWorkItemId,
  asyncHandler(getWorkItemDependencies)
);
router.delete(
  "/:workItemId/dependencies/:depId",
  isLoggedIn,
  validateWorkItemDependencyParams,
  asyncHandler(deleteWorkItemDependency)
);
// router.post("/:logId/undo", isLoggedIn, asyncHandler(undoAuditLog));
export default router;