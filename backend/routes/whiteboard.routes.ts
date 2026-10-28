import { Router } from "express";
import { isLoggedIn } from "../middleware/is.loggedin";
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

router.post("/projects/:projectId/whiteboards", isLoggedIn, validateProjectWhiteboardParams, validateCreateWhiteboard, asyncHandler(controller.createWhiteboard));
router.get("/projects/:projectId/whiteboards", isLoggedIn, validateProjectWhiteboardParams, validateListWhiteboards, asyncHandler(controller.listWhiteboards));
router.get("/whiteboards/:whiteboardId", isLoggedIn, validateWhiteboardParams, asyncHandler(controller.getWhiteboard));
router.get("/whiteboards/:whiteboardId/revisions", isLoggedIn, validateWhiteboardParams, validateListWhiteboards, asyncHandler(controller.listWhiteboardRevisions));
router.get("/whiteboards/:whiteboardId/revisions/:revisionNumber", isLoggedIn, validateWhiteboardRevisionParams, asyncHandler(controller.getWhiteboardRevision));
router.patch("/whiteboards/:whiteboardId", isLoggedIn, validateWhiteboardParams, validateUpdateWhiteboard, asyncHandler(controller.updateWhiteboard));
router.patch("/whiteboards/:whiteboardId/name", isLoggedIn, validateWhiteboardParams, validateRenameWhiteboard, asyncHandler(controller.renameWhiteboard));
router.delete("/whiteboards/:whiteboardId", isLoggedIn, validateWhiteboardParams, asyncHandler(controller.deleteWhiteboard));

export default router;
