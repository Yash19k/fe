"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConversationController = createConversationController;
exports.listConversationsController = listConversationsController;
exports.listMembersController = listMembersController;
exports.getConversationController = getConversationController;
exports.addConversationMemberController = addConversationMemberController;
exports.removeConversationMemberController = removeConversationMemberController;
exports.getMessagesController = getMessagesController;
exports.sendMessageController = sendMessageController;
exports.markReadController = markReadController;
const joi_1 = __importDefault(require("joi"));
const chat_conversation_entity_1 = require("../entities/chat-conversation.entity");
const chat_service_1 = require("../services/chat.service");
const uuid = joi_1.default.string().uuid();
const createSchema = joi_1.default.object({
    organizationId: uuid,
    participantId: uuid,
    projectId: uuid.allow(null),
    type: joi_1.default.string().valid(...Object.values(chat_conversation_entity_1.ChatConversationType)).required(),
    name: joi_1.default.string().trim().max(150).allow("", null),
    memberIds: joi_1.default.array().items(uuid).unique(),
}).or("participantId", "memberIds");
const memberSchema = joi_1.default.object({ userId: uuid.required() });
const conversationQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).max(1000000).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(50),
});
const messageQuerySchema = joi_1.default.object({
    limit: joi_1.default.number().integer().min(1).max(100).default(50),
    before: joi_1.default.date().iso(),
});
function actor(req) {
    if (!req.user)
        throw new Error("Authenticated user context is missing.");
    return req.user;
}
function param(value) {
    return Array.isArray(value) ? value[0] : value;
}
function uuidParam(req, res, name) {
    const value = param(req.params[name]);
    const { error } = uuid.validate(value);
    if (error) {
        validationError(res, error);
        return undefined;
    }
    return value;
}
function validationError(res, error) {
    return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Validation failed.",
        errors: error.details.map((detail) => ({ field: detail.path.join("."), message: detail.message })),
    });
}
async function createConversationController(req, res) {
    const { error, value } = createSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error)
        return validationError(res, error);
    const conversation = await (0, chat_service_1.createConversation)(actor(req), value);
    return res.status(200).json({ success: true, data: conversation });
}
async function listConversationsController(req, res) {
    const { error, value } = conversationQuerySchema.validate(req.query, {
        stripUnknown: true,
        convert: true,
    });
    if (error)
        return validationError(res, error);
    return res.json({
        success: true,
        data: await (0, chat_service_1.listConversations)(actor(req), value.page, value.limit),
    });
}
async function listMembersController(req, res) {
    return res.json({ success: true, data: await (0, chat_service_1.listMembers)(actor(req)) });
}
async function getConversationController(req, res) {
    const conversationId = uuidParam(req, res, "conversationId");
    if (!conversationId)
        return;
    return res.json({ success: true, data: await (0, chat_service_1.getConversationForActor)(actor(req), conversationId) });
}
async function addConversationMemberController(req, res) {
    const { error, value } = memberSchema.validate(req.body, { stripUnknown: true });
    if (error)
        return validationError(res, error);
    const conversationId = uuidParam(req, res, "conversationId");
    if (!conversationId)
        return;
    return res.status(201).json({
        success: true,
        data: await (0, chat_service_1.addMember)(actor(req), conversationId, value.userId),
    });
}
async function removeConversationMemberController(req, res) {
    const conversationId = uuidParam(req, res, "conversationId");
    const userId = uuidParam(req, res, "userId");
    if (!conversationId || !userId)
        return;
    await (0, chat_service_1.removeMember)(actor(req), conversationId, userId);
    return res.status(204).send();
}
async function getMessagesController(req, res) {
    const { error, value } = messageQuerySchema.validate(req.query, { stripUnknown: true, convert: true });
    if (error)
        return validationError(res, error);
    const conversationId = uuidParam(req, res, "conversationId");
    if (!conversationId)
        return;
    return res.json({
        success: true,
        data: await (0, chat_service_1.getMessages)(actor(req), conversationId, value.limit, value.before),
    });
}
async function sendMessageController(req, res) {
    const { error, value } = joi_1.default.object({
        content: joi_1.default.string().trim().min(1).max(4000).required(),
    }).validate(req.body, { stripUnknown: true });
    if (error)
        return validationError(res, error);
    const conversationId = uuidParam(req, res, "conversationId");
    if (!conversationId)
        return;
    return res.status(201).json({ success: true, data: await (0, chat_service_1.saveMessage)(actor(req), conversationId, value.content) });
}
async function markReadController(req, res) {
    const conversationId = uuidParam(req, res, "conversationId");
    if (!conversationId)
        return;
    await (0, chat_service_1.markConversationRead)(actor(req), conversationId);
    return res.status(204).send();
}
