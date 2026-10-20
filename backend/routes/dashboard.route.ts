import { Router } from "express";
import { getProjectDashboard } from "../controllers/dashboard.controller";
import { isLoggedIn } from "../middleware/is.loggedin";
import { checkPermission } from "../middleware/check.permissions";
import { asyncHandler } from "../middleware/async.handler";
import { validateProjectId } from "../validations/project.validations";


const router = Router();

router.get(
  "/projects/:projectId/dashboard",
  isLoggedIn,
  checkPermission("project:read"),
  validateProjectId,
  asyncHandler(getProjectDashboard)
);

export default router;