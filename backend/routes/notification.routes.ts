
import { Router } from "express";
import { isLoggedIn } from "../middleware/is.loggedin";
import { asyncHandler } from "../middleware/async.handler";
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controller";
import { validateUuidRouteParam } from "../validations/route-params";
import { validatePaginationQuery } from "../validations/request.validation";

const router = Router();

router.param("id", validateUuidRouteParam);

router.use(isLoggedIn);

router.get("/", validatePaginationQuery(20, 100), asyncHandler(getUserNotifications));
router.get("/unread-count", asyncHandler(getUnreadNotificationCount));
router.patch("/read-all", asyncHandler(markAllNotificationsRead));
router.patch("/:id/read", asyncHandler(markNotificationRead));

export default router;
