"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAccessToken = createAccessToken;
exports.createAuthSession = createAuthSession;
exports.setAuthCookies = setAuthCookies;
exports.setAccessCookie = setAccessCookie;
exports.setRefreshCookie = setRefreshCookie;
exports.clearAuthCookies = clearAuthCookies;
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config/config");
const user_session_entity_1 = require("../entities/user.session.entity");
const ACCESS_TOKEN_TTL = "15m";
const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
};
function hashRefreshToken(token) {
    return (0, crypto_1.createHash)("sha256").update(token).digest("hex");
}
function createAccessToken(user) {
    return jsonwebtoken_1.default.sign({
        userId: user.id,
        role: user.role,
        organizationId: user.organizationId,
        type: "ACCESS",
    }, config_1.config.accessTokenSecret, {
        algorithm: "HS256",
        expiresIn: ACCESS_TOKEN_TTL,
    });
}
async function createAuthSession(manager, user) {
    const accessToken = createAccessToken(user);
    const refreshToken = (0, crypto_1.randomBytes)(32).toString("hex");
    await manager.getRepository(user_session_entity_1.UserSession).save(manager.getRepository(user_session_entity_1.UserSession).create({
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
        lastUsedAt: new Date(),
    }));
    return { accessToken, refreshToken };
}
function setAuthCookies(res, session) {
    res.cookie("token", session.accessToken, {
        ...cookieOptions,
        maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    res.cookie("refreshToken", session.refreshToken, {
        ...cookieOptions,
        maxAge: REFRESH_TOKEN_TTL_MS,
    });
}
function setAccessCookie(res, token) {
    res.cookie("token", token, {
        ...cookieOptions,
        maxAge: ACCESS_TOKEN_MAX_AGE,
    });
}
function setRefreshCookie(res, token) {
    res.cookie("refreshToken", token, {
        ...cookieOptions,
        maxAge: REFRESH_TOKEN_TTL_MS,
    });
}
function clearAuthCookies(res) {
    res.clearCookie("token", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);
}
