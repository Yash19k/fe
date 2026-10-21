
import { Request, Response, NextFunction } from "express";
import Joi from "joi";

import {
  WorkItemType,
  WorkItemStatus,
  WorkItemPriority,
} from "../entities/work.item.entity";
import {
  RecurrenceFrequency,
  MonthlyPattern,
} from "../entities/work.item.recurrence.entity";
import { AppError } from "../errors/app.error";


const assigneeSchema = Joi.object({
  userId: Joi.string().guid({ version: ["uuidv4"] }).required(),
startDate: Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      return helpers.error("any.invalid");
    }

    return value;
  }, "valid calendar date")
  .allow(null)
  .optional(),

  estimatedHours: Joi.number()
    .min(0)
    .precision(2)
    .allow(null)
    .optional(),
});

const dateOnlySchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      return helpers.error("any.invalid");
    }
    return value;
  });

const recurrenceSchema = Joi.object({
  frequency: Joi.string().valid(...Object.values(RecurrenceFrequency)).required(),
  interval: Joi.number().integer().min(1).default(1),
  daysOfWeek: Joi.array()
    .items(Joi.number().integer().min(0).max(6))
    .unique()
    .allow(null)
    .optional(),
  monthlyPattern: Joi.string().valid(...Object.values(MonthlyPattern)).allow(null).optional(),
  dayOfMonth: Joi.number().integer().min(1).max(31).allow(null).optional(),
  startsOn: dateOnlySchema.required(),
  endsOn: dateOnlySchema.allow(null).optional(),
  timezone: Joi.string().trim().max(100).default("UTC"),
}).unknown(false);

export const createWorkItemSchema = Joi.object({
  projectId: Joi.string()
    .guid({ version: ["uuidv4"] })
    .required(),

  sprintId: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .allow(null)
    .optional(),

  parentWorkItemId: Joi.string()
    .guid({ version: ["uuidv4"] })
    .allow(null)
    .optional(),

  type: Joi.string()
    .valid(...Object.values(WorkItemType))
    .required(),

  title: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .required(),

  description: Joi.string()
    .allow("", null)
    .optional(),

  priority: Joi.string()
    .valid(...Object.values(WorkItemPriority))
    .default(WorkItemPriority.MEDIUM),

  status: Joi.string()
    .valid(...Object.values(WorkItemStatus))
    .default(WorkItemStatus.BACKLOG),

  dueDate: Joi.date()
    .iso()
    .allow(null)
    .optional(),
  slaDeadline: Joi.date()
    .iso()
    .min("now")
    .allow(null)
    .optional(),

  assignees: Joi.array()
    .items(assigneeSchema)
    .unique("userId")
    .default([]),

  recurrence: recurrenceSchema.allow(null).optional(),
})
  .unknown(false);

export const validateCreateWorkItem = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { error, value } = createWorkItemSchema.validate(req.body, {
    abortEarly: false,
    convert: true,
    stripUnknown: false,
  });

  if (error) {
    const message = error.details
      .map((detail) => detail.message)
      .join(", ");

    throw new AppError(
      message,
      400,
      "VALIDATION_ERROR"
    );
  }

  req.body = value;
  next();
};

const updateWorkItemSchema = Joi.object({
  sprintId: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .allow(null)
    .optional(),
  title: Joi.string().trim().min(1).max(255).optional(),
  description: Joi.string().allow("", null).optional(),
  type: Joi.string().valid(...Object.values(WorkItemType)).optional(),
  priority: Joi.string().valid(...Object.values(WorkItemPriority)).optional(),
  status: Joi.string().valid(...Object.values(WorkItemStatus)).optional(),
  dueDate: Joi.date().iso().allow(null).optional(),
  slaDeadline: Joi.date().iso().min("now").allow(null).optional(),
  parentWorkItemId: Joi.string().guid({ version: ["uuidv4"] }).allow(null).optional(),
  assignees: Joi.array().items(assigneeSchema).unique("userId").allow(null).optional(),
  assigneeId: Joi.string().guid({ version: ["uuidv4"] }).allow(null, "").optional(),
  assigneeIds: Joi.array().items(Joi.string().guid({ version: ["uuidv4"] })).unique().allow(null).optional(),
}).min(1).unknown(false);

export const validateUpdateWorkItem = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const { error, value } = updateWorkItemSchema.validate(req.body, {
    abortEarly: false,
    convert: true,
  });
  if (error) {
    throw new AppError(error.details.map((detail) => detail.message).join(", "), 400, "VALIDATION_ERROR");
  }
  req.body = value;
  next();
};
const viewProjectWorkItemsParamsSchema = Joi.object({
  projectId: Joi.string()
    .guid({ version: ["uuidv4"] })
    .required(),
}).unknown(false);

const viewProjectWorkItemsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string()
    .valid(...Object.values(WorkItemStatus))
    .optional(),
  type: Joi.string()
    .valid(...Object.values(WorkItemType))
    .optional(),
}).unknown(false);

export const validateViewProjectWorkItems = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const paramsResult = viewProjectWorkItemsParamsSchema.validate(
    req.params,
    { abortEarly: false }
  );

  const queryResult = viewProjectWorkItemsQuerySchema.validate(
    req.query,
    { abortEarly: false, convert: true }
  );

  const errors = [
    ...(paramsResult.error?.details ?? []),
    ...(queryResult.error?.details ?? []),
  ];

  if (errors.length > 0) {
    throw new AppError(
      errors.map((detail) => detail.message).join(", "),
      400,
      "VALIDATION_ERROR"
    );
  }

  res.locals.validatedWorkItemQuery = queryResult.value;
  next();
};
