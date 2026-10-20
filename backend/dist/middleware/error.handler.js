"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, _req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    console.error("Request error:", err);
    const statusCode = typeof err.statusCode === "number" &&
        err.statusCode >= 400 &&
        err.statusCode <= 599
        ? err.statusCode
        : 500;
    res.status(statusCode).json({
        success: false,
        code: typeof err.code === "string" ? err.code : "INTERNAL_SERVER_ERROR",
        message: statusCode >= 500
            ? "Internal Server Error"
            : err.message || "Request failed",
    });
};
exports.errorHandler = errorHandler;
