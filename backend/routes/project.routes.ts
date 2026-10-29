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
  getProjectLabels,
  createProjectLabel,
  deleteProjectLabel,
  getProjectWorkflow,
  saveProjectWorkflow,
} from "../controllers/project-settings.controller";
import {
  getProjectAuditLogs,
  createAuditLog,
  undoAuditLog,
} from "../controllers/auditlog.controller";
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
import { requireProjectPermission } from "../middleware/project.permission";

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
  requireProjectPermission("project:view"),
  validateProjectId,
  asyncHandler(viewProject),
);

router.patch(
  "/:projectId",
  isLoggedIn,
  requireProjectPermission("project:update"),
  validateProjectId,
  validateUpdateProject,
  asyncHandler(updateProject),
);

router.delete(
  "/:projectId",
  isLoggedIn,
  requireProjectPermission("project:delete"),
  validateProjectId,
  asyncHandler(deleteProject),
);

// Project Members
router.get(
  "/:projectId/members",
  isLoggedIn,
  requireProjectPermission("project:view"),
  validateProjectId,
  asyncHandler(getProjectMembers),
);

router.post(
  "/:projectId/members",
  isLoggedIn,
  requireProjectPermission("member:add"),
  validateProjectId,
  validateAddProjectMember,
  asyncHandler(addProjectMember),
);

router.delete(
  "/:projectId/members/:memberId",
  isLoggedIn,
  requireProjectPermission("member:remove"),
  validateProjectMemberParams,
  asyncHandler(removeProjectMember),
);

router.patch(
  "/:projectId/members/:memberId",
  isLoggedIn,
  requireProjectPermission("member:role:update"),
  validateProjectMemberParams,
  validateUpdateProjectMemberRole,
  asyncHandler(updateProjectMemberRole),
);

// Labels
router.get(
  "/:projectId/labels",
  isLoggedIn,
  requireProjectPermission("project:view"),
  asyncHandler(getProjectLabels),
);
router.post(
  "/:projectId/labels",
  isLoggedIn,
  requireProjectPermission("project:update"),
  asyncHandler(createProjectLabel),
);
router.delete(
  "/:projectId/labels/:labelId",
  isLoggedIn,
  requireProjectPermission("project:update"),
  asyncHandler(deleteProjectLabel),
);

// Workflows
router.get(
  "/:projectId/workflow",
  isLoggedIn,
  requireProjectPermission("project:view"),
  validateProjectId,
  asyncHandler(getProjectWorkflow),
);
router.post(
  "/:projectId/workflow",
  isLoggedIn,
  requireProjectPermission("project:update"),
  validateProjectId,
  asyncHandler(saveProjectWorkflow),
);
router.put(
  "/:projectId/workflow",
  isLoggedIn,
  requireProjectPermission("project:update"),
  validateProjectId,
  asyncHandler(saveProjectWorkflow),
);

// Audit Logs
router.post(
  "/audit-logs",
  isLoggedIn,
  requireProjectPermission("task:update"),
  asyncHandler(createAuditLog),
);
router.get(
  "/:projectId/audit-logs",
  isLoggedIn,
  requireProjectPermission("project:view"),
  asyncHandler(getProjectAuditLogs),
);
router.post(
  "/:projectId/audit-logs",
  isLoggedIn,
  requireProjectPermission("project:update"),
  asyncHandler(createAuditLog),
);
router.post(
  "/:projectId/audit-logs/:logId/undo",
  isLoggedIn,
  requireProjectPermission("project:update"),
  asyncHandler(undoAuditLog),
);
router.post(
  "/audit-logs/:logId/undo",
  isLoggedIn,
  requireProjectPermission("project:update"),
  asyncHandler(undoAuditLog),
);

export default router;
