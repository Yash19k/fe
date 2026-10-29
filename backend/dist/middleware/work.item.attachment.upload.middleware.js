"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadWorkItemAttachments = void 0;
exports.isSupportedAttachmentType = isSupportedAttachmentType;
const multer_1 = __importDefault(require("multer"));
const app_error_1 = require("../errors/app.error");
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB each
const MAX_FILES = 5;
const allowedMimeTypes = new Map([
    ["image/jpeg", new Set([".jpg", ".jpeg"])],
    ["image/png", new Set([".png"])],
    ["image/webp", new Set([".webp"])],
    ["image/gif", new Set([".gif"])],
    ["video/mp4", new Set([".mp4"])],
    ["video/webm", new Set([".webm"])],
    ["application/pdf", new Set([".pdf"])],
    ["text/plain", new Set([".txt"])],
    ["application/msword", new Set([".doc"])],
    [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        new Set([".docx"]),
    ],
    ["application/vnd.ms-excel", new Set([".xls"])],
    [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        new Set([".xlsx"]),
    ],
]);
function isSupportedAttachmentType(mimeType, originalName) {
    const allowedExtensions = allowedMimeTypes.get(mimeType);
    const extension = originalName
        .slice(originalName.lastIndexOf("."))
        .toLowerCase();
    return Boolean(allowedExtensions?.has(extension));
}
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { files: MAX_FILES, fileSize: MAX_FILE_SIZE, fields: 30 },
    fileFilter: (_req, file, callback) => {
        if (!isSupportedAttachmentType(file.mimetype, file.originalname)) {
            return callback(new app_error_1.AppError(`Unsupported attachment type: ${file.mimetype || "unknown"}`, 400, "UNSUPPORTED_ATTACHMENT_TYPE"));
        }
        if (file.originalname.length > 255) {
            return callback(new app_error_1.AppError("Attachment filenames must be 255 characters or fewer.", 400, "ATTACHMENT_FILENAME_TOO_LONG"));
        }
        callback(null, true);
    },
});
const parseAttachments = upload.array("attachments", MAX_FILES);
const uploadWorkItemAttachments = (req, res, next) => {
    parseAttachments(req, res, (error) => {
        if (!error) {
            next();
            return;
        }
        if (error instanceof app_error_1.AppError) {
            next(error);
            return;
        }
        if (error instanceof multer_1.default.MulterError) {
            const isFileSizeLimit = error.code === "LIMIT_FILE_SIZE";
            const message = isFileSizeLimit
                ? "Each attachment must be 100 MB or smaller."
                : error.code === "LIMIT_UNEXPECTED_FILE"
                    ? "Use the attachments field and upload no more than 5 files."
                    : "The multipart attachment request exceeded its upload limits.";
            next(new app_error_1.AppError(message, isFileSizeLimit ? 413 : 400, error.code));
            return;
        }
        next(new app_error_1.AppError("Malformed multipart attachment request.", 400, "INVALID_MULTIPART_REQUEST"));
    });
};
exports.uploadWorkItemAttachments = uploadWorkItemAttachments;
