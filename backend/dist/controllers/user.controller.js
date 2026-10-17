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
exports.currentUser = currentUser;
exports.logout = logout;
const bcrypt = __importStar(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const data_source_1 = require("../config/data.source");
const user_entity_1 = require("../entities/user.entity");
const organization_entity_1 = require("../entities/organization.entity");
const user_validator_1 = require("../validations/user.validator");
const app_error_1 = require("../errors/app.error");
const userRepository = data_source_1.AppDataSource.getRepository(user_entity_1.User);
const organizationRepository = data_source_1.AppDataSource.getRepository(organization_entity_1.Organization);
function issueAuthCookie(res, user) {
    const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new app_error_1.AppError("Internal server error.", 500, "INTERNAL_SERVER_ERROR");
    }
    const token = jsonwebtoken_1.default.sign({
        userId: user.id,
        role: user.role || "ADMIN",
        organizationId: user.organizationId || undefined,
        type: "ACCESS",
    }, secret, { algorithm: "HS256", expiresIn: "7d" });
    res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return token;
}
async function registerOrganization(req, res) {
    const { error, value } = user_validator_1.onboardingSchema.validate(req.body, {
        abortEarly: false, // return all errors, not just the first
        stripUnknown: true, // drop fields you didn't define
    });
    if (error) {
        throw new app_error_1.AppError(error.details.map((d) => `${d.path.join(".")}: ${d.message}`).join(", "), 400, "VALIDATION_ERROR");
    }
    const { user, organization } = value;
    try {
        // hash before the transaction so the DB connection isn't held while hashing
        const passwordHash = await bcrypt.hash(user.password, 12);
        const result = await data_source_1.AppDataSource.transaction(async (m) => {
            // step 2 data: organization
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
            return { org, newUser };
        });
        const token = issueAuthCookie(res, {
            id: result.newUser.id,
            role: result.newUser.role,
            organizationId: result.org.id,
        });
        return res.status(201).json({
            success: true,
            token,
            organizationId: result.org.id,
            userId: result.newUser.id,
            data: {
                organizationId: result.org.id,
                userId: result.newUser.id,
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
    catch (err) {
        // Postgres unique violation: email already exists
        if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
            throw new app_error_1.AppError("Email already in use", 409, "CONFLICT");
        }
        throw err;
    }
}
async function login(req, res) {
    const { error, value } = user_validator_1.loginSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        throw new app_error_1.AppError(error.details.map((detail) => `${detail.path.join(".")}: ${detail.message}`).join(", "), 400, "VALIDATION_ERROR");
    }
    const user = await userRepository.findOne({ where: { email: value.email } });
    if (!user || user.status !== user_entity_1.UserStatus.ACTIVE || !(await bcrypt.compare(value.password, user.passwordHash))) {
        throw new app_error_1.AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
    }
    if (!user.organizationId) {
        throw new app_error_1.AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
    }
    const organization = await organizationRepository.findOne({ where: { id: user.organizationId } });
    if (!organization) {
        throw new app_error_1.AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
    }
    const token = issueAuthCookie(res, {
        id: user.id,
        role: user.role,
        organizationId: user.organizationId,
    });
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
async function currentUser(req, res) {
    const userRepository = data_source_1.AppDataSource.getRepository(user_entity_1.User);
    const organizationRepository = data_source_1.AppDataSource.getRepository(organization_entity_1.Organization);
    const user = await userRepository.findOne({ where: { id: req.user.id } });
    if (!user || user.status !== user_entity_1.UserStatus.ACTIVE) {
        throw new app_error_1.AppError("Invalid authentication token.", 401, "INVALID_TOKEN");
    }
    if (!user.organizationId) {
        throw new app_error_1.AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
    }
    const organization = await organizationRepository.findOne({ where: { id: user.organizationId } });
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
async function logout(_req, res) {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
    });
    return res.json({ success: true });
}
