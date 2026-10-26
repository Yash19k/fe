import type { Express } from "express";
import { AppDataSource } from "../config/data.source";
import {
  AttachmentType,
  WorkItemAttachment,
} from "../entities/work.item.attachment.entity";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
  type CloudinaryAsset,
} from "./cloudinary.service";

function getAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith("image/")) return AttachmentType.IMAGE;
  if (mimeType.startsWith("video/")) return AttachmentType.VIDEO;
  return AttachmentType.DOCUMENT;
}

async function cleanUpCloudinaryAssets(assets: CloudinaryAsset[]): Promise<void> {
  const cleanupResults = await Promise.allSettled(
    assets.map(async (asset) =>
      deleteFromCloudinary(asset.publicId, asset.resourceType),
    ),
  );

  cleanupResults.forEach((result, index) => {
    if (result.status === "rejected") {
      const asset = assets[index];
      console.error("Failed to clean up an unpersisted Cloudinary attachment.", {
        publicId: asset.publicId,
        resourceType: asset.resourceType,
        errorName: result.reason instanceof Error
          ? result.reason.name
          : "UnknownError",
      });
    }
  });
}

export async function uploadAndPersistWorkItemAttachments(
  files: Express.Multer.File[],
  workItemId: string,
  uploadedById: string,
): Promise<WorkItemAttachment[]> {
  const uploadResults = await Promise.allSettled(
    files.map((file) =>
      uploadToCloudinary(file, `work-items/${workItemId}`),
    ),
  );
  const uploadedAssets = uploadResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failedUpload = uploadResults.find(
    (result) => result.status === "rejected",
  );

  if (failedUpload?.status === "rejected") {
    await cleanUpCloudinaryAssets(uploadedAssets);
    throw failedUpload.reason;
  }

  const assets = uploadResults.map((result) =>
    result.status === "fulfilled" ? result.value : null,
  );

  try {
    const repository = AppDataSource.getRepository(WorkItemAttachment);
    const attachmentEntities = files.map((file, index) => {
      const asset = assets[index];
      if (!asset) {
        throw new Error("Cloudinary upload completed without an asset.");
      }

      return repository.create({
        workItemId,
        workItem: { id: workItemId },
        uploadedById,
        uploadedBy: { id: uploadedById },
        originalName: file.originalname,
        mimeType: file.mimetype,
        type: getAttachmentType(file.mimetype),
        size: String(asset.bytes),
        storageKey: asset.secureUrl,
        publicId: asset.publicId,
        resourceType: asset.resourceType,
      });
    });

    return await repository.save(attachmentEntities);
  } catch (error) {
    await cleanUpCloudinaryAssets(uploadedAssets);
    throw error;
  }
}
