"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (err, _req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    console.error("Request error:", err);
    // PostgreSQL unique constraint violation (error code 23505)
    const isUniqueViolation = err.code === "23505" ||
        err?.driverError?.code === "23505";
    if (isUniqueViolation) {
        const constraint = String(err?.driverError?.constraint ||
            err?.constraint ||
            err?.detail ||
            "");
        let message = "A conflict occurred with an existing record.";
        let code = "CONFLICT";
        if (constraint.includes("UQ_projects_organization_key") || constraint.includes("key")) {
            message = "This project key is already used in your organization.";
            code = "PROJECT_KEY_CONFLICT";
        }
        else if (constraint.includes("email")) {
            message = "This email is already in use.";
            code = "EMAIL_CONFLICT";
        }
        res.status(409).json({
            success: false,
            code,
            message,
        });
        return;
    }
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
        ...(err.code === "WORK_ITEM_VERSION_CONFLICT" && err.details
            ? { data: err.details }
            : {}),
    });
};
exports.errorHandler = errorHandler;
