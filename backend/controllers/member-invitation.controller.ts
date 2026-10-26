import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import {
  inviteOrganizationMembers,
  acceptOrganizationInvitation,
} from "../services/member-invitation.service";
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
  try {
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
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "Organization not found" ||
        error.message === "Duplicate email addresses are not allowed"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.startsWith("These email addresses already exist:")) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }
    }

    next(error);
  }
}

export async function acceptInvitationController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const payload = {
      ...req.body,
      token: req.body?.token || req.query?.token,
    };

    const { error, value } = acceptInvitationSchema.validate(payload, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      throw new AppError(
        error.details.map((detail: any) => detail.message).join(", "),
        400,
        "VALIDATION_ERROR",
      );
    }

    const result = await acceptOrganizationInvitation(
      value.token,
      value.fullName,
      value.password,
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const clientErrors = [
        "Invalid invitation token",
        "Invitation has expired",
        "Invitation has already been accepted or is invalid",
        "Invitation is invalid, expired, or already used",
      ];

      if (clientErrors.includes(error.message)) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }

    next(error);
  }
}
