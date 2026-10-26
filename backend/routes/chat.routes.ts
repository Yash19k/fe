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

const router = Router();
router.use(isLoggedIn);
router.post("/", asyncHandler(createConversationController));
router.get("/", asyncHandler(listConversationsController));
router.get("/members", asyncHandler(listMembersController));
router.get("/:conversationId", asyncHandler(getConversationController));
router.post("/:conversationId/members", asyncHandler(addConversationMemberController));
router.delete("/:conversationId/members/:userId", asyncHandler(removeConversationMemberController));
router.get("/:conversationId/messages", asyncHandler(getMessagesController));
router.post("/:conversationId/messages", asyncHandler(sendMessageController));
router.patch("/:conversationId/read", asyncHandler(markReadController));

export default router;
