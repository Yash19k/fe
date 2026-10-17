
import Joi from "joi";
import {
  WorkItemType,
  WorkItemStatus,
  WorkItemPriority,
} from "../entities/work.item.entity";

const isRealDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

const dateSchema = Joi.string()
  .custom((value, helpers) => {
    if (!isRealDate(value)) {
      return helpers.error("date.format");
    }

    return value;
  })
  .messages({
    "date.format": "Date must be a real date in YYYY-MM-DD format.",
  });

const uuidSchema = Joi.string().guid({
  version: ["uuidv4", "uuidv5"],
});

const workItemSchema = Joi.object({
  type: Joi.string()
    .valid(
      WorkItemType.STORY,
      WorkItemType.TASK,
      WorkItemType.SUBTASK,
      WorkItemType.BUG,
    )
    .required()
    .messages({
      "any.only":
        "Work-item type must be STORY, TASK, SUBTASK, or BUG. EPIC is not allowed in a sprint.",
      "any.required": "Work-item type is required.",
    }),

  title: Joi.string().trim().min(1).max(255).required(),

  description: Joi.string().allow("", null).optional(),

  priority: Joi.string()
    .valid(...Object.values(WorkItemPriority))
    .default(WorkItemPriority.MEDIUM),

  status: Joi.string()
    .valid(...Object.values(WorkItemStatus))
    .default(WorkItemStatus.BACKLOG),

  dueDate: dateSchema.allow(null).optional(),

  parentWorkItemId: uuidSchema.allow(null).optional(),

  assigneeIds: Joi.array()
    .items(uuidSchema.required())
    .unique()
    .default([])
    .messages({
      "array.unique": "Duplicate assignee IDs are not allowed.",
    }),
})
  .unknown(false)
  .custom((item, helpers) => {
    if (
      item.type === WorkItemType.SUBTASK &&
      !item.parentWorkItemId
    ) {
      return helpers.error("workItem.parentRequired");
    }

    if (
      item.type !== WorkItemType.SUBTASK &&
      item.parentWorkItemId
    ) {
      return helpers.error("workItem.parentNotAllowed");
    }

    return item;
  })
  .messages({
    "workItem.parentRequired":
      "A SUBTASK must have a parentWorkItemId.",
    "workItem.parentNotAllowed":
      "Only a SUBTASK may specify a parentWorkItemId.",
    "object.unknown": "Unknown field: {{#label}}.",
  });

export const createSprintSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),

  goal: Joi.string().trim().max(1000).allow("", null).optional(),

  startDate: dateSchema.required(),

  endDate: dateSchema.required(),

  workItems: Joi.array()
    .items(workItemSchema)
    .max(100)
    .default([]),
})
  .unknown(false)
  .custom((payload, helpers) => {
    if (
      isRealDate(payload.startDate) &&
      isRealDate(payload.endDate) &&
      payload.startDate > payload.endDate
    ) {
      return helpers.error("sprint.dateRange");
    }

    return payload;
  })
  .messages({
    "sprint.dateRange":
      "Sprint endDate must be on or after startDate.",
    "object.unknown": "Unknown field: {{#label}}.",
  });
