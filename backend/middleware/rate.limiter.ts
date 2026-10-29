import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.error";

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  code?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    message = "Too many requests. Please try again later.",
    code = "RATE_LIMIT_EXCEEDED",
  } = options;

  const requestMap = new Map<string, { count: number; resetAt: number }>();

  // Periodically evict expired entries to prevent memory leaks
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of requestMap.entries()) {
      if (entry.resetAt <= now) {
        requestMap.delete(key);
      }
    }
  }, Math.max(windowMs, 30_000));
  interval.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Extract IP safely; Express req.ip respects app.set("trust proxy")
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const entry = requestMap.get(ip);

    if (!entry || entry.resetAt <= now) {
      requestMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return next(new AppError(message, 429, code));
    }

    return next();
  };
}
