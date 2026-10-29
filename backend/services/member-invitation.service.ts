import { createHash, randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { IsNull } from "typeorm";
import { AppDataSource } from "../config/data.source";
import { config } from "../config/config";
import { MemberInvitation } from "../entities/member-invitation.entity";
import { Organization } from "../entities/organization.entity";
import { User, UserRole, UserStatus } from "../entities/user.entity";
import { AppError } from "../errors/app.error";
import { createAuthSession } from "./auth-session.service";
import { sendInvitationEmail } from "./mail.service";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createInvitationUrl(token: string): string {
  const url = new URL(config.frontendUrl);
  url.hash = `/accept-invitation?token=${encodeURIComponent(token)}`;
  return url.toString();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export async function inviteOrganizationMembers(
  organizationId: string,
  members: Array<{ email: string; role: UserRole }>,
) {
  const normalizedMembers = members.map((member) => ({
    email: member.email.trim().toLowerCase(),
    role: member.role || UserRole.TEAMMATE,
  }));
  const emails = normalizedMembers.map((member) => member.email);

  if (new Set(emails).size !== emails.length) {
    throw new AppError(
      "Duplicate email addresses are not allowed.",
      400,
      "DUPLICATE_INVITATION_EMAIL",
    );
  }

  const organization = await AppDataSource.getRepository(Organization).findOne({
    where: { id: organizationId },
  });
  if (!organization) {
    throw new AppError("Organization not found.", 404, "ORGANIZATION_NOT_FOUND");
  }

  const results: Array<{ email: string; role: UserRole; emailSent: true }> = [];
  for (const member of normalizedMembers) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + config.invitationLifetimeHours * 60 * 60 * 1000,
    );

    let createdUser = false;
    let previousUserState: Pick<
      User,
      | "email"
      | "fullName"
      | "passwordHash"
      | "organizationId"
      | "role"
      | "status"
      | "inviteTokenHash"
      | "inviteExpiresAt"
    > | null = null;
    let invitationId: string | null = null;

    try {
      await AppDataSource.transaction(async (manager) => {
        const users = manager.getRepository(User);
        const user = await users
          .createQueryBuilder("user")
          .setLock("pessimistic_write")
          .where("LOWER(user.email) = :email", { email: member.email })
          .getOne();

        if (
          user &&
          (user.status !== UserStatus.PENDING ||
            user.organizationId !== organizationId)
        ) {
          throw new AppError(
            "An account with this email cannot be invited.",
            409,
            "INVITATION_EMAIL_UNAVAILABLE",
          );
        }

        let invitedUser: User;
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
          invitedUser.status = UserStatus.PENDING;
          invitedUser.inviteTokenHash = null;
          invitedUser.inviteExpiresAt = null;
          await users.save(invitedUser);
        } else {
          invitedUser = await users.save(
            users.create({
              email: member.email,
              fullName: null,
              organizationId,
              role: member.role,
              passwordHash: null,
              status: UserStatus.PENDING,
            }),
          );
          createdUser = true;
        }

        const invitations = manager.getRepository(MemberInvitation);
        await invitations.update(
          {
            userId: invitedUser.id,
            consumedAt: IsNull(),
            revokedAt: IsNull(),
          },
          { revokedAt: new Date() },
        );

        const invitation = await invitations.save(
          invitations.create({
            userId: invitedUser.id,
            organizationId,
            email: member.email,
            role: member.role,
            tokenHash,
            expiresAt,
            consumedAt: null,
            revokedAt: null,
          }),
        );
        invitationId = invitation.id;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          "An account with this email cannot be invited.",
          409,
          "INVITATION_EMAIL_UNAVAILABLE",
        );
      }
      throw error;
    }

    try {
      await sendInvitationEmail({
        email: member.email,
        organizationName: organization.name,
        role: member.role,
        invitationUrl: createInvitationUrl(rawToken),
        expiresInHours: config.invitationLifetimeHours,
      });
    } catch (deliveryError) {
      await AppDataSource.transaction(async (manager) => {
        const invitations = manager.getRepository(MemberInvitation);
        if (invitationId) {
          await invitations.delete({ id: invitationId });
        }

        const users = manager.getRepository(User);
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
        } else if (user && previousUserState) {
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

export async function acceptOrganizationInvitation(
  token: string,
  fullName: string,
  password: string,
) {
  const tokenHash = hashToken(token);
  const invitationRepository = AppDataSource.getRepository(MemberInvitation);
  const candidate = await invitationRepository.findOne({
    where: { tokenHash },
  });

  if (!candidate) {
    throw new AppError(
      "This invitation is invalid or no longer available.",
      400,
      "INVITATION_INVALID",
    );
  }

  return AppDataSource.transaction(async (manager) => {
    const users = manager.getRepository(User);
    const user = await users
      .createQueryBuilder("user")
      .setLock("pessimistic_write")
      .where("user.id = :userId", { userId: candidate.userId })
      .getOne();
    const invitations = manager.getRepository(MemberInvitation);
    const invitation = await invitations
      .createQueryBuilder("invitation")
      .setLock("pessimistic_write")
      .where("invitation.token_hash = :tokenHash", { tokenHash })
      .getOne();

    if (!user || !invitation) {
      throw new AppError(
        "This invitation is invalid or no longer available.",
        400,
        "INVITATION_INVALID",
      );
    }
    if (invitation.revokedAt) {
      throw new AppError(
        "This invitation is invalid or no longer available.",
        400,
        "INVITATION_REVOKED",
      );
    }
    if (invitation.consumedAt) {
      throw new AppError(
        "This invitation is invalid or no longer available.",
        400,
        "INVITATION_CONSUMED",
      );
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new AppError(
        "This invitation is invalid or no longer available.",
        400,
        "INVITATION_EXPIRED",
      );
    }

    const organization = await manager
      .getRepository(Organization)
      .findOne({ where: { id: invitation.organizationId } });
    if (
      user.status !== UserStatus.PENDING ||
      user.organizationId !== invitation.organizationId ||
      user.role !== invitation.role ||
      user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase() ||
      !organization
    ) {
      throw new AppError(
        "This invitation is invalid or no longer available.",
        400,
        "INVITATION_INVALID",
      );
    }

    user.fullName = fullName.trim();
    user.passwordHash = await bcrypt.hash(password, 12);
    user.status = UserStatus.ACTIVE;
    user.inviteTokenHash = null;
    user.inviteExpiresAt = null;
    await users.save(user);

    invitation.consumedAt = new Date();
    await invitations.save(invitation);

    const session = await createAuthSession(manager, {
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
