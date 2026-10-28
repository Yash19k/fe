import { Router } from "express";

import {
  forgotPasswordController,
  resetPasswordController,
} from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/async.handler";
import { createRateLimiter } from "../middleware/rate.limiter";

const router = Router();

const authRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 5,
  message:
    "Too many password reset requests. Please wait a few minutes and try again.",
  code: "RATE_LIMIT_EXCEEDED",
});

router.post(
  "/forgot-password",
  authRateLimiter,
  asyncHandler(forgotPasswordController),
);
router.post(
  "/reset-password",
  authRateLimiter,
  asyncHandler(resetPasswordController),
);

export default router;
