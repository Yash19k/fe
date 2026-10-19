"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.onboardingSchema = exports.signupSchema = void 0;
const joi_1 = __importDefault(require("joi"));
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
