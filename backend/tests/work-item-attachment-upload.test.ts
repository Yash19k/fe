import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isSupportedAttachmentType } from "../middleware/work.item.attachment.upload.middleware";

describe("work item attachment file validation", () => {
  test("accepts configured image, video, and document types", () => {
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
      assert.equal(isSupportedAttachmentType(mimeType, filename), true);
    }
  });

  test("rejects unsupported MIME types and mismatched extensions", () => {
    assert.equal(isSupportedAttachmentType("image/svg+xml", "image.svg"), false);
    assert.equal(isSupportedAttachmentType("image/png", "image.jpg"), false);
    assert.equal(isSupportedAttachmentType("application/pdf", "document.exe"), false);
  });
});
