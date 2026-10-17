import { Router } from "express";
import {
  createProject,
  viewProject,
  viewProjects,
  updateProject,
  deleteProject,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
} from "../controllers/project.controller";
import {
  validateCreateProject,
  validateUpdateProject,
  validateProjectId,
  validateAddProjectMember,
  validateProjectMemberParams,
  validateUpdateProjectMemberRole,
} from "../validations/project.validations";
import { isLoggedIn } from "../middleware/is.loggedin";
import { asyncHandler } from "../middleware/async.handler";
import { checkPermission } from "../middleware/check.permissions";

const router = Router();

router.post(
  "/",
  isLoggedIn,
  checkPermission("project:create"),
  validateCreateProject,
  asyncHandler(createProject),
);

router.get(
  "/",
  isLoggedIn,
  checkPermission("project:read"),
  asyncHandler(viewProjects),
);

router.get(
  "/:projectId",
  isLoggedIn,
  checkPermission("project:read"),
  validateProjectId,
  asyncHandler(viewProject),
);

router.patch(
  "/:projectId",
  isLoggedIn,
  checkPermission("project:update"),
  validateProjectId,
  validateUpdateProject,
  asyncHandler(updateProject),
);

router.delete(
  "/:projectId",
  isLoggedIn,
  checkPermission("project:delete"),
  validateProjectId,
  asyncHandler(deleteProject),
);

router.get(
  "/:projectId/members",
  isLoggedIn,
  checkPermission("project:read"),
  validateProjectId,
  asyncHandler(getProjectMembers),
);

router.post(
  "/:projectId/members",
  isLoggedIn,
  checkPermission("project:member:manage"),
  validateProjectId,
  validateAddProjectMember,
  asyncHandler(addProjectMember),
);

router.delete(
  "/:projectId/members/:memberId",
  isLoggedIn,
  checkPermission("project:member:manage"),
  validateProjectMemberParams,
  asyncHandler(removeProjectMember),
);

router.patch(
  "/:projectId/members/:memberId",
  isLoggedIn,
  checkPermission("project:member:manage"),
  validateProjectMemberParams,
  validateUpdateProjectMemberRole,
  asyncHandler(updateProjectMemberRole),
);

export default router;
