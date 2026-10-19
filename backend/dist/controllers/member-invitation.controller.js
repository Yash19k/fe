"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteMembersController = inviteMembersController;
exports.acceptInvitationController = acceptInvitationController;
const joi_1 = __importDefault(require("joi"));
const member_invitation_service_1 = require("../services/member-invitation.service");
const user_entity_1 = require("../entities/user.entity");
const invitedMembersSchema = joi_1.default.alternatives().try(joi_1.default.array().items(joi_1.default.object({
    email: joi_1.default.string().email().required(),
    role: joi_1.default.string()
        .valid(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.TEAMMATE, user_entity_1.UserRole.ADMIN)
        .default(user_entity_1.UserRole.TEAMMATE),
})), joi_1.default.object({
    members: joi_1.default.array().items(joi_1.default.object({
        email: joi_1.default.string().email().required(),
        role: joi_1.default.string()
            .valid(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.TEAMMATE, user_entity_1.UserRole.ADMIN)
            .default(user_entity_1.UserRole.TEAMMATE),
    })).required(),
}));
const acceptInvitationSchema = joi_1.default.object({
    token: joi_1.default.string().required(),
    fullName: joi_1.default.string().trim().min(1).max(100).required(),
    password: joi_1.default.string().min(6).max(100).required(),
});
async function inviteMembersController(req, res, next) {
    try {
        const { error, value } = invitedMembersSchema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });
        if (error) {
            return res.status(400).json({
                message: "Validation failed",
                errors: error.details.map((detail) => detail.message),
            });
        }
        const authenticatedUser = req.user;
        if (!authenticatedUser) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }
        if (authenticatedUser.role !== user_entity_1.UserRole.ADMIN) {
            return res.status(403).json({
                message: "Only organization admins can invite members",
            });
        }
        if (!authenticatedUser.organizationId) {
            return res.status(400).json({
                message: "Your account is not associated with an organization",
            });
        }
        const membersList = Array.isArray(value) ? value : value.members;
        const result = await (0, member_invitation_service_1.inviteOrganizationMembers)(authenticatedUser.organizationId, membersList);
        return res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof Error) {
            if (error.message === "Organization not found" ||
                error.message === "Duplicate email addresses are not allowed") {
                return res.status(400).json({
                    message: error.message,
                });
            }
            if (error.message.startsWith("These email addresses already exist:")) {
                return res.status(409).json({
                    message: error.message,
                });
            }
        }
        next(error);
    }
}
async function acceptInvitationController(req, res, next) {
    try {
        const { error, value } = acceptInvitationSchema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });
        if (error) {
            return res.status(400).json({
                message: "Validation failed",
                errors: error.details.map((detail) => detail.message),
            });
        }
        const result = await (0, member_invitation_service_1.acceptOrganizationInvitation)(value.token, value.fullName, value.password);
        return res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof Error) {
            const clientErrors = [
                "Invalid invitation token",
                "Invitation has expired",
                "Invitation has already been accepted or is invalid",
                "Invitation is invalid, expired, or already used",
            ];
            if (clientErrors.includes(error.message)) {
                return res.status(400).json({
                    message: error.message,
                });
            }
        }
        next(error);
    }
}
