"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOrganization = registerOrganization;
exports.login = login;
exports.refreshAccessToken = refreshAccessToken;
exports.currentUser = currentUser;
exports.logout = logout;
exports.getOrganizationUsers = getOrganizationUsers;
const bcrypt = __importStar(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const data_source_1 = require("../config/data.source");
const user_entity_1 = require("../entities/user.entity");
const organization_entity_1 = require("../entities/organization.entity");
const organization_sla_entity_1 = require("../entities/organization.sla.entity");
const user_session_entity_1 = require("../entities/user.session.entity");
const user_validator_1 = require("../validations/user.validator");
const app_error_1 = require("../errors/app.error");
const config_1 = require("../config/config");
const userRepository = data_source_1.AppDataSource.getRepository(user_entity_1.User);
const organizationRepository = data_source_1.AppDataSource.getRepository(organization_entity_1.Organization);
const sessionRepository = data_source_1.AppDataSource.getRepository(user_session_entity_1.UserSession);
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
async function createAuthSession(user, res) {
    const accessToken = createAccessToken(user);
    const refreshToken = (0, crypto_1.randomBytes)(32).toString("hex");
    await sessionRepository.save(sessionRepository.create({
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
        lastUsedAt: new Date(),
    }));
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, refreshToken);
    return accessToken;
}
async function registerOrganization(req, res) {
    let payload = req.body;
    if (!payload.user && (payload.email || payload.adminName || payload.organizationName)) {
        payload = {
            user: {
                fullName: payload.adminName || payload.fullName || "Workspace Admin",
                email: payload.email,
                password: payload.password,
            },
            organization: {
                name: payload.organizationName || payload.name,
            },
        };
    }
    const { error, value } = user_validator_1.onboardingSchema.validate(payload, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        throw new app_error_1.AppError(error.details.map((d) => `${d.path.join(".")}: ${d.message}`).join(", "), 400, "VALIDATION_ERROR");
    }
    const { user, organization } = value;
    const existingUser = await userRepository.findOne({
        where: { email: user.email.toLowerCase() },
    });
    if (existingUser) {
        throw new app_error_1.AppError("A user with this email address already exists.", 409, "EMAIL_ALREADY_EXISTS");
    }
    const passwordHash = await bcrypt.hash(user.password, 12);
    const result = await data_source_1.AppDataSource.transaction(async (m) => {
        const org = await m.save(organization_entity_1.Organization, {
            name: organization.name,
        });
        const newUser = await m.save(user_entity_1.User, {
            organizationId: org.id,
            fullName: user.fullName,
            email: user.email.toLowerCase(),
            passwordHash,
            role: user_entity_1.UserRole.ADMIN,
            status: user_entity_1.UserStatus.ACTIVE,
        });
        await m.save(organization_sla_entity_1.OrganizationSla, {
            organizationId: org.id,
            urgentHours: 4,
            highHours: 8,
            mediumHours: 24,
            lowHours: 72,
            escalateHours: 8,
        });
        return { org, newUser };
    });
    const token = await createAuthSession({
        id: result.newUser.id,
        role: result.newUser.role,
        organizationId: result.org.id,
    }, res);
    return res.status(201).json({
        success: true,
        token,
        organizationId: result.org.id,
        userId: result.newUser.id,
        data: {
            organizationId: result.org.id,
            userId: result.newUser.id,
            token,
        },
        user: {
            id: result.newUser.id,
            name: result.newUser.fullName,
            email: result.newUser.email,
            role: result.newUser.role,
            companyId: result.org.id,
            companyName: result.org.name,
            onboardingCompleted: false,
        },
        organization: {
            id: result.org.id,
            name: result.org.name,
            createdByUserId: result.newUser.id,
            createdAt: result.org.createdAt,
        },
    });
}
async function login(req, res) {
    const { error, value } = user_validator_1.loginSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        throw new app_error_1.AppError(error.details
            .map((detail) => `${detail.path.join(".")}: ${detail.message}`)
            .join(", "), 400, "VALIDATION_ERROR");
    }
    const user = await userRepository.findOne({
        where: { email: value.email.toLowerCase() },
    });
    if (!user ||
        (user.status !== user_entity_1.UserStatus.ACTIVE && user.status !== user_entity_1.UserStatus.PENDING) ||
        !user.passwordHash ||
        !(await bcrypt.compare(value.password, user.passwordHash))) {
        throw new app_error_1.AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }
    if (user.status === user_entity_1.UserStatus.PENDING) {
        user.status = user_entity_1.UserStatus.ACTIVE;
        user.inviteTokenHash = null;
        user.inviteExpiresAt = null;
        await userRepository.save(user);
    }
    if (!user.organizationId) {
        throw new app_error_1.AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
    }
    const organization = await organizationRepository.findOne({
        where: { id: user.organizationId },
    });
    if (!organization) {
        throw new app_error_1.AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
    }
    const token = await createAuthSession({
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
    }, res);
    return res.json({
        success: true,
        token,
        user: {
            id: user.id,
            name: user.fullName,
            email: user.email,
            role: user.role,
            companyId: organization.id,
            companyName: organization.name,
            onboardingCompleted: true,
        },
        organization: {
            id: organization.id,
            name: organization.name,
            createdByUserId: user.id,
            createdAt: organization.createdAt,
        },
    });
}
/**
* POST /auth/refresh
 * Uses the refresh cookie to issue a new access token
 * and rotates the refresh token.
 */
async function refreshAccessToken(req, res) {
    const refreshToken = req.cookies?.refreshToken;
    if (typeof refreshToken !== "string" || !refreshToken) {
        clearAuthCookies(res);
        throw new app_error_1.AppError("Refresh token is missing. Please log in again.", 401, "REFRESH_TOKEN_MISSING");
    }
    const session = await sessionRepository.findOne({
        where: {
            tokenHash: hashRefreshToken(refreshToken),
        },
    });
    if (!session ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now()) {
        clearAuthCookies(res);
        throw new app_error_1.AppError("Refresh session is invalid or expired. Please log in again.", 401, "INVALID_REFRESH_TOKEN");
    }
    const user = await userRepository.findOne({
        where: { id: session.userId },
    });
    if (!user ||
        user.status !== user_entity_1.UserStatus.ACTIVE ||
        !user.organizationId) {
        session.revokedAt = new Date();
        await sessionRepository.save(session);
        clearAuthCookies(res);
        throw new app_error_1.AppError("Your account is unavailable. Please log in again.", 401, "INVALID_SESSION_USER");
    }
    const organization = await organizationRepository.findOne({
        where: { id: user.organizationId },
    });
    if (!organization) {
        session.revokedAt = new Date();
        await sessionRepository.save(session);
        clearAuthCookies(res);
        throw new app_error_1.AppError("Organization not found.", 401, "INVALID_SESSION_ORGANIZATION");
    }
    // Rotate the refresh token: the previous token stops matching
    // the stored hash after this update.
    const newRefreshToken = (0, crypto_1.randomBytes)(32).toString("hex");
    session.tokenHash = hashRefreshToken(newRefreshToken);
    session.expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    session.lastUsedAt = new Date();
    await sessionRepository.save(session);
    const accessToken = createAccessToken({
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
    });
    setAccessCookie(res, accessToken);
    setRefreshCookie(res, newRefreshToken);
    return res.status(200).json({
        success: true,
        message: "Access token refreshed successfully.",
        token: accessToken,
    });
}
async function currentUser(req, res) {
    const user = await userRepository.findOne({
        where: { id: req.user.id },
    });
    if (!user || user.status !== user_entity_1.UserStatus.ACTIVE) {
        throw new app_error_1.AppError("Invalid authentication token.", 401, "INVALID_TOKEN");
    }
    if (!user.organizationId) {
        throw new app_error_1.AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
    }
    const organization = await organizationRepository.findOne({
        where: { id: user.organizationId },
    });
    if (!organization) {
        throw new app_error_1.AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
    }
    return res.json({
        user: {
            id: user.id,
            name: user.fullName,
            email: user.email,
            role: user.role,
            companyId: organization.id,
            companyName: organization.name,
            onboardingCompleted: true,
        },
        organization: {
            id: organization.id,
            name: organization.name,
            createdByUserId: user.id,
            createdAt: organization.createdAt,
        },
    });
}
async function logout(req, res) {
    const refreshToken = req.cookies?.refreshToken;
    if (typeof refreshToken === "string" && refreshToken) {
        const session = await sessionRepository.findOne({
            where: {
                tokenHash: hashRefreshToken(refreshToken),
            },
        });
        if (session && !session.revokedAt) {
            session.revokedAt = new Date();
            await sessionRepository.save(session);
        }
    }
    clearAuthCookies(res);
    return res.json({ success: true });
}
async function getOrganizationUsers(req, res) {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
        throw new app_error_1.AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
    }
    const users = await userRepository.find({
        where: { organizationId, status: user_entity_1.UserStatus.ACTIVE },
        select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
        },
        order: { fullName: "ASC" },
    });
    return res.json({
        success: true,
        data: users.map((u) => ({
            id: u.id,
            name: u.fullName || u.email.split("@")[0],
            email: u.email,
            role: u.role,
            status: u.status,
            initials: (u.fullName || u.email).slice(0, 2).toUpperCase(),
        })),
    });
}
