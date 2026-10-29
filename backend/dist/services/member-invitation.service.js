"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvitationUrl = createInvitationUrl;
exports.inviteOrganizationMembers = inviteOrganizationMembers;
exports.acceptOrganizationInvitation = acceptOrganizationInvitation;
const crypto_1 = require("crypto");
const bcrypt_1 = __importDefault(require("bcrypt"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../config/data.source");
const config_1 = require("../config/config");
const member_invitation_entity_1 = require("../entities/member-invitation.entity");
const organization_entity_1 = require("../entities/organization.entity");
const user_entity_1 = require("../entities/user.entity");
const app_error_1 = require("../errors/app.error");
const auth_session_service_1 = require("./auth-session.service");
const mail_service_1 = require("./mail.service");
function hashToken(token) {
    return (0, crypto_1.createHash)("sha256").update(token).digest("hex");
}
function createInvitationUrl(token) {
    const url = new URL(config_1.config.frontendUrl);
    url.hash = `/accept-invitation?token=${encodeURIComponent(token)}`;
    return url.toString();
}
function isUniqueViolation(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505");
}
async function inviteOrganizationMembers(organizationId, members) {
    const normalizedMembers = members.map((member) => ({
        email: member.email.trim().toLowerCase(),
        role: member.role || user_entity_1.UserRole.TEAMMATE,
    }));
    const emails = normalizedMembers.map((member) => member.email);
    if (new Set(emails).size !== emails.length) {
        throw new app_error_1.AppError("Duplicate email addresses are not allowed.", 400, "DUPLICATE_INVITATION_EMAIL");
    }
    const organization = await data_source_1.AppDataSource.getRepository(organization_entity_1.Organization).findOne({
        where: { id: organizationId },
    });
    if (!organization) {
        throw new app_error_1.AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
    }
    const results = [];
    for (const member of normalizedMembers) {
        const rawToken = (0, crypto_1.randomBytes)(32).toString("hex");
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + config_1.config.invitationLifetimeHours * 60 * 60 * 1000);
        let createdUser = false;
        let previousUserState = null;
        let invitationId = null;
        try {
            await data_source_1.AppDataSource.transaction(async (manager) => {
                const users = manager.getRepository(user_entity_1.User);
                const user = await users
                    .createQueryBuilder("user")
                    .setLock("pessimistic_write")
                    .where("LOWER(user.email) = :email", { email: member.email })
                    .getOne();
                if (user &&
                    (user.status !== user_entity_1.UserStatus.PENDING ||
                        user.organizationId !== organizationId)) {
                    throw new app_error_1.AppError("An account with this email cannot be invited.", 409, "INVITATION_EMAIL_UNAVAILABLE");
                }
                let invitedUser;
                if (user) {
                    invitedUser = user;
                    previousUserState = {
                        email: user.email,
                        fullName: user.fullName,
                        passwordHash: user.passwordHash,
                        organizationId: user.organizationId,
                        role: user.role,
                        status: user.status,
                        inviteTokenHash: user.inviteTokenHash,
                        inviteExpiresAt: user.inviteExpiresAt,
                    };
                    invitedUser.email = member.email;
                    invitedUser.role = member.role;
                    invitedUser.passwordHash = null;
                    invitedUser.status = user_entity_1.UserStatus.PENDING;
                    invitedUser.inviteTokenHash = null;
                    invitedUser.inviteExpiresAt = null;
                    await users.save(invitedUser);
                }
                else {
                    invitedUser = await users.save(users.create({
                        email: member.email,
                        fullName: null,
                        organizationId,
                        role: member.role,
                        passwordHash: null,
                        status: user_entity_1.UserStatus.PENDING,
                    }));
                    createdUser = true;
                }
                const invitations = manager.getRepository(member_invitation_entity_1.MemberInvitation);
                await invitations.update({
                    userId: invitedUser.id,
                    consumedAt: (0, typeorm_1.IsNull)(),
                    revokedAt: (0, typeorm_1.IsNull)(),
                }, { revokedAt: new Date() });
                const invitation = await invitations.save(invitations.create({
                    userId: invitedUser.id,
                    organizationId,
                    email: member.email,
                    role: member.role,
                    tokenHash,
                    expiresAt,
                    consumedAt: null,
                    revokedAt: null,
                }));
                invitationId = invitation.id;
            });
        }
        catch (error) {
            if (isUniqueViolation(error)) {
                throw new app_error_1.AppError("An account with this email cannot be invited.", 409, "INVITATION_EMAIL_UNAVAILABLE");
            }
            throw error;
        }
        try {
            await (0, mail_service_1.sendInvitationEmail)({
                email: member.email,
                organizationName: organization.name,
                role: member.role,
                invitationUrl: createInvitationUrl(rawToken),
                expiresInHours: config_1.config.invitationLifetimeHours,
            });
        }
        catch (deliveryError) {
            await data_source_1.AppDataSource.transaction(async (manager) => {
                const invitations = manager.getRepository(member_invitation_entity_1.MemberInvitation);
                if (invitationId) {
                    await invitations.delete({ id: invitationId });
                }
                const users = manager.getRepository(user_entity_1.User);
                const user = await users
                    .createQueryBuilder("user")
                    .setLock("pessimistic_write")
                    .where("LOWER(user.email) = :email", { email: member.email })
                    .andWhere("user.organization_id = :organizationId", {
                    organizationId,
                })
                    .getOne();
                if (user && createdUser) {
                    await users.delete({ id: user.id });
                }
                else if (user && previousUserState) {
                    Object.assign(user, previousUserState);
                    await users.save(user);
                }
            });
            throw deliveryError;
        }
        results.push({ email: member.email, role: member.role, emailSent: true });
    }
    return {
        message: "Invitation emails submitted successfully.",
        invitations: results,
    };
}
async function acceptOrganizationInvitation(token, fullName, password) {
    const tokenHash = hashToken(token);
    const invitationRepository = data_source_1.AppDataSource.getRepository(member_invitation_entity_1.MemberInvitation);
    const candidate = await invitationRepository.findOne({
        where: { tokenHash },
    });
    if (!candidate) {
        throw new app_error_1.AppError("This invitation is invalid or no longer available.", 400, "INVITATION_INVALID");
    }
    return data_source_1.AppDataSource.transaction(async (manager) => {
        const users = manager.getRepository(user_entity_1.User);
        const user = await users
            .createQueryBuilder("user")
            .setLock("pessimistic_write")
            .where("user.id = :userId", { userId: candidate.userId })
            .getOne();
        const invitations = manager.getRepository(member_invitation_entity_1.MemberInvitation);
        const invitation = await invitations
            .createQueryBuilder("invitation")
            .setLock("pessimistic_write")
            .where("invitation.token_hash = :tokenHash", { tokenHash })
            .getOne();
        if (!user || !invitation) {
            throw new app_error_1.AppError("This invitation is invalid or no longer available.", 400, "INVITATION_INVALID");
        }
        if (invitation.revokedAt) {
            throw new app_error_1.AppError("This invitation is invalid or no longer available.", 400, "INVITATION_REVOKED");
        }
        if (invitation.consumedAt) {
            throw new app_error_1.AppError("This invitation is invalid or no longer available.", 400, "INVITATION_CONSUMED");
        }
        if (invitation.expiresAt.getTime() <= Date.now()) {
            throw new app_error_1.AppError("This invitation is invalid or no longer available.", 400, "INVITATION_EXPIRED");
        }
        const organization = await manager
            .getRepository(organization_entity_1.Organization)
            .findOne({ where: { id: invitation.organizationId } });
        if (user.status !== user_entity_1.UserStatus.PENDING ||
            user.organizationId !== invitation.organizationId ||
            user.role !== invitation.role ||
            user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase() ||
            !organization) {
            throw new app_error_1.AppError("This invitation is invalid or no longer available.", 400, "INVITATION_INVALID");
        }
        user.fullName = fullName.trim();
        user.passwordHash = await bcrypt_1.default.hash(password, 12);
        user.status = user_entity_1.UserStatus.ACTIVE;
        user.inviteTokenHash = null;
        user.inviteExpiresAt = null;
        await users.save(user);
        invitation.consumedAt = new Date();
        await invitations.save(invitation);
        const session = await (0, auth_session_service_1.createAuthSession)(manager, {
            id: user.id,
            role: user.role,
            organizationId: invitation.organizationId,
        });
        return {
            session,
            message: "Invitation accepted successfully.",
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
                organizationId: user.organizationId,
            },
        };
    });
}
