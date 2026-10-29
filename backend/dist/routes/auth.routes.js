"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const async_handler_1 = require("../middleware/async.handler");
const rate_limiter_1 = require("../middleware/rate.limiter");
const router = (0, express_1.Router)();
const authRateLimiter = (0, rate_limiter_1.createRateLimiter)({
    windowMs: 60000,
    maxRequests: 5,
    message: "Too many password reset requests. Please wait a few minutes and try again.",
    code: "RATE_LIMIT_EXCEEDED",
});
router.post("/forgot-password", authRateLimiter, (0, async_handler_1.asyncHandler)(auth_controller_1.forgotPasswordController));
router.post("/reset-password", authRateLimiter, (0, async_handler_1.asyncHandler)(auth_controller_1.resetPasswordController));
exports.default = router;
