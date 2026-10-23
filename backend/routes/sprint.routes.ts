import { Router } from "express";

import { createSprint, getProjectSprints } from "../controllers/sprint.controller";
import { isLoggedIn } from "../middleware/is.loggedin";
import { validateCreateSprint } from "../middleware/sprint.validate"
import { checkPermission } from "../middleware/check.permissions";
import { asyncHandler } from "../middleware/async.handler";
import { validateProjectId } from "../validations/project.validations";
const router = Router();

// Create a sprint and optionally attach existing backlog work items
router.post(
  "/projects/:projectId/sprints",
  isLoggedIn, checkPermission("task:create"), validateProjectId,
  validateCreateSprint,
  asyncHandler(createSprint)
);

// Get all sprints for a project
router.get(
  "/projects/:projectId/sprints",
  isLoggedIn, checkPermission("task:read"), validateProjectId,
  asyncHandler(getProjectSprints)
);

export default router;