import type { RequestHandler } from "express";
import Joi from "joi";
import { AppError } from "../errors/app.error";

export function validateRequestBody(schema: Joi.ObjectSchema): RequestHandler {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      convert: true,
    });

    if (error) {
      next(
        new AppError(
          error.details.map((detail) => detail.message).join(", "),
          400,
          "VALIDATION_ERROR",
        ),
      );
      return;
    }

    req.body = value;
    next();
  };
}

export function validatePaginationQuery(
  defaultLimit: number,
  maxLimit: number,
): RequestHandler {
  const schema = createPaginationQuerySchema(defaultLimit, maxLimit);

  return (req, _res, next) => {
    const { error } = schema.validate(req.query, {
      abortEarly: false,
      convert: true,
    });

    if (error) {
      next(
        new AppError(
          error.details.map((detail) => detail.message).join(", "),
          400,
          "VALIDATION_ERROR",
        ),
      );
      return;
    }

    next();
  };
}

export function createPaginationQuerySchema(
  defaultLimit: number,
  maxLimit: number,
): Joi.ObjectSchema {
  return Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(maxLimit).default(defaultLimit),
  }).unknown(false);
}
