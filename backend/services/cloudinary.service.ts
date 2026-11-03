import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import type { Express } from "express";
import { AppError } from "../errors/app.error";
import { config } from "../config/config";

function getCloudinaryClient() {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;

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
  format?: string;
  width?: number;
  height?: number;
}

export interface CloudinaryUploadOptions {
  resourceType?: "image" | "video" | "raw";
  deliveryType?: "upload" | "authenticated";
  publicId?: string;
}

function logCloudinaryUploadFailure(error: unknown): void {
  const providerError =
    typeof error === "object" && error !== null
      ? error as { code?: unknown; http_code?: unknown }
      : undefined;
  const providerCode =
    typeof providerError?.code === "string" &&
    /^[a-z0-9_.-]{1,64}$/i.test(providerError.code)
      ? providerError.code
      : undefined;
  const httpCode = providerError?.http_code;
  console.error(JSON.stringify({
    scope: "cloudinary",
    event: "upload_failed",
    errorName: error instanceof Error ? error.name : "UnknownError",
    ...(typeof httpCode === "number" && Number.isInteger(httpCode) ? { httpCode } : {}),
    ...(providerCode ? { providerCode } : {}),
  }));
}

function cloudinaryUploadError(error: unknown): AppError {
  const providerError =
    typeof error === "object" && error !== null
      ? error as { http_code?: unknown }
      : undefined;
  switch (providerError?.http_code) {
    case 401:
      return new AppError(
        "Cloudinary rejected the configured credentials. Verify the server's Cloudinary cloud name, API key, and API secret.",
        502,
        "CLOUDINARY_AUTH_FAILED",
      );
    case 403:
      return new AppError(
        "Cloudinary denied this upload. Verify the account permissions and upload access settings.",
        502,
        "CLOUDINARY_ACCESS_DENIED",
      );
    case 429:
      return new AppError(
        "Cloudinary is temporarily rate-limiting uploads. Please retry shortly.",
        503,
        "CLOUDINARY_RATE_LIMITED",
      );
    default:
      return new AppError(
        "Unable to upload attachment to Cloudinary.",
        502,
        "CLOUDINARY_UPLOAD_FAILED",
      );
  }
}

export const uploadToCloudinary = (
  file: Express.Multer.File,
  folder: string,
  options: CloudinaryUploadOptions = {},
): Promise<CloudinaryAsset> => {
  const client = getCloudinaryClient();
  const resourceType: "image" | "video" | "raw" =
    options.resourceType ??
    (file.mimetype.startsWith("image/")
      ? "image"
      : file.mimetype.startsWith("video/")
        ? "video"
        : "raw");
  const uploadOptions = {
    folder,
    resource_type: resourceType,
    type: options.deliveryType ?? "upload",
    use_filename: !options.publicId,
    unique_filename: true,
    overwrite: false,
    ...(options.publicId ? { public_id: options.publicId } : {}),
  };
  const toAsset = (result?: UploadApiResponse): CloudinaryAsset => {
    if (
      !result?.public_id ||
      !result.secure_url ||
      !result.resource_type ||
      !Number.isFinite(result.bytes)
    ) {
      throw new AppError(
        "Cloudinary returned incomplete upload metadata.",
        502,
        "BAD_GATEWAY",
      );
    }

    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      resourceType: result.resource_type,
      bytes: result.bytes,
      format: result.format,
      width: result.width,
      height: result.height,
    };
  };

  if (file.path) {
    return client.uploader
      .upload(file.path, uploadOptions)
      .then(toAsset)
      .catch((error: unknown) => {
        if (error instanceof AppError) throw error;
        logCloudinaryUploadFailure(error);
        throw cloudinaryUploadError(error);
      });
  }

  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      uploadOptions,
      (error, result?: UploadApiResponse) => {
        if (error) {
          logCloudinaryUploadFailure(error);
          reject(cloudinaryUploadError(error));
          return;
        }
        try {
          resolve(toAsset(result));
        } catch (validationError) {
          reject(validationError);
        }
      },
    );

    stream.end(file.buffer);
  });
};

export const deleteFromCloudinary = (
  publicId: string,
  resourceType: string,
  deliveryType: "upload" | "authenticated" = "upload",
): Promise<unknown> => {
  const client = getCloudinaryClient();
  return client.uploader.destroy(publicId, {
    resource_type: resourceType as "image" | "video" | "raw",
    type: deliveryType,
  });
};

export function getPrivateCloudinaryUrl(
  publicId: string,
  format: string,
  resourceType: "image" | "raw",
  download: boolean,
): string {
  const client = getCloudinaryClient();
  return client.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 300,
    attachment: download,
  });
}
