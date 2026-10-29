"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFromCloudinary = exports.uploadToCloudinary = void 0;
const cloudinary_1 = require("cloudinary");
const app_error_1 = require("../errors/app.error");
function getCloudinaryClient() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
        throw new app_error_1.AppError("Cloudinary storage is not configured on this server.", 503, "SERVICE_UNAVAILABLE");
    }
    cloudinary_1.v2.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });
    return cloudinary_1.v2;
}
const uploadToCloudinary = (file, folder) => {
    const client = getCloudinaryClient();
    const resourceType = file.mimetype.startsWith("image/")
        ? "image"
        : file.mimetype.startsWith("video/")
            ? "video"
            : "raw";
    if (file.path) {
        return client.uploader
            .upload(file.path, {
            folder,
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
            overwrite: false,
        })
            .then((result) => {
            if (!result?.public_id ||
                !result.secure_url ||
                !result.resource_type ||
                !Number.isFinite(result.bytes)) {
                throw new app_error_1.AppError("Cloudinary returned incomplete upload metadata", 502, "BAD_GATEWAY");
            }
            return {
                publicId: result.public_id,
                secureUrl: result.secure_url,
                resourceType: result.resource_type,
                bytes: result.bytes,
            };
        });
    }
    return new Promise((resolve, reject) => {
        const stream = client.uploader.upload_stream({
            folder,
            resource_type: resourceType,
            use_filename: true,
            unique_filename: true,
            overwrite: false,
        }, (error, result) => {
            if (error)
                return reject(error);
            if (!result?.public_id ||
                !result.secure_url ||
                !result.resource_type ||
                !Number.isFinite(result.bytes)) {
                return reject(new app_error_1.AppError("Cloudinary returned incomplete upload metadata", 502, "BAD_GATEWAY"));
            }
            resolve({
                publicId: result.public_id,
                secureUrl: result.secure_url,
                resourceType: result.resource_type,
                bytes: result.bytes,
            });
        });
        stream.end(file.buffer);
    });
};
exports.uploadToCloudinary = uploadToCloudinary;
const deleteFromCloudinary = (publicId, resourceType) => {
    const client = getCloudinaryClient();
    return client.uploader.destroy(publicId, { resource_type: resourceType });
};
exports.deleteFromCloudinary = deleteFromCloudinary;
