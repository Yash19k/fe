
import { createHash, randomInt } from "crypto";
import bcrypt from "bcrypt";
import { AppDataSource } from "../config/data.source";
import { User } from "../entities/user.entity";
import { Organization } from "../entities/organization.entity";
import { UserRole, UserStatus } from "../entities/user.entity";
import { sendInvitationEmail } from "./mail.service";

const INVITATION_EXPIRY_HOURS = 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateTemporaryPassword(): string {
  return randomInt(10_000_000, 100_000_000).toString();
}

export async function inviteOrganizationMembers(
  organizationId: string,
  members: Array<{
    email: string;
    role: UserRole.MANAGER | UserRole.TEAMMATE;
  }>,
) {
  const normalizedMembers = members.map((member) => ({
    email: member.email.trim().toLowerCase(),
    role: member.role,
  }));

  const emails = normalizedMembers.map((member) => member.email);

  if (new Set(emails).size !== emails.length) {
    throw new Error("Duplicate email addresses are not allowed");
  }

  const organizationRepo = AppDataSource.getRepository(Organization);
  const userRepo = AppDataSource.getRepository(User);

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
    throw new Error(
      `These email addresses already exist: ${existingUsers
        .map((user) => user.email)
        .join(", ")}`,
    );
  }

  const invitations = await Promise.all(
    normalizedMembers.map(async (member) => {
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);

      return {
        ...member,
        temporaryPassword,
        passwordHash,
      };
    }),
  );

  // Create user records atomically before sending emails.
  await AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(User);

    for (const invitation of invitations) {
      const user = repository.create({
        email: invitation.email,
        fullName: null,
        organizationId,
        role: invitation.role,
        passwordHash: invitation.passwordHash,
        status: UserStatus.ACTIVE,
        inviteTokenHash: null,
        inviteExpiresAt: null,
      });

      await repository.save(user);
    }
  });

  // Send each user their temporary login password.
  const results = await Promise.all(
    invitations.map(async (invitation) => {
      try {
        await sendInvitationEmail({
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
      } catch {
        // Never expose the temporary password in error responses or logs.
        return {
          email: invitation.email,
          role: invitation.role,
          emailSent: false,
          message: "User created, but the login email could not be submitted",
        };
      }
    }),
  );

  return {
    message: "Member creation completed",
    invitations: results,
  };
}

export async function acceptOrganizationInvitation(
  token: string,
  fullName: string,
  password: string,
) {
  const tokenHash = hashToken(token);
  const userRepo = AppDataSource.getRepository(User);

  const user = await userRepo.findOne({
    where: { inviteTokenHash: tokenHash },
  });

  if (!user || !user.inviteExpiresAt) {
    throw new Error("Invalid invitation token");
  }

  if (user.inviteExpiresAt.getTime() <= Date.now()) {
    throw new Error("Invitation has expired");
  }

  if (user.status !== UserStatus.PENDING) {
    throw new Error("Invitation has already been accepted or is invalid");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await userRepo
    .createQueryBuilder()
    .update(User)
    .set({
      fullName: fullName.trim(),
      passwordHash,
      status: UserStatus.ACTIVE,
      inviteTokenHash: null,
      inviteExpiresAt: null,
    })
    .where("id = :id", { id: user.id })
    .andWhere('"invite_token_hash" = :tokenHash', { tokenHash })
    .andWhere('"invite_expires_at" > :now', { now: new Date() })
    .andWhere("status = :status", { status: UserStatus.PENDING })
    .execute();

  if (result.affected !== 1) {
    throw new Error("Invitation is invalid, expired, or already used");
  }

  return {
    message: "Invitation accepted successfully. You can now log in.",
  };
}
