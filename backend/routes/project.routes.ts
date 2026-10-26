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
  getProjectAuditLogs,
  createAuditLog,

} from "../controllers/feature-persistence.controller";
import { undoAuditLog } from "../controllers/auditlog.controller";
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

// Labels
router.get(
  "/:projectId/labels",
  isLoggedIn,
  asyncHandler(getProjectLabels),
);
router.post(
  "/:projectId/labels",
  isLoggedIn,
  asyncHandler(createProjectLabel),
);
router.delete(
  "/:projectId/labels/:labelId",
  isLoggedIn,
  asyncHandler(deleteProjectLabel),
);

// Workflows
router.get(
  "/:projectId/workflow",
  isLoggedIn,
  checkPermission("project:read"),
  validateProjectId,
  asyncHandler(getProjectWorkflow),
);
router.post(
  "/:projectId/workflow",
  isLoggedIn,
  checkPermission("project:update"),
  validateProjectId,
  asyncHandler(saveProjectWorkflow),
);
router.put(
  "/:projectId/workflow",
  isLoggedIn,
  checkPermission("project:update"),
  validateProjectId,
  asyncHandler(saveProjectWorkflow),
);

// Audit Logs
router.post(
  "/audit-logs",
  isLoggedIn,
  asyncHandler(createAuditLog),
);
router.get(
  "/:projectId/audit-logs",
  isLoggedIn,
  asyncHandler(getProjectAuditLogs),
);
router.post(
  "/:projectId/audit-logs",
  isLoggedIn,
  asyncHandler(createAuditLog),
);
router.post(
  "/:projectId/audit-logs/:logId/undo",
  isLoggedIn,
  asyncHandler(undoAuditLog),
);
router.post(
  "/audit-logs/:logId/undo",
  isLoggedIn,
  asyncHandler(undoAuditLog),
);

export default router;
