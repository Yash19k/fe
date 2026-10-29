import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import type { Express } from "express";
import { AppError } from "../errors/app.error";

function getCloudinaryClient() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(
      "Cloudinary storage is not configured on this server.",
      503,
      "SERVICE_UNAVAILABLE",
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
}

export interface CloudinaryAsset {
  publicId: string;
  secureUrl: string;
  resourceType: string;
  bytes: number;
}

export const uploadToCloudinary = (
  file: Express.Multer.File,
  folder: string,
): Promise<CloudinaryAsset> => {
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
      .then((result: UploadApiResponse) => {
        if (
          !result?.public_id ||
          !result.secure_url ||
          !result.resource_type ||
          !Number.isFinite(result.bytes)
        ) {
          throw new AppError(
            "Cloudinary returned incomplete upload metadata",
            502,
            "BAD_GATEWAY",
          );
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
    const stream = client.uploader.upload_stream(
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
          return reject(
            new AppError(
              "Cloudinary returned incomplete upload metadata",
              502,
              "BAD_GATEWAY",
            ),
          );
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
};

export const deleteFromCloudinary = (
  publicId: string,
  resourceType: string,
): Promise<unknown> => {
  const client = getCloudinaryClient();
  return client.uploader.destroy(publicId, { resource_type: resourceType });
};
