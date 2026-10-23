import { Router } from "express";
import {
  validateCreateWorkItem,
  validateUpdateWorkItem,
  validateViewProjectWorkItems,
} from "../validations/work.item.validations";

import { isLoggedIn } from "../middleware/is.loggedin";

import {
  createWorkItem,
  deleteWorkItem,
  getProjectWorkItems,
  updateWorkItem,
  escalateWorkItem,
  getWorkItemSla,
  getWorkItemSlaAudit,
  resolveWorkItemEscalation,
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
  requireProjectPermission("task:update"),
  validateUpdateWorkItem,
  asyncHandler(updateWorkItem)
);

router.patch(
  "/:workItemId/escalate",
  isLoggedIn,
  requireProjectPermission("sla:manage"),
  asyncHandler(escalateWorkItem),
);

router.get(
  "/:workItemId/sla",
  isLoggedIn,
  requireProjectPermission("sla:view"),
  asyncHandler(getWorkItemSla),
);

router.get(
  "/:workItemId/sla/audit",
  isLoggedIn,
  requireProjectPermission("sla:audit"),
  asyncHandler(getWorkItemSlaAudit),
);

router.post(
  "/:workItemId/escalate/resolve",
  isLoggedIn,
  requireProjectPermission("sla:resolve"),
  asyncHandler(resolveWorkItemEscalation),
);

router.delete(
  "/:workItemId",
  isLoggedIn,
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
  asyncHandler(addWorkItemComment)
);
router.get(
  "/:workItemId/comments",
  isLoggedIn,
  asyncHandler(getWorkItemComments)
);

// Time Entries
router.post(
  "/:workItemId/time-entries",
  isLoggedIn,
  asyncHandler(addWorkItemTimeEntry)
);
router.get(
  "/:workItemId/time-entries",
  isLoggedIn,
  asyncHandler(getWorkItemTimeEntries)
);

// Dependencies
router.post(
  "/:workItemId/dependencies",
  isLoggedIn,
  asyncHandler(addWorkItemDependency)
);
router.get(
  "/:workItemId/dependencies",
  isLoggedIn,
  asyncHandler(getWorkItemDependencies)
);
router.delete(
  "/:workItemId/dependencies/:depId",
  isLoggedIn,
  asyncHandler(deleteWorkItemDependency)
);

export default router;