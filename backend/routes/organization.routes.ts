import { Router } from "express";
import {
  registerOrganization,
  addOrganizationMembers,
  getOrganizationMembers,
  updateOrganizationMemberRole,
  removeOrganizationMember,
} from "../controllers/organization.controller";
import {
  acceptInvitationController,
  inviteMembersController,
} from "../controllers/member-invitation.controller";
import { isLoggedIn } from "../middleware/is.loggedin";
import { asyncHandler } from "../middleware/async.handler";

const router = Router();

router.post("/", registerOrganization);
router.get("/members", isLoggedIn, asyncHandler(getOrganizationMembers));
router.post("/members", isLoggedIn, asyncHandler(addOrganizationMembers));
router.post("/members/invite", isLoggedIn, inviteMembersController);
router.patch("/members/:userId", isLoggedIn, asyncHandler(updateOrganizationMemberRole));
router.delete("/members/:userId", isLoggedIn, asyncHandler(removeOrganizationMember));
router.post("/accept", acceptInvitationController);

export default router;
