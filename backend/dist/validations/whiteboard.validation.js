"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRenameWhiteboard = exports.validateUpdateWhiteboard = exports.validateCreateWhiteboard = exports.validateListWhiteboards = exports.validateWhiteboardRevisionParams = exports.validateWhiteboardParams = exports.validateProjectWhiteboardParams = void 0;
const joi_1 = __importDefault(require("joi"));
const app_error_1 = require("../errors/app.error");
const uuid = joi_1.default.string().guid({ version: ["uuidv4"] });
const sceneData = joi_1.default.object({
    elements: joi_1.default.array().items(joi_1.default.object().unknown(true)).required(),
    appState: joi_1.default.object().unknown(true).default({}),
    files: joi_1.default.object().unknown(true).default({}),
}).unknown(true);
function validate(schema, source) {
    return (req, _res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false,
            convert: true,
        });
        if (error) {
            throw new app_error_1.AppError(error.details.map((detail) => detail.message).join(", "), 400, "VALIDATION_ERROR");
        }
        if (source === "query") {
            Object.assign(req.query, value);
        }
        else {
            req[source] = value;
        }
        next();
    };
}
exports.validateProjectWhiteboardParams = validate(joi_1.default.object({ projectId: uuid.required() }).unknown(false), "params");
exports.validateWhiteboardParams = validate(joi_1.default.object({ whiteboardId: uuid.required() }).unknown(false), "params");
exports.validateWhiteboardRevisionParams = validate(joi_1.default.object({
    whiteboardId: uuid.required(),
    revisionNumber: joi_1.default.number().integer().min(1).required(),
}).unknown(false), "params");
exports.validateListWhiteboards = validate(joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(25),
}).unknown(false), "query");
exports.validateCreateWhiteboard = validate(joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(150).required(),
}).unknown(false), "body");
exports.validateUpdateWhiteboard = validate(joi_1.default.object({
    sceneData: sceneData.required(),
    revision: joi_1.default.number().integer().min(1).required(),
}).unknown(false), "body");
exports.validateRenameWhiteboard = validate(joi_1.default.object({ name: joi_1.default.string().trim().min(1).max(150).required() }).unknown(false), "body");
