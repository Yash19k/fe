import type { RequestParamHandler } from "express";
import { AppError } from "../errors/app.error";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const validateUuidRouteParam: RequestParamHandler = (
  _req,
  _res,
  next,
  value,
  name,
) => {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    next(
      new AppError(
        `${name} must be a valid UUID.`,
        400,
        "VALIDATION_ERROR",
      ),
    );
    return;
  }

  next();
};
