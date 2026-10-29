import { Router } from "express";
import { isLoggedIn } from "../middleware/is.loggedin";
import { requireProjectPermission } from "../middleware/project.permission";
import { asyncHandler } from "../middleware/async.handler";
import * as controller from "../controllers/whiteboard.controller";
import {
  validateCreateWhiteboard,
  validateListWhiteboards,
  validateProjectWhiteboardParams,
  validateRenameWhiteboard,
  validateUpdateWhiteboard,
  validateWhiteboardParams,
  validateWhiteboardRevisionParams,
} from "../validations/whiteboard.validation";

const router = Router();

router.post(
  "/projects/:projectId/whiteboards",
  isLoggedIn,
  validateProjectWhiteboardParams,
  validateCreateWhiteboard,
  requireProjectPermission("project:update"),
  asyncHandler(controller.createWhiteboard),
);

router.get(
  "/projects/:projectId/whiteboards",
  isLoggedIn,
  validateProjectWhiteboardParams,
  validateListWhiteboards,
  requireProjectPermission("project:view"),
  asyncHandler(controller.listWhiteboards),
);

router.get(
  "/whiteboards/:whiteboardId",
  isLoggedIn,
  validateWhiteboardParams,
  requireProjectPermission("project:view"),
  asyncHandler(controller.getWhiteboard),
);

router.get(
  "/whiteboards/:whiteboardId/revisions",
  isLoggedIn,
  validateWhiteboardParams,
  validateListWhiteboards,
  requireProjectPermission("project:view"),
  asyncHandler(controller.listWhiteboardRevisions),
);

router.get(
  "/whiteboards/:whiteboardId/revisions/:revisionNumber",
  isLoggedIn,
  validateWhiteboardRevisionParams,
  requireProjectPermission("project:view"),
  asyncHandler(controller.getWhiteboardRevision),
);

router.patch(
  "/whiteboards/:whiteboardId",
  isLoggedIn,
  validateWhiteboardParams,
  validateUpdateWhiteboard,
  requireProjectPermission("project:update"),
  asyncHandler(controller.updateWhiteboard),
);

router.patch(
  "/whiteboards/:whiteboardId/name",
  isLoggedIn,
  validateWhiteboardParams,
  validateRenameWhiteboard,
  requireProjectPermission("project:update"),
  asyncHandler(controller.renameWhiteboard),
);

router.delete(
  "/whiteboards/:whiteboardId",
  isLoggedIn,
  validateWhiteboardParams,
  requireProjectPermission("project:delete"),
  asyncHandler(controller.deleteWhiteboard),
);

export default router;
