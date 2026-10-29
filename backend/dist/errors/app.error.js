"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode = 500, code = "INTERNAL_SERVER_ERROR", diagnostic, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.diagnostic = diagnostic;
        this.details = details;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
