import { Router } from "express";
import { currentUser, getOrganizationUsers, login, logout, refreshAccessToken, registerOrganization } from "../controllers/user.controller";
import { asyncHandler } from "../middleware/async.handler";
import { isLoggedIn } from "../middleware/is.loggedin";


const router = Router();
router.post("/", asyncHandler(registerOrganization));
router.get("/", isLoggedIn, asyncHandler(getOrganizationUsers));
router.post("/login", asyncHandler(login));
router.get("/me", isLoggedIn, asyncHandler(currentUser));
router.post("/logout", asyncHandler(logout));
router.post("/refresh", refreshAccessToken);
export default router;
