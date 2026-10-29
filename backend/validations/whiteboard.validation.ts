import Joi from "joi";
import { AppError } from "../errors/app.error";
import { NextFunction, Request, Response } from "express";

const uuid = Joi.string().guid({ version: ["uuidv4"] });
const sceneData = Joi.object({
  elements: Joi.array().items(Joi.object().unknown(true)).required(),
  appState: Joi.object().unknown(true).default({}),
  files: Joi.object().unknown(true).default({}),
}).unknown(true);

function validate(schema: Joi.ObjectSchema, source: "body" | "params" | "query") {
  return (req: Request, _res: Response, next: NextFunction): void => {
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
    if (source === "query") {
      Object.assign(req.query, value);
    } else {
      req[source] = value;
    }
    next();
  };
}

export const validateProjectWhiteboardParams = validate(
  Joi.object({ projectId: uuid.required() }).unknown(false),
  "params",
);

export const validateWhiteboardParams = validate(
  Joi.object({ whiteboardId: uuid.required() }).unknown(false),
  "params",
);

export const validateWhiteboardRevisionParams = validate(
  Joi.object({
    whiteboardId: uuid.required(),
    revisionNumber: Joi.number().integer().min(1).required(),
  }).unknown(false),
  "params",
);

export const validateListWhiteboards = validate(
  Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(25),
  }).unknown(false),
  "query",
);

export const validateCreateWhiteboard = validate(
  Joi.object({
    name: Joi.string().trim().min(1).max(150).required(),
  }).unknown(false),
  "body",
);

export const validateUpdateWhiteboard = validate(
  Joi.object({
    sceneData: sceneData.required(),
    revision: Joi.number().integer().min(1).required(),
  }).unknown(false),
  "body",
);

export const validateRenameWhiteboard = validate(
  Joi.object({ name: Joi.string().trim().min(1).max(150).required() }).unknown(false),
  "body",
);
