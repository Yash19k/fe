"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPermission = void 0;
const user_entity_1 = require("../entities/user.entity");
const data_source_1 = require("../config/data.source");
const ROLE_PERMISSIONS = {
    ADMIN: [
        "user:manage",
        "role:manage",
        "project:create",
        "project:read:all",
        "project:read",
        "project:update",
        "project:delete",
        "project:member:manage",
        "task:create",
        "task:read",
        "task:update",
        "task:delete",
        "task:assign",
        "task:comment",
    ],
    MANAGER: [
        "project:create",
        "project:read",
        "project:update",
        "project:member:manage",
        "task:create",
        "task:read",
        "task:update",
        "task:delete",
        "task:assign",
        "task:comment",
    ],
    TEAMMATE: [
        "project:read",
        "task:read",
        "task:update",
        "task:comment",
    ],
};
const checkPermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user?.id) {
            res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
            return;
        }
        const userRepository = data_source_1.AppDataSource.getRepository(user_entity_1.User);
        const user = await userRepository.findOne({
            where: {
                id: req.user.id,
            },
            select: {
                id: true,
                role: true,
            },
        });
        if (!user) {
            res.status(401).json({
                success: false,
                message: "User not found. Please log in again.",
            });
            return;
        }
        const role = user.role;
        if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role)) {
            res.status(403).json({
                success: false,
                message: "Invalid user role.",
            });
            return;
        }
        if (!ROLE_PERMISSIONS[role].includes(permission)) {
            res.status(403).json({
                success: false,
                message: "You do not have permission to perform this action.",
            });
            return;
        }
        next();
    };
};
exports.checkPermission = checkPermission;
