"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteMembersController = inviteMembersController;
exports.acceptInvitationController = acceptInvitationController;
const member_invitation_service_1 = require("../services/member-invitation.service");
const project_validations_1 = require("../validations/project.validations");
async function inviteMembersController(req, res, next) {
    try {
        const { error, value } = project_validations_1.invitedMembers.validate(req.body, {
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
        if (authenticatedUser.role !== "ADMIN") {
            return res.status(403).json({
                message: "Only organization admins can invite members",
            });
        }
        if (!authenticatedUser.organizationId) {
            return res.status(400).json({
                message: "Your account is not associated with an organization",
            });
        }
        const result = await (0, member_invitation_service_1.inviteOrganizationMembers)(authenticatedUser.organizationId, value);
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
        const { error, value } = project_validations_1.acceptInvitationSchema.validate(req.body, {
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
