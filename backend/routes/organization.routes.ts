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
import { validateUuidRouteParam } from "../validations/route-params";
import { validateRequestBody } from "../validations/request.validation";
import Joi from "joi";
import { UserRole } from "../entities/user.entity";

const router = Router();

router.param("userId", validateUuidRouteParam);

const memberRoleSchema = Joi.object({
  role: Joi.string().valid(...Object.values(UserRole)).required(),
}).unknown(true);

router.post("/", registerOrganization);
router.get("/members", isLoggedIn, asyncHandler(getOrganizationMembers));
router.post("/members", isLoggedIn, asyncHandler(addOrganizationMembers));
router.post(
  "/members/invite",
  isLoggedIn,
  asyncHandler(inviteMembersController),
);
router.patch(
  "/members/:userId",
  isLoggedIn,
  validateRequestBody(memberRoleSchema),
  asyncHandler(updateOrganizationMemberRole),
);
router.delete("/members/:userId", isLoggedIn, asyncHandler(removeOrganizationMember));
router.post("/accept", asyncHandler(acceptInvitationController));

export default router;
