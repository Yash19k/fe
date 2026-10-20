import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import {
  inviteOrganizationMembers,
  acceptOrganizationInvitation,
} from "../services/member-invitation.service";
import { validateEmailConfiguration } from "../services/mail.service";
import { UserRole } from "../entities/user.entity";
import { AppError } from "../errors/app.error";

const invitedMembersSchema = Joi.alternatives().try(
  Joi.array().items(
    Joi.object({
      email: Joi.string().email().required(),
      role: Joi.string()
        .valid(UserRole.MANAGER, UserRole.TEAMMATE, UserRole.ADMIN)
        .default(UserRole.TEAMMATE),
    })
  ),
  Joi.object({
    members: Joi.array().items(
      Joi.object({
        email: Joi.string().email().required(),
        role: Joi.string()
          .valid(UserRole.MANAGER, UserRole.TEAMMATE, UserRole.ADMIN)
          .default(UserRole.TEAMMATE),
      })
    ).required(),
  })
);

const acceptInvitationSchema = Joi.object({
  token: Joi.string().required(),
  fullName: Joi.string().trim().min(1).max(100).required(),
  password: Joi.string().min(6).max(100).required(),
});

export async function inviteMembersController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { error, value } = invitedMembersSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new AppError(
      "Validation failed",
      400,
      "VALIDATION_ERROR",
    );
  }

  const authenticatedUser = req.user;

  if (!authenticatedUser) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }

  if (authenticatedUser.role !== UserRole.ADMIN) {
    throw new AppError(
      "Only organization admins can invite members",
      403,
      "FORBIDDEN",
    );
  }

  if (!authenticatedUser.organizationId) {
    throw new AppError(
      "Your account is not associated with an organization",
      400,
      "ORGANIZATION_REQUIRED",
    );
  }

  validateEmailConfiguration();

  const membersList = Array.isArray(value) ? value : value.members;

  return inviteOrganizationMembers(
    authenticatedUser.organizationId,
    membersList,
  ).then((result) => {
    const failedInvitations = result.invitations.filter(
      (invitation) => !invitation.emailSent,
    );

    if (failedInvitations.length > 0) {
      throw new AppError(
        "Invitation records were created, but one or more invitation emails could not be submitted.",
        502,
        "INVITATION_EMAIL_FAILED",
      );
    }

    return res.status(200).json(result);
  }, (serviceError: unknown) => {
    if (serviceError instanceof AppError) {
      throw serviceError;
    }

    if (serviceError instanceof Error) {
      if (
        serviceError.message === "Organization not found" ||
        serviceError.message === "Duplicate email addresses are not allowed"
      ) {
        throw new AppError(serviceError.message, 400, "INVITATION_INVALID");
      }

      if (serviceError.message.startsWith("These email addresses already exist:")) {
        throw new AppError(serviceError.message, 409, "INVITATION_CONFLICT");
      }
    }

    throw serviceError;
  });
}

export async function acceptInvitationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { error, value } = acceptInvitationSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new AppError("Validation failed", 400, "VALIDATION_ERROR");
  }

  return acceptOrganizationInvitation(
    value.token,
    value.fullName,
    value.password,
  ).then((result) => res.status(200).json(result), (serviceError: unknown) => {
    if (serviceError instanceof Error) {
      const clientErrors = [
        "Invalid invitation token",
        "Invitation has expired",
        "Invitation has already been accepted or is invalid",
        "Invitation is invalid, expired, or already used",
      ];

      if (clientErrors.includes(serviceError.message)) {
        throw new AppError(serviceError.message, 400, "INVITATION_INVALID");
      }
    }

    throw serviceError;
  });
}
