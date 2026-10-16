import { Request, Response, NextFunction } from "express";
import { ProjectVisibility } from "../entities/project.entity";
import { AppError } from "../errors/app.error";
import Joi from "joi";
import { UserRole } from "../entities/user.entity";

const projectIdSchema = Joi.object({
  projectId: Joi.string()
    .guid({ version: ["uuidv4"] })
    .required(),
}).unknown(true);

const createProjectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150).required(),
  key: Joi.string()
    .trim()
    .pattern(/^[A-Za-z][A-Za-z0-9_-]{1,19}$/)
    .required(),
  description: Joi.string().allow("", null).max(10000).optional(),
  startDate: Joi.string().isoDate().allow(null).optional(),
  endDate: Joi.string().isoDate().allow(null).optional(),
  visibility: Joi.string()
    .valid(...Object.values(ProjectVisibility))
    .default(ProjectVisibility.PRIVATE),
})
  .custom((value, helpers) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      return helpers.error("date.order");
    }
    return value;
  })
  .messages({
    "date.order": "endDate must be on or after startDate",
  })
  .unknown(false);

export const validateCreateProject = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { error, value } = createProjectSchema.validate(req.body, {
    abortEarly: false,
    convert: true,
  });
  if (error) {
    throw new AppError(
      error.details.map((detail) => detail.message).join(", "),
      400,
      "VALIDATION_ERROR",
    );
  }
  req.body = value;
  next();
};

export const validateProjectId = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const { error } = projectIdSchema.validate(req.params);
  if (error) {
    throw new AppError("Invalid project ID.", 400, "INVALID_PROJECT_ID");
  }
  next();
};
export const invitedMembers = Joi.array()
  .items(
    Joi.object({
      email: Joi.string().email().lowercase().trim().required(),
      role: Joi.string()
        .valid(...Object.values(UserRole)) // Uses your TypeScript Enum values dynamically
        .required(),
    }),
  )
  .optional() // Allows empty or missing array
  .default([]); // Defaults to empty array if omitted

// import Joi from "joi";

export const acceptInvitationSchema = Joi.object({
  token: Joi.string().trim().required().messages({
    "string.empty": "Invitation token is required",
    "any.required": "Invitation token is required",
  }),

  fullName: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Full name is required",
    "string.min": "Full name must be at least 2 characters long",
    "string.max": "Full name cannot exceed 100 characters",
    "any.required": "Full name is required",
  }),

  password: Joi.string()
    .min(8)
    .max(128)
    // Optional regex: Requires at least one uppercase letter, one lowercase letter, and one number
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 8 characters long",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      "any.required": "Password is required",
    }),
});

export const invitedMemberSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } }) // Valid email format
    .lowercase()
    .trim()
    .required()
    .messages({
      "string.email": "Each member must have a valid email address",
      "any.required": "Member email is required",
    }),

  role: Joi.string()
    .valid("ADMIN", "MEMBER", "GUEST") // Replace with your allowed role values or Object.values(UserRole)
    .required()
    .messages({
      "any.only": "Role must be one of: ADMIN, MEMBER, GUEST",
      "any.required": "Member role is required",
    }),
});