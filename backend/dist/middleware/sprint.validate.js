"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCreateSprint = void 0;
const sprint_validations_1 = require("./../validations/sprint.validations");
const validateCreateSprint = (req, res, next) => {
    const { error, value } = sprint_validations_1.createSprintSchema.validate(req.body, {
        abortEarly: false,
        convert: true,
        stripUnknown: false,
    });
    if (error) {
        res.status(400).json({
            success: false,
            message: "Validation failed.",
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
exports.validateCreateSprint = validateCreateSprint;
