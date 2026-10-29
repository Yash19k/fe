import os from "os";
import fs from "fs";
import path from "path";
import multer from "multer";
import type { RequestHandler } from "express";
import { AppError } from "../errors/app.error";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB each, matching frontend expectation
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
    case "text/plain": {
      for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];
        if (
          (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) ||
          byte === 127
        ) {
          return false;
        }
      }
      return true;
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

const readFileHeader = (filePath: string): Promise<Buffer> => {
  return fs.promises
    .open(filePath, "r")
    .then(async (handle) => {
      const buffer = Buffer.alloc(8192);
      const { bytesRead } = await handle.read(buffer, 0, 8192, 0);
      await handle.close();
      return buffer.subarray(0, bytesRead);
    })
    .catch(() => Buffer.alloc(0));
};

const cleanupFiles = (files: Express.Multer.File[]): Promise<PromiseSettledResult<void>[]> => {
  return Promise.allSettled(
    files.map((file) =>
      file.path ? fs.promises.unlink(file.path) : Promise.resolve(),
    ),
  );
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `attachment-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_SIZE,
    fields: 30,
    fieldSize: 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!isSupportedAttachmentType(file.mimetype, file.originalname)) {
      return callback(
        new AppError(
          `Unsupported attachment type: ${file.mimetype || "unknown"}`,
          400,
          "UNSUPPORTED_ATTACHMENT_TYPE",
        ),
      );
    }
    if (file.originalname.length > 255) {
      return callback(
        new AppError(
          "Attachment filenames must be 255 characters or fewer.",
          400,
          "ATTACHMENT_FILENAME_TOO_LONG",
        ),
      );
    }
    callback(null, true);
  },
});

const parseAttachments = upload.array("attachments", MAX_FILES);

export const uploadWorkItemAttachments: RequestHandler = (req, res, next) => {
  parseAttachments(req, res, (error) => {
    if (!error) {
      const files = Array.isArray(req.files) ? req.files : [];
      Promise.all(
        files.map(async (file) => {
          let buf: Buffer;
          if (file.buffer) {
            buf = file.buffer;
          } else if (file.path) {
            buf = await readFileHeader(file.path);
          } else {
            buf = Buffer.alloc(0);
          }
          return isSupportedAttachmentContent(file.mimetype, buf);
        }),
      )
        .then((validity) => {
          const invalidIndex = validity.findIndex((isValid) => !isValid);
          if (invalidIndex !== -1) {
            cleanupFiles(files);
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
        })
        .catch(next);
      return;
    }

    const files = Array.isArray(req.files) ? req.files : [];
    cleanupFiles(files);

    if (error instanceof AppError) {
      next(error);
      return;
    }

    if (error instanceof multer.MulterError) {
      const isFileSizeLimit = error.code === "LIMIT_FILE_SIZE";
      const message = isFileSizeLimit
        ? "Each attachment must be 25 MB or smaller."
        : error.code === "LIMIT_UNEXPECTED_FILE"
          ? "Use the attachments field and upload no more than 5 files."
          : "The multipart attachment request exceeded its upload limits.";

      next(
        new AppError(
          message,
          isFileSizeLimit ? 413 : 400,
          error.code,
        ),
      );
      return;
    }

    next(
      new AppError(
        "Malformed multipart attachment request.",
        400,
        "INVALID_MULTIPART_REQUEST",
      ),
    );
  });
};

