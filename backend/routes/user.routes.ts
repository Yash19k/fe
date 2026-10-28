import { Router } from "express";
import { currentUser, getOrganizationUsers, login, logout, refreshAccessToken, registerOrganization } from "../controllers/user.controller";
import { asyncHandler } from "../middleware/async.handler";
import { isLoggedIn } from "../middleware/is.loggedin";
import { createRateLimiter } from "../middleware/rate.limiter";
import { getMyAuditLogs } from "../controllers/auditlog.controller";


import {
  acceptInvitationController,
  inviteMembersController,
} from "../controllers/member-invitation.controller";

const router = Router();

const loginLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  message: "Too many login attempts. Please wait a minute and try again.",
  code: "LOGIN_RATE_LIMIT_EXCEEDED",
});

router.post("/", asyncHandler(registerOrganization));  // when skip the add member step, this route will be used to register the organization and the first user
router.post("/register", asyncHandler(registerOrganization));
router.get("/", isLoggedIn, asyncHandler(getOrganizationUsers));
router.post("/login", loginLimiter, asyncHandler(login));
router.get("/me", isLoggedIn, asyncHandler(currentUser));
router.post("/logout", asyncHandler(logout));
router.post("/refresh", refreshAccessToken);
router.post("/invite", isLoggedIn, inviteMembersController);
router.post("/accept-invitation", acceptInvitationController);


export default router;
