import { Request, Response } from "express";
import Joi from "joi";
import {
  acceptOrganizationInvitation,
  inviteOrganizationMembers,
} from "../services/member-invitation.service";
import { setAuthCookies } from "../services/auth-session.service";
import { UserRole } from "../entities/user.entity";
import { AppError } from "../errors/app.error";

const singleMemberSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string()
    .valid(UserRole.MANAGER, UserRole.TEAMMATE, UserRole.ADMIN)
    .default(UserRole.TEAMMATE),
});

const invitedMembersSchema = Joi.alternatives().try(
  Joi.array().items(singleMemberSchema),
  Joi.object({
    members: Joi.array().items(singleMemberSchema).required(),
  }),
  Joi.object({
    invitations: Joi.array().items(singleMemberSchema).required(),
  }),
);

export const acceptInvitationSchema = Joi.object({
  token: Joi.string().hex().length(64).required(),
  fullName: Joi.string().trim().min(1).max(100).required(),
  password: Joi.string()
    .min(8)
    .max(72)
    .custom((value, helpers) =>
      Buffer.byteLength(value, "utf8") > 72
        ? helpers.error("string.max")
        : value,
    )
    .required(),
});

export async function inviteMembersController(req: Request, res: Response) {
  const { error, value } = invitedMembersSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new AppError(
      error.details.map((detail) => detail.message).join(", "),
      400,
      "VALIDATION_ERROR",
    );
  }

  const authenticatedUser = req.user;
  if (!authenticatedUser) {
    throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
  }
  if (authenticatedUser.role !== UserRole.ADMIN) {
    throw new AppError(
      "Only organization admins can invite members.",
      403,
      "FORBIDDEN",
    );
  }
  if (!authenticatedUser.organizationId) {
    throw new AppError(
      "Your account is not associated with an organization.",
      400,
      "ORGANIZATION_REQUIRED",
    );
  }

  const membersList = Array.isArray(value)
    ? value
    : value.members || value.invitations;
  const result = await inviteOrganizationMembers(
    authenticatedUser.organizationId,
    membersList,
  );

  return res.status(200).json({
    success: true,
    ...result,
  });
}

export async function acceptInvitationController(req: Request, res: Response) {
  const { error, value } = acceptInvitationSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new AppError(
      error.details.map((detail) => detail.message).join(", "),
      400,
      "VALIDATION_ERROR",
    );
  }

  const result = await acceptOrganizationInvitation(
    value.token,
    value.fullName,
    value.password,
  );
  setAuthCookies(res, result.session);

  return res.status(200).json({
    success: true,
    token: result.session.accessToken,
    message: result.message,
    user: result.user,
  });
}
