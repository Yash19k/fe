import { Router } from "express";
import { isLoggedIn } from "../middleware/is.loggedin";
import { asyncHandler } from "../middleware/async.handler";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
} from "../controllers/feature-persistence.controller";

const router = Router();

router.get("/", isLoggedIn, asyncHandler(getUserNotifications));
router.patch("/read-all", isLoggedIn, asyncHandler(markAllNotificationsRead));
router.patch("/mark-all-read", isLoggedIn, asyncHandler(markAllNotificationsRead));
router.post("/mark-all-read", isLoggedIn, asyncHandler(markAllNotificationsRead));
router.patch("/:id/read", isLoggedIn, asyncHandler(markNotificationRead));
router.post("/", isLoggedIn, asyncHandler(createNotification));

export default router;
