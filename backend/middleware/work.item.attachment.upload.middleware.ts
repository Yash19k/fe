import multer from "multer";
import { AppError } from "../errors/app.error";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB each
const MAX_FILES = 5;

const allowedMimeTypes = new Set([ "image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","application/pdf","text/plain","application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_FILES, fileSize: MAX_FILE_SIZE, fields: 30 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new AppError(
        `Unsupported attachment type: ${file.mimetype}`,
        400,
        "UNSUPPORTED_ATTACHMENT_TYPE",
      ));
    }
    callback(null, true);
  },
});

export const uploadWorkItemAttachments = upload.array("attachments", MAX_FILES);
