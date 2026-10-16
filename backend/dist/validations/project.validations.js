"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitedMemberSchema = exports.acceptInvitationSchema = exports.invitedMembers = exports.validateProjectId = exports.validateCreateProject = void 0;
const project_entity_1 = require("../entities/project.entity");
const app_error_1 = require("../errors/app.error");
const joi_1 = __importDefault(require("joi"));
const user_entity_1 = require("../entities/user.entity");
const projectIdSchema = joi_1.default.object({
    projectId: joi_1.default.string()
        .guid({ version: ["uuidv4"] })
        .required(),
}).unknown(true);
const createProjectSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(150).required(),
    key: joi_1.default.string()
        .trim()
        .pattern(/^[A-Za-z][A-Za-z0-9_-]{1,19}$/)
        .required(),
    description: joi_1.default.string().allow("", null).max(10000).optional(),
    startDate: joi_1.default.string().isoDate().allow(null).optional(),
    endDate: joi_1.default.string().isoDate().allow(null).optional(),
    visibility: joi_1.default.string()
        .valid(...Object.values(project_entity_1.ProjectVisibility))
        .default(project_entity_1.ProjectVisibility.PRIVATE),
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
const validateCreateProject = (req, res, next) => {
    const { error, value } = createProjectSchema.validate(req.body, {
        abortEarly: false,
        convert: true,
    });
    if (error) {
        throw new app_error_1.AppError(error.details.map((detail) => detail.message).join(", "), 400, "VALIDATION_ERROR");
    }
    req.body = value;
    next();
};
exports.validateCreateProject = validateCreateProject;
const validateProjectId = (req, _res, next) => {
    const { error } = projectIdSchema.validate(req.params);
    if (error) {
        throw new app_error_1.AppError("Invalid project ID.", 400, "INVALID_PROJECT_ID");
    }
    next();
};
exports.validateProjectId = validateProjectId;
exports.invitedMembers = joi_1.default.array()
    .items(joi_1.default.object({
    email: joi_1.default.string().email().lowercase().trim().required(),
    role: joi_1.default.string()
        .valid(...Object.values(user_entity_1.UserRole)) // Uses your TypeScript Enum values dynamically
        .required(),
}))
    .optional() // Allows empty or missing array
    .default([]); // Defaults to empty array if omitted
// import Joi from "joi";
exports.acceptInvitationSchema = joi_1.default.object({
    token: joi_1.default.string().trim().required().messages({
        "string.empty": "Invitation token is required",
        "any.required": "Invitation token is required",
    }),
    fullName: joi_1.default.string().trim().min(2).max(100).required().messages({
        "string.empty": "Full name is required",
        "string.min": "Full name must be at least 2 characters long",
        "string.max": "Full name cannot exceed 100 characters",
        "any.required": "Full name is required",
    }),
    password: joi_1.default.string()
        .min(8)
        .max(128)
        // Optional regex: Requires at least one uppercase letter, one lowercase letter, and one number
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .required()
        .messages({
        "string.empty": "Password is required",
        "string.min": "Password must be at least 8 characters long",
        "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, and one number",
        "any.required": "Password is required",
    }),
});
exports.invitedMemberSchema = joi_1.default.object({
    email: joi_1.default.string()
        .email({ tlds: { allow: false } }) // Valid email format
        .lowercase()
        .trim()
        .required()
        .messages({
        "string.email": "Each member must have a valid email address",
        "any.required": "Member email is required",
    }),
    role: joi_1.default.string()
        .valid("ADMIN", "MEMBER", "GUEST") // Replace with your allowed role values or Object.values(UserRole)
        .required()
        .messages({
        "any.only": "Role must be one of: ADMIN, MEMBER, GUEST",
        "any.required": "Member role is required",
    }),
});
