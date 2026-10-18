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
} from "../controllers/task.controller";
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

export default router;