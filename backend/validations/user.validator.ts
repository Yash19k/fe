  import Joi from "joi";
import { UserRole } from "../entities/user.entity";
  // const Joi = require("joi");
const passwordSchema = Joi.string()
  .min(8)
  .max(72)
  .custom((value, helpers) => {
    if (Buffer.byteLength(value, "utf8") > 72) {
      return helpers.error("string.max");
    }
    return value;
  })
  .required()
  .messages({
    "string.min": "Password must be at least 8 characters long",
    "string.max": "Password must not exceed 72 UTF-8 bytes",
    "string.empty": "Password is required",
    "any.required": "Password is required",
  });

  // 1. Define the schema for Full Name, Email, and Password
  export const signupSchema = Joi.object({
    fullName: Joi.string().min(3).max(50).trim().required().messages({
      "string.empty": "Full name is required",
      "string.min": "Full name must be at least 3 characters long",
    }),

    email: Joi.string()
      .email({ tlds: { allow: false } })
      .lowercase()
      .trim()
      .required()
      .messages({
        "string.email": "Please provide a valid email address",
        "string.empty": "Email is required",
      }),

    password: Joi.string().min(8).max(128).required().messages({
      "string.min": "Password must be at least 8 characters long",
      "string.empty": "Password is required",
    }),
  });
export const invitedMembersSchema = Joi.alternatives().try(
  Joi.array().items(
    Joi.object({
      email: Joi.string().email().required(),
      role: Joi.string()
        .valid(UserRole.MANAGER, UserRole.TEAMMATE, UserRole.ADMIN)
        .default(UserRole.TEAMMATE),
    }),
  ),
  Joi.object({
    members: Joi.array()
      .items(
        Joi.object({
          email: Joi.string().email().required(),
          role: Joi.string()
            .valid(UserRole.MANAGER, UserRole.TEAMMATE, UserRole.ADMIN)
            .default(UserRole.TEAMMATE),
        }),
      )
      .required(),
  }),
);


export const onboardingSchema = Joi.object({
  user: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().trim().lowercase().email().max(255).required(),
    password: passwordSchema,
  }).required(),

  organization: Joi.object({
    name: Joi.string().trim().min(2).max(150).required(),
})})

 export const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().max(255).required(),
  password: passwordSchema,
});