import { Router } from "express";
import { registerOrganization } from "../controllers/organization.controller";
import {
  acceptInvitationController,
  inviteMembersController,
} from "../controllers/member-invitation.controller";
import { isLoggedIn } from "../middleware/is.loggedin";
const router = Router();

router.post("/", registerOrganization);
router.post("/members/invite", isLoggedIn, inviteMembersController);
router.post("/accept", acceptInvitationController);

export default router;
