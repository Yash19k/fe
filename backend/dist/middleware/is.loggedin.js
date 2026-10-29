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
        const cookieToken = typeof req.cookies?.token === "string" ? req.cookies.token : undefined;
        const candidateTokens = [];
        if (bearerToken)
            candidateTokens.push(bearerToken);
        if (cookieToken && cookieToken !== bearerToken)
            candidateTokens.push(cookieToken);
        if (candidateTokens.length === 0) {
            throw new app_error_1.AppError("Authentication required. Please log in.", 401, "UNAUTHORIZED");
        }
        let decoded = null;
        let lastError = null;
        for (const token of candidateTokens) {
            try {
                const candidate = jsonwebtoken_1.default.verify(token, config_1.config.accessTokenSecret, { algorithms: ["HS256"] });
                if (typeof candidate !== "string" &&
                    typeof candidate?.userId === "string" &&
                    candidate.userId.length > 0 &&
                    candidate.type === "ACCESS") {
                    decoded = candidate;
                    lastError = null;
                    break;
                }
            }
            catch (err) {
                lastError = err;
                decoded = null;
            }
        }
        if (!decoded || typeof decoded.userId !== "string" || decoded.userId.length === 0) {
            if (lastError instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new app_error_1.AppError("Invalid or expired authentication token.", 401, "INVALID_TOKEN");
            }
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
