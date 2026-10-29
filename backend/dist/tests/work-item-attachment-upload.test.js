"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const work_item_attachment_upload_middleware_1 = require("../middleware/work.item.attachment.upload.middleware");
(0, node_test_1.describe)("work item attachment file validation", () => {
    (0, node_test_1.test)("accepts configured image, video, and document types", () => {
        const validFiles = [
            ["image/jpeg", "photo.jpeg"],
            ["image/png", "photo.png"],
            ["image/webp", "photo.webp"],
            ["image/gif", "photo.gif"],
            ["video/mp4", "clip.mp4"],
            ["video/webm", "clip.webm"],
            ["application/pdf", "document.pdf"],
            ["text/plain", "notes.txt"],
            ["application/msword", "document.doc"],
            [
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "document.docx",
            ],
            ["application/vnd.ms-excel", "sheet.xls"],
            [
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "sheet.xlsx",
            ],
        ];
        for (const [mimeType, filename] of validFiles) {
            strict_1.default.equal((0, work_item_attachment_upload_middleware_1.isSupportedAttachmentType)(mimeType, filename), true);
        }
    });
    (0, node_test_1.test)("rejects unsupported MIME types and mismatched extensions", () => {
        strict_1.default.equal((0, work_item_attachment_upload_middleware_1.isSupportedAttachmentType)("image/svg+xml", "image.svg"), false);
        strict_1.default.equal((0, work_item_attachment_upload_middleware_1.isSupportedAttachmentType)("image/png", "image.jpg"), false);
        strict_1.default.equal((0, work_item_attachment_upload_middleware_1.isSupportedAttachmentType)("application/pdf", "document.exe"), false);
    });
    (0, node_test_1.test)("validates file signatures instead of trusting the declared MIME type", () => {
        strict_1.default.equal((0, work_item_attachment_upload_middleware_1.isSupportedAttachmentContent)("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
        strict_1.default.equal((0, work_item_attachment_upload_middleware_1.isSupportedAttachmentContent)("image/png", Buffer.from("%PDF-1.7")), false);
        strict_1.default.equal((0, work_item_attachment_upload_middleware_1.isSupportedAttachmentContent)("text/plain", Buffer.from([0x00, 0x01])), false);
    });
});
