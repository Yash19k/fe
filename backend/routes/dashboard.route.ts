import { Router } from "express";
import { getProjectDashboard, getPersonalDashboard } from "../controllers/dashboard.controller";
import { isLoggedIn } from "../middleware/is.loggedin";
import { requireProjectPermission } from "../middleware/project.permission";
import { asyncHandler } from "../middleware/async.handler";
import { validateProjectId } from "../validations/project.validations";
import { validateUuidRouteParam } from "../validations/route-params";

const router = Router();

router.param("projectId", validateUuidRouteParam);

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