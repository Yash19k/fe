"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const async_handler_1 = require("../middleware/async.handler");
const is_loggedin_1 = require("../middleware/is.loggedin");
const rate_limiter_1 = require("../middleware/rate.limiter");
const auditlog_controller_1 = require("../controllers/auditlog.controller");
const member_invitation_controller_1 = require("../controllers/member-invitation.controller");
const router = (0, express_1.Router)();
const loginLimiter = (0, rate_limiter_1.createRateLimiter)({
    windowMs: 60000,
    maxRequests: 10,
    message: "Too many login attempts. Please wait a minute and try again.",
    code: "LOGIN_RATE_LIMIT_EXCEEDED",
});
router.post("/", (0, async_handler_1.asyncHandler)(user_controller_1.registerOrganization)); // when skip the add member step, this route will be used to register the organization and the first user
router.post("/register", (0, async_handler_1.asyncHandler)(user_controller_1.registerOrganization));
router.get("/", is_loggedin_1.isLoggedIn, (0, async_handler_1.asyncHandler)(user_controller_1.getOrganizationUsers));
router.post("/login", loginLimiter, (0, async_handler_1.asyncHandler)(user_controller_1.login));
router.get("/me", is_loggedin_1.isLoggedIn, (0, async_handler_1.asyncHandler)(user_controller_1.currentUser));
router.get("/me/audit-logs", is_loggedin_1.isLoggedIn, (0, async_handler_1.asyncHandler)(auditlog_controller_1.getMyAuditLogs));
router.post("/logout", (0, async_handler_1.asyncHandler)(user_controller_1.logout));
router.post("/refresh", user_controller_1.refreshAccessToken);
router.post("/invite", is_loggedin_1.isLoggedIn, (0, async_handler_1.asyncHandler)(member_invitation_controller_1.inviteMembersController));
router.post("/accept-invitation", (0, async_handler_1.asyncHandler)(member_invitation_controller_1.acceptInvitationController));
exports.default = router;
