
import type { Request, Response, NextFunction } from "express";
import { createSprintSchema } from "../validations/sprint.validations";

export const validateCreateSprint = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { error, value } = createSprintSchema.validate(req.body, {
    abortEarly: false,
    convert: true,
    stripUnknown: false,
  });

  if (error) {
    res.status(400).json({
      success: false,
      message: "Validation failed.",
      code: "VALIDATION_ERROR",
      errors: error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      })),
    });

    return;
  }

  req.body = value;
  next();
};
