
import Joi from "joi";

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

export const createSprintSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),

  goal: Joi.string().trim().max(1000).allow("", null).optional(),

  startDate: dateSchema.required(),

  endDate: dateSchema.required(),

  workItemIds: Joi.array()
    .items(uuidSchema.required())
    .max(100)
    .unique()
    .default([])
    .messages({
      "array.unique": "Duplicate work item IDs are not allowed.",
    }),

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
