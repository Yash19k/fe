"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLoggedIn = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_entity_1 = require("../entities/user.entity");
const data_source_1 = require("../config/data.source");
const config_1 = require("../config/config");
const app_error_1 = require("../errors/app.error");
const isLoggedIn = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const bearerToken = authHeader?.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : undefined;
        const token = req.cookies?.token || bearerToken;
        if (!token || typeof token !== "string") {
            throw new app_error_1.AppError("Authentication required. Please log in.", 401, "UNAUTHORIZED");
        }
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.accessTokenSecret, { algorithms: ["HS256"] });
        if (typeof decoded === "string" ||
            typeof decoded.userId !== "string" ||
            decoded.userId.length === 0 ||
            decoded.type !== "ACCESS") {
            throw new app_error_1.AppError("Invalid authentication token.", 401, "INVALID_TOKEN");
        }
        const payload = decoded;
        const userRepository = data_source_1.AppDataSource.getRepository(user_entity_1.User);
        const user = await userRepository.findOne({
            where: { id: payload.userId },
            select: {
                id: true,
                role: true,
                organizationId: true,
                status: true,
            },
        });
        if (!user || user.status !== user_entity_1.UserStatus.ACTIVE) {
            throw new app_error_1.AppError("Invalid authentication token.", 401, "INVALID_TOKEN");
        }
        req.user = {
            id: user.id,
            role: user.role,
            organizationId: user.organizationId ?? undefined,
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next(new app_error_1.AppError("Invalid or expired authentication token.", 401, "INVALID_TOKEN"));
            return;
        }
        next(error);
    }
};
exports.isLoggedIn = isLoggedIn;
