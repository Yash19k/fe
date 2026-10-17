import { Request, Response, NextFunction } from "express";
import Joi from "joi";
import { AppError } from "../errors/app.error";
import { ProjectVisibility } from "../entities/project.entity";
import { ProjectRole } from "../entities/project.member.entity";

const uuidV4 = Joi.string().guid({ version: ["uuidv4"] });

const projectIdSchema = Joi.object({
  projectId: uuidV4.required(),
}).unknown(false);

const projectMemberParamsSchema = Joi.object({
  projectId: uuidV4.required(),
  memberId: uuidV4.required(),
}).unknown(false);

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

const updateProjectSchema = Joi.object({
  name: Joi.string().trim().min(1).max(150),
  key: Joi.string()
    .trim()
    .pattern(/^[A-Za-z][A-Za-z0-9_-]{1,19}$/),
  description: Joi.string().allow("", null).max(10000),
  startDate: Joi.string().isoDate().allow(null),
  endDate: Joi.string().isoDate().allow(null),
  visibility: Joi.string().valid(...Object.values(ProjectVisibility)),
})
  .min(1)
  .unknown(false);

const addProjectMemberSchema = Joi.object({
  memberId: uuidV4,
  email: Joi.string().email({ tlds: { allow: false } }).trim().lowercase(),
  role: Joi.string()
    .valid(...Object.values(ProjectRole))
    .default(ProjectRole.MEMBER),
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

const updateProjectMemberRoleSchema = Joi.object({
  role: Joi.string().valid(...Object.values(ProjectRole)).required(),
}).unknown(false);

const validate = (
  schema: Joi.ObjectSchema,
  source: "body" | "params",
) => (req: Request, _res: Response, next: NextFunction): void => {
  const { error, value } = schema.validate(req[source], {
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

  req[source] = value;
  next();
};

export const validateCreateProject = validate(
  createProjectSchema,
  "body",
);

export const validateUpdateProject = validate(
  updateProjectSchema,
  "body",
);

export const validateProjectId = validate(
  projectIdSchema,
  "params",
);

export const validateProjectMemberParams = validate(
  projectMemberParamsSchema,
  "params",
);

export const validateAddProjectMember = validate(
  addProjectMemberSchema,
  "body",
);

export const validateUpdateProjectMemberRole = validate(
  updateProjectMemberRoleSchema,
  "body",
);
