"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateViewProjectWorkItems = exports.validateUpdateWorkItem = exports.validateCreateWorkItem = exports.createWorkItemSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const work_item_entity_1 = require("../entities/work.item.entity");
const work_item_recurrence_entity_1 = require("../entities/work.item.recurrence.entity");
const app_error_1 = require("../errors/app.error");
const assigneeSchema = joi_1.default.object({
    userId: joi_1.default.string().guid({ version: ["uuidv4"] }).required(),
    startDate: joi_1.default.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .custom((value, helpers) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) ||
            date.toISOString().slice(0, 10) !== value) {
            return helpers.error("any.invalid");
        }
        return value;
    }, "valid calendar date")
        .allow(null)
        .optional(),
    estimatedHours: joi_1.default.number()
        .min(0)
        .precision(2)
        .allow(null)
        .optional(),
});
const dateOnlySchema = joi_1.default.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .custom((value, helpers) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        return helpers.error("any.invalid");
    }
    return value;
});
const recurrenceSchema = joi_1.default.object({
    frequency: joi_1.default.string().valid(...Object.values(work_item_recurrence_entity_1.RecurrenceFrequency)).required(),
    interval: joi_1.default.number().integer().min(1).default(1),
    daysOfWeek: joi_1.default.array()
        .items(joi_1.default.number().integer().min(0).max(6))
        .unique()
        .allow(null)
        .optional(),
    monthlyPattern: joi_1.default.string().valid(...Object.values(work_item_recurrence_entity_1.MonthlyPattern)).allow(null).optional(),
    dayOfMonth: joi_1.default.number().integer().min(1).max(31).allow(null).optional(),
    startsOn: dateOnlySchema.required(),
    endsOn: dateOnlySchema.allow(null).optional(),
    timezone: joi_1.default.string().trim().max(100).default("UTC"),
}).unknown(false);
exports.createWorkItemSchema = joi_1.default.object({
    projectId: joi_1.default.string()
        .guid({ version: ["uuidv4"] })
        .required(),
    sprintId: joi_1.default.string()
        .guid({ version: ["uuidv4", "uuidv5"] })
        .allow(null)
        .optional(),
    parentWorkItemId: joi_1.default.string()
        .guid({ version: ["uuidv4"] })
        .allow(null)
        .optional(),
    type: joi_1.default.string()
        .valid(...Object.values(work_item_entity_1.WorkItemType))
        .required(),
    title: joi_1.default.string()
        .trim()
        .min(1)
        .max(255)
        .required(),
    description: joi_1.default.string()
        .allow("", null)
        .optional(),
    priority: joi_1.default.string()
        .valid(...Object.values(work_item_entity_1.WorkItemPriority))
        .default(work_item_entity_1.WorkItemPriority.MEDIUM),
    status: joi_1.default.string()
        .valid(...Object.values(work_item_entity_1.WorkItemStatus))
        .default(work_item_entity_1.WorkItemStatus.BACKLOG),
    dueDate: joi_1.default.date()
        .iso()
        .allow(null)
        .optional(),
    slaDeadline: joi_1.default.date()
        .iso()
        .min("now")
        .allow(null)
        .optional(),
    assignees: joi_1.default.array()
        .items(assigneeSchema)
        .unique("userId")
        .default([]),
    labelId: joi_1.default.string()
        .guid({ version: ["uuidv4"] })
        .allow(null, "")
        .optional(),
    labels: joi_1.default.array()
        .items(joi_1.default.string().guid({ version: ["uuidv4"] }))
        .allow(null)
        .optional(),
    recurrence: recurrenceSchema.allow(null).optional(),
})
    .unknown(false);
const validateCreateWorkItem = (req, res, next) => {
    const { error, value } = exports.createWorkItemSchema.validate(req.body, {
        abortEarly: false,
        convert: true,
        stripUnknown: false,
    });
    if (error) {
        const message = error.details
            .map((detail) => detail.message)
            .join(", ");
        throw new app_error_1.AppError(message, 400, "VALIDATION_ERROR");
    }
    req.body = value;
    next();
};
exports.validateCreateWorkItem = validateCreateWorkItem;
const updateWorkItemSchema = joi_1.default.object({
    sprintId: joi_1.default.string()
        .guid({ version: ["uuidv4", "uuidv5"] })
        .allow(null)
        .optional(),
    title: joi_1.default.string().trim().min(1).max(255).optional(),
    description: joi_1.default.string().allow("", null).optional(),
    type: joi_1.default.string().valid(...Object.values(work_item_entity_1.WorkItemType)).optional(),
    priority: joi_1.default.string().valid(...Object.values(work_item_entity_1.WorkItemPriority)).optional(),
    status: joi_1.default.string().valid(...Object.values(work_item_entity_1.WorkItemStatus)).optional(),
    dueDate: joi_1.default.date().iso().allow(null).optional(),
    slaDeadline: joi_1.default.date().iso().min("now").allow(null).optional(),
    parentWorkItemId: joi_1.default.string().guid({ version: ["uuidv4"] }).allow(null).optional(),
    assignees: joi_1.default.array().items(assigneeSchema).unique("userId").allow(null).optional(),
    assigneeId: joi_1.default.string().guid({ version: ["uuidv4"] }).allow(null, "").optional(),
    assigneeIds: joi_1.default.array().items(joi_1.default.string().guid({ version: ["uuidv4"] })).unique().allow(null).optional(),
    labelId: joi_1.default.string().guid({ version: ["uuidv4"] }).allow(null, "").optional(),
    labels: joi_1.default.array().items(joi_1.default.string().guid({ version: ["uuidv4"] })).allow(null).optional(),
}).min(1).unknown(false);
const validateUpdateWorkItem = (req, _res, next) => {
    const { error, value } = updateWorkItemSchema.validate(req.body, {
        abortEarly: false,
        convert: true,
    });
    if (error) {
        throw new app_error_1.AppError(error.details.map((detail) => detail.message).join(", "), 400, "VALIDATION_ERROR");
    }
    req.body = value;
    next();
};
exports.validateUpdateWorkItem = validateUpdateWorkItem;
const viewProjectWorkItemsParamsSchema = joi_1.default.object({
    projectId: joi_1.default.string()
        .guid({ version: ["uuidv4"] })
        .required(),
}).unknown(false);
const viewProjectWorkItemsQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    status: joi_1.default.string()
        .valid(...Object.values(work_item_entity_1.WorkItemStatus))
        .optional(),
    type: joi_1.default.string()
        .valid(...Object.values(work_item_entity_1.WorkItemType))
        .optional(),
}).unknown(false);
const validateViewProjectWorkItems = (req, res, next) => {
    const paramsResult = viewProjectWorkItemsParamsSchema.validate(req.params, { abortEarly: false });
    const queryResult = viewProjectWorkItemsQuerySchema.validate(req.query, { abortEarly: false, convert: true });
    const errors = [
        ...(paramsResult.error?.details ?? []),
        ...(queryResult.error?.details ?? []),
    ];
    if (errors.length > 0) {
        throw new app_error_1.AppError(errors.map((detail) => detail.message).join(", "), 400, "VALIDATION_ERROR");
    }
    res.locals.validatedWorkItemQuery = queryResult.value;
    next();
};
exports.validateViewProjectWorkItems = validateViewProjectWorkItems;
