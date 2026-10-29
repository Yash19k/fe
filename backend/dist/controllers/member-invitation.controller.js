"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptInvitationSchema = void 0;
exports.inviteMembersController = inviteMembersController;
exports.acceptInvitationController = acceptInvitationController;
const joi_1 = __importDefault(require("joi"));
const member_invitation_service_1 = require("../services/member-invitation.service");
const auth_session_service_1 = require("../services/auth-session.service");
const user_entity_1 = require("../entities/user.entity");
const app_error_1 = require("../errors/app.error");
const singleMemberSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    role: joi_1.default.string()
        .valid(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.TEAMMATE, user_entity_1.UserRole.ADMIN)
        .default(user_entity_1.UserRole.TEAMMATE),
});
const invitedMembersSchema = joi_1.default.alternatives().try(joi_1.default.array().items(singleMemberSchema), joi_1.default.object({
    members: joi_1.default.array().items(singleMemberSchema).required(),
}), joi_1.default.object({
    invitations: joi_1.default.array().items(singleMemberSchema).required(),
}));
exports.acceptInvitationSchema = joi_1.default.object({
    token: joi_1.default.string().hex().length(64).required(),
    fullName: joi_1.default.string().trim().min(1).max(100).required(),
    password: joi_1.default.string()
        .min(8)
        .max(72)
        .custom((value, helpers) => Buffer.byteLength(value, "utf8") > 72
        ? helpers.error("string.max")
        : value)
        .required(),
});
async function inviteMembersController(req, res) {
    const { error, value } = invitedMembersSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        throw new app_error_1.AppError(error.details.map((detail) => detail.message).join(", "), 400, "VALIDATION_ERROR");
    }
    const authenticatedUser = req.user;
    if (!authenticatedUser) {
        throw new app_error_1.AppError("Authentication required.", 401, "UNAUTHORIZED");
    }
    if (authenticatedUser.role !== user_entity_1.UserRole.ADMIN) {
        throw new app_error_1.AppError("Only organization admins can invite members.", 403, "FORBIDDEN");
    }
    if (!authenticatedUser.organizationId) {
        throw new app_error_1.AppError("Your account is not associated with an organization.", 400, "ORGANIZATION_REQUIRED");
    }
    const membersList = Array.isArray(value)
        ? value
        : value.members || value.invitations;
    const result = await (0, member_invitation_service_1.inviteOrganizationMembers)(authenticatedUser.organizationId, membersList);
    return res.status(200).json({
        success: true,
        ...result,
    });
}
async function acceptInvitationController(req, res) {
    const { error, value } = exports.acceptInvitationSchema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });
    if (error) {
        throw new app_error_1.AppError(error.details.map((detail) => detail.message).join(", "), 400, "VALIDATION_ERROR");
    }
    const result = await (0, member_invitation_service_1.acceptOrganizationInvitation)(value.token, value.fullName, value.password);
    (0, auth_session_service_1.setAuthCookies)(res, result.session);
    return res.status(200).json({
        success: true,
        token: result.session.accessToken,
        message: result.message,
        user: result.user,
    });
}
