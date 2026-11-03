import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../config/config";

export interface AccessTokenPayload {
  userId: string;
  organizationId: string;
  role: string;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(
    { ...payload, type: "ACCESS" },
    config.accessTokenSecret,
    { expiresIn: "15m" }
  );
}

export function generateRefreshToken() {
  const rawRefreshToken = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawRefreshToken)
    .digest("hex");

  const refreshExpiry = new Date();
  refreshExpiry.setDate(refreshExpiry.getDate() + 7);

  return {
    rawRefreshToken,
    tokenHash,
    refreshExpiry,
  };
}
