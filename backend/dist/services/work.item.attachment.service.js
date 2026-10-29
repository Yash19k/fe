"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAndPersistWorkItemAttachments = uploadAndPersistWorkItemAttachments;
const data_source_1 = require("../config/data.source");
const work_item_attachment_entity_1 = require("../entities/work.item.attachment.entity");
const cloudinary_service_1 = require("./cloudinary.service");
function getAttachmentType(mimeType) {
    if (mimeType.startsWith("image/"))
        return work_item_attachment_entity_1.AttachmentType.IMAGE;
    if (mimeType.startsWith("video/"))
        return work_item_attachment_entity_1.AttachmentType.VIDEO;
    return work_item_attachment_entity_1.AttachmentType.DOCUMENT;
}
async function cleanUpCloudinaryAssets(assets) {
    const cleanupResults = await Promise.allSettled(assets.map(async (asset) => (0, cloudinary_service_1.deleteFromCloudinary)(asset.publicId, asset.resourceType)));
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
async function uploadAndPersistWorkItemAttachments(files, workItemId, uploadedById) {
    const uploadResults = await Promise.allSettled(files.map((file) => (0, cloudinary_service_1.uploadToCloudinary)(file, `work-items/${workItemId}`)));
    const uploadedAssets = uploadResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const failedUpload = uploadResults.find((result) => result.status === "rejected");
    if (failedUpload?.status === "rejected") {
        await cleanUpCloudinaryAssets(uploadedAssets);
        throw failedUpload.reason;
    }
    const assets = uploadResults.map((result) => result.status === "fulfilled" ? result.value : null);
    try {
        const repository = data_source_1.AppDataSource.getRepository(work_item_attachment_entity_1.WorkItemAttachment);
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
    }
    catch (error) {
        await cleanUpCloudinaryAssets(uploadedAssets);
        throw error;
    }
}
