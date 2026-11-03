import { Router } from "express";
import { asyncHandler } from "../middleware/async.handler";
import { isLoggedIn } from "../middleware/is.loggedin";
import {
  addConversationMemberController,
  createConversationController,
  getConversationController,
  getMessagesController,
  listConversationsController,
  listMembersController,
  markReadController,
  removeConversationMemberController,
  sendMessageController,
} from "../controllers/chat.controller";
import { validateUuidRouteParam } from "../validations/route-params";

const router = Router();
for (const param of ["conversationId", "userId"]) {
  router.param(param, validateUuidRouteParam);
}

router.use(isLoggedIn);
// router.post("/", asyncHandler(createConversationController));
// router.get("/", asyncHandler(listConversationsController));
router.get("/conversations", asyncHandler(listConversationsController));
router.post("/conversations", asyncHandler(createConversationController));
router.get("/members", asyncHandler(listMembersController));
router.get(
  "/conversations/:conversationId",
  asyncHandler(getConversationController),
);
router.post(
  "/conversations/:conversationId/members",
  asyncHandler(addConversationMemberController),
);
router.delete(
  "/conversations/:conversationId/members/:userId",
  asyncHandler(removeConversationMemberController),
);
router.get(
  "/conversations/:conversationId/messages",
  asyncHandler(getMessagesController),
);
router.post(
  "/conversations/:conversationId/messages",
  asyncHandler(sendMessageController),
);
router.patch(
  "/conversations/:conversationId/read",
  asyncHandler(markReadController),
);

export default router;
