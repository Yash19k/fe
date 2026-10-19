"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateProjectMemberRole = exports.validateAddProjectMember = exports.validateProjectMemberParams = exports.validateProjectId = exports.validateUpdateProject = exports.validateCreateProject = void 0;
const joi_1 = __importDefault(require("joi"));
const app_error_1 = require("../errors/app.error");
const project_entity_1 = require("../entities/project.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const uuidV4 = joi_1.default.string().guid({ version: ["uuidv4"] });
const projectIdSchema = joi_1.default.object({
    projectId: uuidV4.required(),
}).unknown(false);
const projectMemberParamsSchema = joi_1.default.object({
    projectId: uuidV4.required(),
    memberId: uuidV4.required(),
}).unknown(false);
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
const updateProjectSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(150),
    key: joi_1.default.string()
        .trim()
        .pattern(/^[A-Za-z][A-Za-z0-9_-]{1,19}$/),
    description: joi_1.default.string().allow("", null).max(10000),
    startDate: joi_1.default.string().isoDate().allow(null),
    endDate: joi_1.default.string().isoDate().allow(null),
    visibility: joi_1.default.string().valid(...Object.values(project_entity_1.ProjectVisibility)),
})
    .min(1)
    .unknown(false);
const addProjectMemberSchema = joi_1.default.object({
    memberId: uuidV4,
    email: joi_1.default.string().email({ tlds: { allow: false } }).trim().lowercase(),
    role: joi_1.default.string()
        .valid(...Object.values(project_member_entity_1.ProjectRole))
        .default(project_member_entity_1.ProjectRole.MEMBER),
})
    .custom((value, helpers) => {
    const hasMemberId = Boolean(value.memberId);
    const hasEmail = Boolean(value.email);
    if (hasMemberId === hasEmail) {
        return helpers.error("member.lookup");
    }
    return value;
})
    .messages({
    "member.lookup": "Provide exactly one of memberId or email.",
})
    .unknown(false);
const updateProjectMemberRoleSchema = joi_1.default.object({
    role: joi_1.default.string().valid(...Object.values(project_member_entity_1.ProjectRole)).required(),
}).unknown(false);
const validate = (schema, source) => (req, _res, next) => {
    const { error, value } = schema.validate(req[source], {
        abortEarly: false,
        convert: true,
    });
    if (error) {
        throw new app_error_1.AppError(error.details.map((detail) => detail.message).join(", "), 400, "VALIDATION_ERROR");
    }
    req[source] = value;
    next();
};
exports.validateCreateProject = validate(createProjectSchema, "body");
exports.validateUpdateProject = validate(updateProjectSchema, "body");
exports.validateProjectId = validate(projectIdSchema, "params");
exports.validateProjectMemberParams = validate(projectMemberParamsSchema, "params");
exports.validateAddProjectMember = validate(addProjectMemberSchema, "body");
exports.validateUpdateProjectMemberRole = validate(updateProjectMemberRoleSchema, "body");
