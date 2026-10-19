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
exports.addOrganizationMembers = addOrganizationMembers;
const bcrypt = __importStar(require("bcrypt"));
const data_source_1 = require("../config/data.source");
const user_entity_1 = require("../entities/user.entity");
const organization_entity_1 = require("../entities/organization.entity");
const user_validator_1 = require("../validations/user.validator");
const auth_token_1 = require("../utils/auth.token");
const joi_1 = __importDefault(require("joi"));
const user_session_entity_1 = require("../entities/user.session.entity");
const invitedMemberSchema = joi_1.default.array().items(joi_1.default.object({
    email: joi_1.default.string().email().required(),
    role: joi_1.default.string()
        .valid(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.TEAMMATE)
        .default(user_entity_1.UserRole.TEAMMATE),
}));
const userRepository = data_source_1.AppDataSource.getRepository(user_entity_1.User);
async function registerOrganization(req, res, next) {
    const { error, value } = user_validator_1.onboardingSchema.validate(req.body, {
        abortEarly: false, // return all errors, not just the first
        stripUnknown: true, // drop fields you didn't define
    });
    if (error) {
        return res.status(400).json({
            message: "Validation failed",
            errors: error.details.map((d) => ({
                field: d.path.join("."),
                message: d.message,
            })),
        });
    }
    const { user, organization } = value;
    try {
        // hash before the transaction so the DB connection isn't held while hashing
        const passwordHash = await bcrypt.hash(user.password, 12);
        const result = await data_source_1.AppDataSource.transaction(async (m) => {
            // step 2 data: organization
            const Exiuser = await m.findOne(user_entity_1.User, {
                where: { email: user.email },
            });
            if (Exiuser) {
                return null;
            }
            const org = await m.save(organization_entity_1.Organization, {
                name: organization.name,
            });
            // step 1 data: user, linked to the organization
            const newUser = await m.save(user_entity_1.User, {
                organizationId: org.id,
                fullName: user.fullName,
                email: user.email.toLowerCase(),
                passwordHash,
                role: user_entity_1.UserRole.ADMIN,
                status: user_entity_1.UserStatus.ACTIVE,
            });
            const { rawRefreshToken, tokenHash, refreshExpiry } = (0, auth_token_1.generateRefreshToken)();
            const uses = await m.save(user_session_entity_1.UserSession, {
                userId: newUser.id,
                tokenHash,
                expiresAt: refreshExpiry,
                revokedAt: null,
                lastUsedAt: null,
            });
            if (!uses) {
                return null;
            }
            return { org, newUser, rawRefreshToken, refreshExpiry };
        });
        if (!result) {
            return res.status(409).json({
                message: "email already in use",
                errors: [{ field: "user.email", message: "already in use" }],
            });
        }
        const { org, newUser, rawRefreshToken, refreshExpiry } = result;
        const accessToken = (0, auth_token_1.generateAccessToken)({
            userId: newUser.id,
            organizationId: org.id,
            role: newUser.role,
        });
        res.cookie("refreshToken", rawRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/api/auth/refresh",
            expires: refreshExpiry,
        });
        req.user = { id: newUser.id, email: newUser.email, role: newUser.role };
        return res.status(201).json({
            success: true,
            accessToken,
            data: {
                organizationId: org.id,
                userId: newUser.id,
                fullName: newUser.fullName,
                email: newUser.email,
            },
        });
    }
    catch (err) {
        // Postgres unique violation: email already exists
        if (err.code === "23505") {
            return res
                .status(409)
                .json({ message: "Email already in use" });
        }
        console.error(err);
        // return res.status(500).json({ message: "Something went wrong" });
        return next(err);
    }
}
// import { Request, Response, NextFunction } from "express";
const typeorm_1 = require("typeorm");
async function addOrganizationMembers(req, res, next) {
    const { error, value } = invitedMemberSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        return res.status(400).json({
            message: "Validation failed",
            errors: error.details.map((detail) => ({
                field: detail.path.join("."),
                message: detail.message,
            })),
        });
    }
    const authUser = req.user;
    if (!authUser) {
        return res.status(401).json({
            message: "Authentication required",
        });
    }
    if (authUser.role !== user_entity_1.UserRole.ADMIN) {
        return res.status(403).json({
            message: "Only organization admins can add members",
        });
    }
    const organizationId = authUser.organizationId;
    if (!organizationId) {
        return res.status(403).json({
            message: "Admin must belong to an organization",
        });
    }
    const members = value.map((member) => ({
        email: member.email.trim().toLowerCase(),
        role: member.role,
    }));
    // Prevent duplicate emails that differ only by capitalization.
    const emails = members.map((member) => member.email);
    if (new Set(emails).size !== emails.length) {
        return res.status(400).json({
            message: "Duplicate email addresses are not allowed",
        });
    }
    try {
        const result = await data_source_1.AppDataSource.transaction(async (manager) => {
            const added = [];
            const failed = [];
            for (const item of members) {
                const existingUser = await manager.findOne(user_entity_1.User, {
                    where: { email: item.email },
                });
                if (!existingUser) {
                    failed.push({
                        email: item.email,
                        reason: "User does not exist",
                    });
                    continue;
                }
                if (existingUser.organizationId === authUser.organizationId) {
                    failed.push({
                        email: item.email,
                        reason: "User already belongs to this organization",
                    });
                    continue;
                }
                if (existingUser.organizationId) {
                    failed.push({
                        email: item.email,
                        reason: "User already belongs to another organization",
                    });
                    continue;
                }
                existingUser.organizationId = organizationId;
                existingUser.role = item.role;
                const savedUser = await manager.save(user_entity_1.User, existingUser);
                added.push({
                    userId: savedUser.id,
                    email: savedUser.email,
                    role: savedUser.role,
                });
            }
            return { added, failed };
        });
        return res.status(200).json({
            message: "Member processing completed",
            data: {
                added: result.added,
                failed: result.failed,
                totalAdded: result.added.length,
                totalFailed: result.failed.length,
            },
        });
    }
    catch (err) {
        if (err instanceof typeorm_1.QueryFailedError) {
            const dbError = err.driverError;
            if (dbError.code === "23505") {
                return res.status(409).json({
                    message: "A unique constraint was violated",
                });
            }
        }
        return next(err);
    }
}
