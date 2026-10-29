"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authResetPasswordSchema = exports.authForgotPasswordSchema = exports.loginSchema = exports.onboardingSchema = exports.invitedMembersSchema = exports.signupSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const user_entity_1 = require("../entities/user.entity");
// const Joi = require("joi");
const passwordSchema = joi_1.default.string()
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
exports.signupSchema = joi_1.default.object({
    fullName: joi_1.default.string().min(3).max(50).trim().required().messages({
        "string.empty": "Full name is required",
        "string.min": "Full name must be at least 3 characters long",
    }),
    email: joi_1.default.string()
        .email({ tlds: { allow: false } })
        .lowercase()
        .trim()
        .required()
        .messages({
        "string.email": "Please provide a valid email address",
        "string.empty": "Email is required",
    }),
    password: joi_1.default.string().min(8).max(128).required().messages({
        "string.min": "Password must be at least 8 characters long",
        "string.empty": "Password is required",
    }),
});
exports.invitedMembersSchema = joi_1.default.alternatives().try(joi_1.default.array().items(joi_1.default.object({
    email: joi_1.default.string().email().required(),
    role: joi_1.default.string()
        .valid(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.TEAMMATE)
        .default(user_entity_1.UserRole.TEAMMATE),
})), joi_1.default.object({
    members: joi_1.default.array()
        .items(joi_1.default.object({
        email: joi_1.default.string().email().required(),
        role: joi_1.default.string()
            .valid(user_entity_1.UserRole.MANAGER, user_entity_1.UserRole.TEAMMATE)
            .default(user_entity_1.UserRole.TEAMMATE),
    }))
        .required(),
}));
exports.onboardingSchema = joi_1.default.object({
    user: joi_1.default.object({
        fullName: joi_1.default.string().trim().min(2).max(100).required(),
        email: joi_1.default.string().trim().lowercase().email().max(255).required(),
        password: passwordSchema,
    }).required(),
    organization: joi_1.default.object({
        name: joi_1.default.string().trim().min(2).max(150).required(),
    })
});
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().trim().lowercase().email().max(255).required(),
    password: passwordSchema,
});
exports.authForgotPasswordSchema = joi_1.default.object({
    email: joi_1.default.string().trim().lowercase().email().max(255).required().messages({
        "string.email": "Please provide a valid email address",
        "string.empty": "Email is required",
        "any.required": "Email is required",
    }),
});
exports.authResetPasswordSchema = joi_1.default.object({
    token: joi_1.default.string().trim().min(32).max(512).required().messages({
        "string.min": "Reset token is invalid",
        "string.empty": "Reset token is required",
        "any.required": "Reset token is required",
    }),
    newPassword: passwordSchema,
    confirmPassword: joi_1.default.string().valid(joi_1.default.ref("newPassword")).required().messages({
        "any.only": "Passwords do not match",
        "string.empty": "Confirm password is required",
        "any.required": "Confirm password is required",
    }),
});
