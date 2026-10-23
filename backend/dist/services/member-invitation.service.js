"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteOrganizationMembers = inviteOrganizationMembers;
exports.acceptOrganizationInvitation = acceptOrganizationInvitation;
const crypto_1 = require("crypto");
const bcrypt_1 = __importDefault(require("bcrypt"));
const data_source_1 = require("../config/data.source");
const user_entity_1 = require("../entities/user.entity");
const organization_entity_1 = require("../entities/organization.entity");
const user_entity_2 = require("../entities/user.entity");
const mail_service_1 = require("./mail.service");
const INVITATION_EXPIRY_HOURS = 24;
function hashToken(token) {
    return (0, crypto_1.createHash)("sha256").update(token).digest("hex");
}
function generateTemporaryPassword() {
    return (0, crypto_1.randomInt)(10000000, 100000000).toString();
}
async function inviteOrganizationMembers(organizationId, members) {
    const normalizedMembers = members.map((member) => ({
        email: member.email.trim().toLowerCase(),
        role: member.role,
    }));
    const emails = normalizedMembers.map((member) => member.email);
    if (new Set(emails).size !== emails.length) {
        throw new Error("Duplicate email addresses are not allowed");
    }
    const organizationRepo = data_source_1.AppDataSource.getRepository(organization_entity_1.Organization);
    const userRepo = data_source_1.AppDataSource.getRepository(user_entity_1.User);
    const organization = await organizationRepo.findOneBy({
        id: organizationId,
    });
    if (!organization) {
        throw new Error("Organization not found");
    }
    const existingUsers = await userRepo
        .createQueryBuilder("user")
        .where("LOWER(user.email) IN (:...emails)", { emails })
        .getMany();
    if (existingUsers.length > 0) {
        throw new Error(`These email addresses already exist: ${existingUsers
            .map((user) => user.email)
            .join(", ")}`);
    }
    const invitations = await Promise.all(normalizedMembers.map(async (member) => {
        const temporaryPassword = generateTemporaryPassword();
        const passwordHash = await bcrypt_1.default.hash(temporaryPassword, 12);
        return {
            ...member,
            temporaryPassword,
            passwordHash,
        };
    }));
    // Create user records atomically before sending emails.
    await data_source_1.AppDataSource.transaction(async (manager) => {
        const repository = manager.getRepository(user_entity_1.User);
        for (const invitation of invitations) {
            const user = repository.create({
                email: invitation.email,
                fullName: null,
                organizationId,
                role: invitation.role,
                passwordHash: invitation.passwordHash,
                status: user_entity_2.UserStatus.ACTIVE,
                inviteTokenHash: null,
                inviteExpiresAt: null,
            });
            await repository.save(user);
        }
    });
    // Send each user their temporary login password.
    const results = await Promise.all(invitations.map(async (invitation) => {
        try {
            await (0, mail_service_1.sendInvitationEmail)({
                email: invitation.email,
                organizationName: organization.name,
                role: invitation.role,
                temporaryPassword: invitation.temporaryPassword,
            });
            return {
                email: invitation.email,
                role: invitation.role,
                emailSent: true,
            };
        }
        catch {
            // Never expose the temporary password in error responses or logs.
            return {
                email: invitation.email,
                role: invitation.role,
                emailSent: false,
                message: "User created, but the login email could not be submitted",
            };
        }
    }));
    return {
        message: "Member creation completed",
        invitations: results,
    };
}
async function acceptOrganizationInvitation(token, fullName, password) {
    const tokenHash = hashToken(token);
    const userRepo = data_source_1.AppDataSource.getRepository(user_entity_1.User);
    const user = await userRepo.findOne({
        where: { inviteTokenHash: tokenHash },
    });
    if (!user || !user.inviteExpiresAt) {
        throw new Error("Invalid invitation token");
    }
    if (user.inviteExpiresAt.getTime() <= Date.now()) {
        throw new Error("Invitation has expired");
    }
    if (user.status !== user_entity_2.UserStatus.PENDING) {
        throw new Error("Invitation has already been accepted or is invalid");
    }
    const passwordHash = await bcrypt_1.default.hash(password, 12);
    const result = await userRepo
        .createQueryBuilder()
        .update(user_entity_1.User)
        .set({
        fullName: fullName.trim(),
        passwordHash,
        status: user_entity_2.UserStatus.ACTIVE,
        inviteTokenHash: null,
        inviteExpiresAt: null,
    })
        .where("id = :id", { id: user.id })
        .andWhere('"invite_token_hash" = :tokenHash', { tokenHash })
        .andWhere('"invite_expires_at" > :now', { now: new Date() })
        .andWhere("status = :status", { status: user_entity_2.UserStatus.PENDING })
        .execute();
    if (result.affected !== 1) {
        throw new Error("Invitation is invalid, expired, or already used");
    }
    return {
        message: "Invitation accepted successfully. You can now log in.",
    };
}
