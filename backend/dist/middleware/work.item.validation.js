"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateViewProjectWorkItems = void 0;
const joi_1 = __importDefault(require("joi"));
const work_item_entity_1 = require("../entities/work.item.entity");
const app_error_1 = require("../errors/app.error");
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
