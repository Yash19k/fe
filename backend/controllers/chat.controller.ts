import { Request, Response } from "express";
import Joi from "joi";
import { ChatConversationType } from "../entities/chat-conversation.entity";
import {
  addMember,
  createConversation,
  getConversationForActor,
  getMessages,
  listMembers,
  listConversations,
  markConversationRead,
  removeMember,
  saveMessage,
} from "../services/chat.service";

const uuid = Joi.string().uuid();
const createSchema = Joi.object({
  organizationId: uuid,
  participantId: uuid,
  projectId: uuid.allow(null),
  type: Joi.string().valid(...Object.values(ChatConversationType)).required(),
  name: Joi.string().trim().max(150).allow("", null),
  memberIds: Joi.array().items(uuid).unique(),
}).or("participantId", "memberIds");
const memberSchema = Joi.object({ userId: uuid.required() });
const conversationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(1_000_000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});
const messageQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  before: Joi.date().iso(),
});

function actor(req: Request) {
  if (!req.user) throw new Error("Authenticated user context is missing.");
  return req.user;
}

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function uuidParam(req: Request, res: Response, name: string): string | undefined {
  const value = param(req.params[name]);
  const { error } = uuid.validate(value);
  if (error) {
    validationError(res, error);
    return undefined;
  }
  return value;
}

function validationError(res: Response, error: Joi.ValidationError) {
  return res.status(400).json({
    success: false,
    code: "VALIDATION_ERROR",
    message: "Validation failed.",
    errors: error.details.map((detail) => ({ field: detail.path.join("."), message: detail.message })),
  });
}

export async function createConversationController(req: Request, res: Response) {
  const { error, value } = createSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) return validationError(res, error);
  const conversation = await createConversation(actor(req), value);
  return res.status(200).json({ success: true, data: conversation });
}

export async function listConversationsController(req: Request, res: Response) {
  const { error, value } = conversationQuerySchema.validate(req.query, {
    stripUnknown: true,
    convert: true,
  });
  if (error) return validationError(res, error);
  return res.json({
    success: true,
    data: await listConversations(actor(req), value.page, value.limit),
  });
}

export async function listMembersController(req: Request, res: Response) {
  return res.json({ success: true, data: await listMembers(actor(req)) });
}

export async function getConversationController(req: Request, res: Response) {
  const conversationId = uuidParam(req, res, "conversationId");
  if (!conversationId) return;
  return res.json({ success: true, data: await getConversationForActor(actor(req), conversationId) });
}

export async function addConversationMemberController(req: Request, res: Response) {
  const { error, value } = memberSchema.validate(req.body, { stripUnknown: true });
  if (error) return validationError(res, error);
  const conversationId = uuidParam(req, res, "conversationId");
  if (!conversationId) return;
  return res.status(201).json({
    success: true,
    data: await addMember(actor(req), conversationId, value.userId),
  });
}

export async function removeConversationMemberController(req: Request, res: Response) {
  const conversationId = uuidParam(req, res, "conversationId");
  const userId = uuidParam(req, res, "userId");
  if (!conversationId || !userId) return;
  await removeMember(actor(req), conversationId, userId);
  return res.status(204).send();
}

export async function getMessagesController(req: Request, res: Response) {
  const { error, value } = messageQuerySchema.validate(req.query, { stripUnknown: true, convert: true });
  if (error) return validationError(res, error);
  const conversationId = uuidParam(req, res, "conversationId");
  if (!conversationId) return;
  return res.json({
    success: true,
    data: await getMessages(actor(req), conversationId, value.limit, value.before),
  });
}

export async function sendMessageController(req: Request, res: Response) {
  const { error, value } = Joi.object({
    content: Joi.string().trim().min(1).max(4000).required(),
  }).validate(req.body, { stripUnknown: true });
  if (error) return validationError(res, error);
  const conversationId = uuidParam(req, res, "conversationId");
  if (!conversationId) return;
  return res.status(201).json({ success: true, data: await saveMessage(actor(req), conversationId, value.content) });
}

export async function markReadController(req: Request, res: Response) {
  const conversationId = uuidParam(req, res, "conversationId");
  if (!conversationId) return;
  await markConversationRead(actor(req), conversationId);
  return res.status(204).send();
}
