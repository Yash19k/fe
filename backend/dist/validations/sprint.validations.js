"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSprintSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const work_item_entity_1 = require("../entities/work.item.entity");
const isRealDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return (!Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value);
};
const dateSchema = joi_1.default.string()
    .custom((value, helpers) => {
    if (!isRealDate(value)) {
        return helpers.error("date.format");
    }
    return value;
})
    .messages({
    "date.format": "Date must be a real date in YYYY-MM-DD format.",
});
const uuidSchema = joi_1.default.string().guid({
    version: ["uuidv4", "uuidv5"],
});
const workItemSchema = joi_1.default.object({
    type: joi_1.default.string()
        .valid(work_item_entity_1.WorkItemType.STORY, work_item_entity_1.WorkItemType.TASK, work_item_entity_1.WorkItemType.SUBTASK, work_item_entity_1.WorkItemType.BUG)
        .required()
        .messages({
        "any.only": "Work-item type must be STORY, TASK, SUBTASK, or BUG. EPIC is not allowed in a sprint.",
        "any.required": "Work-item type is required.",
    }),
    title: joi_1.default.string().trim().min(1).max(255).required(),
    description: joi_1.default.string().allow("", null).optional(),
    priority: joi_1.default.string()
        .valid(...Object.values(work_item_entity_1.WorkItemPriority))
        .default(work_item_entity_1.WorkItemPriority.MEDIUM),
    status: joi_1.default.string()
        .valid(...Object.values(work_item_entity_1.WorkItemStatus))
        .default(work_item_entity_1.WorkItemStatus.BACKLOG),
    dueDate: joi_1.default.alternatives()
        .try(dateSchema, joi_1.default.string().isoDate())
        .allow(null)
        .optional(),
    parentWorkItemId: uuidSchema.allow(null).optional(),
    assigneeIds: joi_1.default.array()
        .items(uuidSchema.required())
        .unique()
        .default([])
        .messages({
        "array.unique": "Duplicate assignee IDs are not allowed.",
    }),
})
    .unknown(false)
    .custom((item, helpers) => {
    if (item.type === work_item_entity_1.WorkItemType.SUBTASK &&
        !item.parentWorkItemId) {
        return helpers.error("workItem.parentRequired");
    }
    return item;
})
    .messages({
    "workItem.parentRequired": "A SUBTASK must have a parentWorkItemId.",
});
exports.createSprintSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(150).required(),
    goal: joi_1.default.string().trim().max(1000).allow("", null).optional(),
    startDate: dateSchema.required(),
    endDate: dateSchema.required(),
    workItems: joi_1.default.array()
        .items(workItemSchema)
        .max(100)
        .default([]),
})
    .unknown(false)
    .custom((payload, helpers) => {
    if (isRealDate(payload.startDate) &&
        isRealDate(payload.endDate) &&
        payload.startDate > payload.endDate) {
        return helpers.error("sprint.dateRange");
    }
    return payload;
})
    .messages({
    "sprint.dateRange": "Sprint endDate must be on or after startDate.",
    "object.unknown": "Unknown field: {{#label}}.",
});
