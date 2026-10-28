import { Router } from "express";

import { forgotPasswordController, resetPasswordController } from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/async.handler";
import { AppError } from "../errors/app.error";

const router = Router();

const authRequestLimiter = (() => {
  const requestMap = new Map<string, { count: number; resetAt: number }>();

  return (windowMs: number, maxRequests: number) => {
    return (req: any, _res: any, next: any) => {
      const rawIp =
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.headers["x-real-ip"] ||
        "unknown";
      const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(",")[0].trim();
      const now = Date.now();
      const entry = requestMap.get(ip);

      if (!entry || entry.resetAt <= now) {
        requestMap.set(ip, { count: 1, resetAt: now + windowMs });
        return next();
      }

      entry.count += 1;

      if (entry.count > maxRequests) {
        const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        return next(
          new AppError(
            "Too many password reset requests. Please wait a few minutes and try again.",
            429,
            "RATE_LIMIT_EXCEEDED",
          ),
        );
      }

      return next();
    };
  };
})();

const authRateLimiter = authRequestLimiter(60_000, 5);

router.post("/forgot-password", authRateLimiter, asyncHandler(forgotPasswordController));
router.post("/reset-password", authRateLimiter, asyncHandler(resetPasswordController));

export default router;
