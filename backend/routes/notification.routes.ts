
import { Router } from "express";
import { isLoggedIn } from "../middleware/is.loggedin";
import { asyncHandler } from "../middleware/async.handler";
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controller";

const router = Router();

router.use(isLoggedIn);

router.get("/", asyncHandler(getUserNotifications));
router.get("/unread-count", asyncHandler(getUnreadNotificationCount));
router.patch("/read-all", asyncHandler(markAllNotificationsRead));
router.patch("/:id/read", asyncHandler(markNotificationRead));

export default router;
