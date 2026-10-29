import { Router } from "express";

import {
  createSprint,
  getProjectSprints,
  getSprintById,
  updateSprint,
  startSprint,
  completeSprint,
  deleteSprint,
} from "../controllers/sprint.controller";
import { isLoggedIn } from "../middleware/is.loggedin";
import {
  validateCreateSprint,
  validateUpdateSprint,
} from "../middleware/sprint.validate";
import { requireProjectPermission } from "../middleware/project.permission";
import { asyncHandler } from "../middleware/async.handler";
import { validateProjectId } from "../validations/project.validations";

const router = Router();

// Create a sprint and optionally attach existing backlog work items
router.post(
  "/projects/:projectId/sprints",
  isLoggedIn,
  validateProjectId,
  requireProjectPermission("sprint:create"),
  validateCreateSprint,
  asyncHandler(createSprint)
);

// Get all sprints for a project
router.get(
  "/projects/:projectId/sprints",
  isLoggedIn,
  validateProjectId,
  requireProjectPermission("sprint:view"),
  asyncHandler(getProjectSprints)
);

// Get a sprint by ID
router.get(
  "/projects/:projectId/sprints/:sprintId",
  isLoggedIn,
  validateProjectId,
  requireProjectPermission("sprint:view"),
  asyncHandler(getSprintById)
);

// Update sprint details
router.patch(
  "/projects/:projectId/sprints/:sprintId",
  isLoggedIn,
  validateProjectId,
  requireProjectPermission("sprint:update"),
  validateUpdateSprint,
  asyncHandler(updateSprint)
);

// Start an active sprint
router.post(
  "/projects/:projectId/sprints/:sprintId/start",
  isLoggedIn,
  validateProjectId,
  requireProjectPermission("sprint:update"),
  asyncHandler(startSprint)
);

// Complete an active sprint
router.post(
  "/projects/:projectId/sprints/:sprintId/complete",
  isLoggedIn,
  validateProjectId,
  requireProjectPermission("sprint:update"),
  asyncHandler(completeSprint)
);

// Delete a sprint (unlinks associated work items without deleting them)
router.delete(
  "/projects/:projectId/sprints/:sprintId",
  isLoggedIn,
  validateProjectId,
  requireProjectPermission("sprint:delete"),
  asyncHandler(deleteSprint)
);

export default router;