import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import type { Express } from "express";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error("Cloudinary environment variables are not configured");
}

cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

export interface CloudinaryAsset {
  publicId: string;
  secureUrl: string;
  resourceType: string;
  bytes: number;
}

export const uploadToCloudinary = (
  file: Express.Multer.File,
  folder: string,
): Promise<CloudinaryAsset> =>
  new Promise((resolve, reject) => {
    const resourceType = file.mimetype.startsWith("image/")
      ? "image"
      : file.mimetype.startsWith("video/")
        ? "video"
        : "raw";

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result?: UploadApiResponse) => {
        if (error) return reject(error);
        if (
          !result?.public_id ||
          !result.secure_url ||
          !result.resource_type ||
          !Number.isFinite(result.bytes)
        ) {
          return reject(new Error("Cloudinary returned incomplete upload metadata"));
        }

        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
          resourceType: result.resource_type,
          bytes: result.bytes,
        });
      },
    );

    stream.end(file.buffer);
  });

export const deleteFromCloudinary = (
  publicId: string,
  resourceType: string,
): Promise<unknown> =>
  cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
