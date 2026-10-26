import { Router } from "express";
import { currentUser, getOrganizationUsers, login, logout, refreshAccessToken, registerOrganization } from "../controllers/user.controller";
import { asyncHandler } from "../middleware/async.handler";
import { isLoggedIn } from "../middleware/is.loggedin";
import { getMyAuditLogs } from "../controllers/auditlog.controller";


const router = Router();
router.post("/", asyncHandler(registerOrganization));  // when skip the add member step, this route will be used to register the organization and the first user
router.get("/", isLoggedIn, asyncHandler(getOrganizationUsers));
router.post("/login", asyncHandler(login));
router.get("/me", isLoggedIn, asyncHandler(currentUser));
router.post("/logout", asyncHandler(logout));
router.post("/refresh", refreshAccessToken);


export default router;
