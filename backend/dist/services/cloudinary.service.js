"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFromCloudinary = exports.uploadToCloudinary = void 0;
const cloudinary_1 = require("cloudinary");
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary environment variables are not configured");
}
cloudinary_1.v2.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
const uploadToCloudinary = (file, folder) => new Promise((resolve, reject) => {
    const resourceType = file.mimetype.startsWith("image/")
        ? "image"
        : file.mimetype.startsWith("video/")
            ? "video"
            : "raw";
    const stream = cloudinary_1.v2.uploader.upload_stream({
        folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
    }, (error, result) => {
        if (error)
            return reject(error);
        if (!result)
            return reject(new Error("Cloudinary returned no upload result"));
        resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
            resourceType: result.resource_type,
            bytes: result.bytes,
        });
    });
    stream.end(file.buffer);
});
exports.uploadToCloudinary = uploadToCloudinary;
const deleteFromCloudinary = (publicId, resourceType) => cloudinary_1.v2.uploader.destroy(publicId, { resource_type: resourceType });
exports.deleteFromCloudinary = deleteFromCloudinary;
