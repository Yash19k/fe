import multer from "multer";
import type { Express, RequestHandler } from "express";
import { AppError } from "../errors/app.error";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB each
const MAX_FILES = 5;

const allowedMimeTypes = new Map<string, Set<string>>([
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

export function isSupportedAttachmentType(
  mimeType: string,
  originalName: string,
): boolean {
  const allowedExtensions = allowedMimeTypes.get(mimeType);
  const extension = originalName
    .slice(originalName.lastIndexOf("."))
    .toLowerCase();
  return Boolean(allowedExtensions?.has(extension));
}

export function isSupportedAttachmentContent(
  mimeType: string,
  buffer: Buffer,
): boolean {
  const startsWith = (...bytes: number[]) =>
    bytes.every((byte, index) => buffer[index] === byte);
  const matchesAscii = (offset: number, value: string) =>
    buffer.toString("ascii", offset, offset + value.length) === value;

  switch (mimeType) {
    case "image/jpeg":
      return startsWith(0xff, 0xd8, 0xff);
    case "image/png":
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp":
      return matchesAscii(0, "RIFF") && matchesAscii(8, "WEBP");
    case "image/gif":
      return matchesAscii(0, "GIF87a") || matchesAscii(0, "GIF89a");
    case "video/mp4":
      return matchesAscii(4, "ftyp");
    case "video/webm":
      return startsWith(0x1a, 0x45, 0xdf, 0xa3);
    case "application/pdf":
      return matchesAscii(0, "%PDF-");
    case "application/msword":
    case "application/vnd.ms-excel":
      return startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return startsWith(0x50, 0x4b, 0x03, 0x04);
    case "text/plain":
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
        return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function sanitizeDisplayName(name: string): string {
  const baseName = name.replace(/\\/g, "/").split("/").pop() || "attachment";
  const sanitized = baseName.replace(/[\u0000-\u001f\u007f]/g, "_").slice(0, 255);
  return sanitized || "attachment";
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE,
    fields: 30,
    fieldSize: 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!isSupportedAttachmentType(file.mimetype, file.originalname)) {
      return callback(new AppError(
        `Unsupported attachment type: ${file.mimetype || "unknown"}`,
        400,
        "UNSUPPORTED_ATTACHMENT_TYPE",
      ));
    }
    if (file.originalname.length > 255) {
      return callback(new AppError(
        "Attachment filenames must be 255 characters or fewer.",
        400,
        "ATTACHMENT_FILENAME_TOO_LONG",
      ));
    }
    callback(null, true);
  },
});

const parseAttachments = upload.array("attachments", MAX_FILES);

export const uploadWorkItemAttachments: RequestHandler = (req, res, next) => {
  parseAttachments(req, res, (error) => {
    if (!error) {
      const files = Array.isArray(req.files) ? req.files : [];
      const invalidFile = files.find(
        (file) => !isSupportedAttachmentContent(file.mimetype, file.buffer),
      );
      if (invalidFile) {
        next(
          new AppError(
            "Attachment content does not match its declared file type.",
            415,
            "INVALID_ATTACHMENT_CONTENT",
          ),
        );
        return;
      }

      for (const file of files) {
        file.originalname = sanitizeDisplayName(file.originalname);
      }
      next();
      return;
    }

    if (error instanceof AppError) {
      next(error);
      return;
    }

    if (error instanceof multer.MulterError) {
      const isFileSizeLimit = error.code === "LIMIT_FILE_SIZE";
      const message = isFileSizeLimit
        ? "Each attachment must be 100 MB or smaller."
        : error.code === "LIMIT_UNEXPECTED_FILE"
          ? "Use the attachments field and upload no more than 5 files."
          : "The multipart attachment request exceeded its upload limits.";

      next(new AppError(
        message,
        isFileSizeLimit ? 413 : 400,
        error.code,
      ));
      return;
    }

    next(new AppError(
      "Malformed multipart attachment request.",
      400,
      "INVALID_MULTIPART_REQUEST",
    ));
  });
};
