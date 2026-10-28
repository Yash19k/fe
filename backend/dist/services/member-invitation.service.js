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
const INVITATION_EXPIRY_HOURS = 48;
function hashToken(token) {
    return (0, crypto_1.createHash)("sha256").update(token).digest("hex");
}
function generateTemporaryPassword() {
    return (0, crypto_1.randomInt)(10000000, 100000000).toString();
}
async function inviteOrganizationMembers(organizationId, members) {
    const normalizedMembers = members.map((member) => ({
        email: member.email.trim().toLowerCase(),
        role: member.role || user_entity_2.UserRole.TEAMMATE,
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
    const activeExistingUsers = existingUsers.filter((u) => u.status === user_entity_2.UserStatus.ACTIVE);
    if (activeExistingUsers.length > 0) {
        throw new Error(`These email addresses already exist: ${activeExistingUsers
            .map((user) => user.email)
            .join(", ")}`);
    }
    const pendingUserMap = new Map(existingUsers
        .filter((u) => u.status === user_entity_2.UserStatus.PENDING)
        .map((u) => [u.email.toLowerCase(), u]));
    const invitations = await Promise.all(normalizedMembers.map(async (member) => {
        const temporaryPassword = generateTemporaryPassword();
        const passwordHash = await bcrypt_1.default.hash(temporaryPassword, 12);
        const inviteToken = (0, crypto_1.randomBytes)(32).toString("hex");
        const inviteTokenHash = hashToken(inviteToken);
        const inviteExpiresAt = new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);
        return {
            ...member,
            temporaryPassword,
            passwordHash,
            inviteToken,
            inviteTokenHash,
            inviteExpiresAt,
        };
    }));
    // Create or update pending user records atomically before sending emails
    await data_source_1.AppDataSource.transaction(async (manager) => {
        const repository = manager.getRepository(user_entity_1.User);
        for (const invitation of invitations) {
            const existingPending = pendingUserMap.get(invitation.email);
            if (existingPending) {
                existingPending.organizationId = organizationId;
                existingPending.role = invitation.role;
                existingPending.passwordHash = invitation.passwordHash;
                existingPending.inviteTokenHash = invitation.inviteTokenHash;
                existingPending.inviteExpiresAt = invitation.inviteExpiresAt;
                existingPending.status = user_entity_2.UserStatus.PENDING;
                await repository.save(existingPending);
            }
            else {
                const user = repository.create({
                    email: invitation.email,
                    fullName: null,
                    organizationId,
                    role: invitation.role,
                    passwordHash: invitation.passwordHash,
                    status: user_entity_2.UserStatus.PENDING,
                    inviteTokenHash: invitation.inviteTokenHash,
                    inviteExpiresAt: invitation.inviteExpiresAt,
                });
                await repository.save(user);
            }
        }
    });
    // Send each user their invitation details
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
                token: invitation.inviteToken,
                emailSent: true,
            };
        }
        catch {
            // Never expose the temporary password in error responses or logs.
            return {
                email: invitation.email,
                role: invitation.role,
                token: invitation.inviteToken,
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
    user.fullName = fullName.trim();
    user.passwordHash = passwordHash;
    user.status = user_entity_2.UserStatus.ACTIVE;
    user.inviteTokenHash = null;
    user.inviteExpiresAt = null;
    await userRepo.save(user);
    return {
        message: "Invitation accepted successfully. You can now log in.",
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            organizationId: user.organizationId,
        },
    };
}
