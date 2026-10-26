import { createHash, randomBytes, randomInt } from "crypto";
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

  const activeExistingUsers = existingUsers.filter(
    (u) => u.status === UserStatus.ACTIVE,
  );

  if (activeExistingUsers.length > 0) {
    throw new Error(
      `These email addresses already exist: ${activeExistingUsers
        .map((user) => user.email)
        .join(", ")}`,
    );
  }

  const pendingUserMap = new Map(
    existingUsers
      .filter((u) => u.status === UserStatus.PENDING)
      .map((u) => [u.email.toLowerCase(), u]),
  );

  const invitations = await Promise.all(
    normalizedMembers.map(async (member) => {
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);
      const inviteToken = randomBytes(32).toString("hex");
      const inviteTokenHash = hashToken(inviteToken);
      const inviteExpiresAt = new Date(
        Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000,
      );

      return {
        ...member,
        temporaryPassword,
        passwordHash,
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
      const existingPending = pendingUserMap.get(invitation.email);
      if (existingPending) {
        existingPending.organizationId = organizationId;
        existingPending.role = invitation.role;
        existingPending.passwordHash = invitation.passwordHash;
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
          passwordHash: invitation.passwordHash,
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
          temporaryPassword: invitation.temporaryPassword,
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
}
