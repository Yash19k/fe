import { Router } from "express";
import { getProjectDashboard, getPersonalDashboard } from "../controllers/dashboard.controller";
import { isLoggedIn } from "../middleware/is.loggedin";
import { requireProjectPermission } from "../middleware/project.permission";
import { asyncHandler } from "../middleware/async.handler";
import { validateProjectId } from "../validations/project.validations";

const router = Router();

router.get(
  "/dashboard/personal",
  isLoggedIn,
  asyncHandler(getPersonalDashboard)
);

router.get(
  "/projects/:projectId/dashboard",
  isLoggedIn,
  validateProjectId,
  requireProjectPermission("project:view"),
  asyncHandler(getProjectDashboard)
);

export default router;