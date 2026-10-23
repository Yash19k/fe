import jwt from "jsonwebtoken";
import crypto from "crypto";

export interface AccessTokenPayload {
  userId: string;
  organizationId: string;
  role: string;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET or JWT_SECRET must be configured");
  }

  return jwt.sign(
    { ...payload, type: "ACCESS" },
    secret,
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
