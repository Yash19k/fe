"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
function generateAccessToken(payload) {
    const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("ACCESS_TOKEN_SECRET or JWT_SECRET must be configured");
    }
    return jsonwebtoken_1.default.sign({ ...payload, type: "ACCESS" }, secret, { expiresIn: "15m" });
}
function generateRefreshToken() {
    const rawRefreshToken = crypto_1.default.randomBytes(32).toString("hex");
    const tokenHash = crypto_1.default
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
