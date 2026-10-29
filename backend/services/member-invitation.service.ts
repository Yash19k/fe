import { createHash, randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { AppDataSource } from "../config/data.source";
import { User } from "../entities/user.entity";
import { Organization } from "../entities/organization.entity";
import { UserRole, UserStatus } from "../entities/user.entity";
import { sendInvitationEmail } from "./mail.service";

const INVITATION_EXPIRY_HOURS = 48;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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
    role: member.role || UserRole.TEAMMATE,
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

  const conflictingUsers = existingUsers.filter(
    (user) =>
      user.status !== UserStatus.PENDING ||
      user.organizationId !== organizationId,
  );

  if (conflictingUsers.length > 0) {
    throw new Error(
      `These email addresses already exist or belong to another organization: ${conflictingUsers
        .map((user) => user.email)
        .join(", ")}`,
    );
  }

  const invitations = await Promise.all(
    normalizedMembers.map(async (member) => {
      const inviteToken = randomBytes(32).toString("hex");
      const inviteTokenHash = hashToken(inviteToken);
      const inviteExpiresAt = new Date(
        Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000,
      );

      return {
        ...member,
        inviteToken,
        inviteTokenHash,
        inviteExpiresAt,
      };
    }),
  );

  // Create or update pending user records atomically before sending emails
  await AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(User);

    for (const invitation of invitations) {
      const existingPending = await repository
        .createQueryBuilder("user")
        .setLock("pessimistic_write")
        .where("LOWER(user.email) = :email", { email: invitation.email })
        .getOne();

      if (existingPending) {
        if (
          existingPending.status !== UserStatus.PENDING ||
          existingPending.organizationId !== organizationId
        ) {
          throw new Error(
            `These email addresses already exist or belong to another organization: ${invitation.email}`,
          );
        }
        existingPending.organizationId = organizationId;
        existingPending.role = invitation.role;
        existingPending.passwordHash = null;
        existingPending.inviteTokenHash = invitation.inviteTokenHash;
        existingPending.inviteExpiresAt = invitation.inviteExpiresAt;
        existingPending.status = UserStatus.PENDING;
        await repository.save(existingPending);
      } else {
        const user = repository.create({
          email: invitation.email,
          fullName: null,
          organizationId,
          role: invitation.role,
          passwordHash: null,
          status: UserStatus.PENDING,
          inviteTokenHash: invitation.inviteTokenHash,
          inviteExpiresAt: invitation.inviteExpiresAt,
        });
        await repository.save(user);
      }
    }
  });

  // Send each user their invitation details
  const results = await Promise.all(
    invitations.map(async (invitation) => {
      try {
        await sendInvitationEmail({
          email: invitation.email,
          organizationName: organization.name,
          role: invitation.role,
          invitationToken: invitation.inviteToken,
        });

        return {
          email: invitation.email,
          role: invitation.role,
          token: invitation.inviteToken,
          emailSent: true,
        };
      } catch {
        // Never expose the temporary password in error responses or logs.
        return {
          email: invitation.email,
          role: invitation.role,
          token: invitation.inviteToken,
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
  const passwordHash = await bcrypt.hash(password, 12);

  return AppDataSource.transaction(async (manager) => {
    const userRepo = manager.getRepository(User);
    const user = await userRepo
      .createQueryBuilder("user")
      .setLock("pessimistic_write")
      .where("user.invite_token_hash = :tokenHash", { tokenHash })
      .getOne();

    if (!user || !user.inviteExpiresAt) {
      throw new Error("Invalid invitation token");
    }

    if (user.inviteExpiresAt.getTime() <= Date.now()) {
      throw new Error("Invitation has expired");
    }

    if (user.status !== UserStatus.PENDING) {
      throw new Error("Invitation has already been accepted or is invalid");
    }

    user.fullName = fullName.trim();
    user.passwordHash = passwordHash;
    user.status = UserStatus.ACTIVE;
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
  });
}
