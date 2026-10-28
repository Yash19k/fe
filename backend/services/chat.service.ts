import { IsNull, QueryFailedError } from "typeorm";
import { AppDataSource } from "../config/data.source";
import { ChatConversation, ChatConversationType } from "../entities/chat-conversation.entity";
import { ChatConversationMember } from "../entities/chat-conversation-member.entity";
import { ChatMessage } from "../entities/chat-message.entity";
import { ProjectMember, ProjectRole } from "../entities/project.member.entity";
import { Project } from "../entities/project.entity";
import { User, UserRole, UserStatus } from "../entities/user.entity";
import { AppError } from "../errors/app.error";

export interface ChatActor { id: string; organizationId?: string; role: string; }
export interface CreateConversationInput {
  organizationId?: string;
  participantId?: string;
  projectId?: string | null;
  type: ChatConversationType;
  name?: string | null;
  memberIds?: string[];
}

const conversations = () => AppDataSource.getRepository(ChatConversation);
const members = () => AppDataSource.getRepository(ChatConversationMember);
const messages = () => AppDataSource.getRepository(ChatMessage);

function pairKey(first: string, second: string) {
  return [first, second].sort().join(":");
}

async function assertProjectAccess(actor: ChatActor, projectId: string): Promise<Project> {
  const project = await AppDataSource.getRepository(Project).findOne({ where: { id: projectId } });
  if (!project || project.organizationId !== actor.organizationId) {
    throw new AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
  }
  if (actor.role === UserRole.ADMIN || actor.role === UserRole.MANAGER) return project;
  const membership = await AppDataSource.getRepository(ProjectMember).findOne({ where: { projectId, userId: actor.id } });
  if (!membership) throw new AppError("You do not have access to this project.", 403, "FORBIDDEN");
  return project;
}

export async function canAccessConversation(actor: ChatActor, conversationId: string) {
  const conversation = await conversations().findOne({ where: { id: conversationId } });
  if (!conversation || conversation.organizationId !== actor.organizationId) return false;
  if (conversation.projectId) {
    try { await assertProjectAccess(actor, conversation.projectId); } catch (error) {
      if (error instanceof AppError) return false;
      throw error;
    }
  }
  return Boolean(await members().findOne({ where: { conversationId, userId: actor.id } }));
}

export async function getConversationForActor(actor: ChatActor, conversationId: string) {
  if (!(await canAccessConversation(actor, conversationId))) {
    throw new AppError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
  }
  return conversations().findOne({ where: { id: conversationId }, relations: { members: { user: true } } });
}

export async function createConversation(actor: ChatActor, input: CreateConversationInput) {
  if (!actor.organizationId || (input.organizationId && input.organizationId !== actor.organizationId)) {
    throw new AppError("You can only create conversations in your organization.", 403, "FORBIDDEN");
  }
  if (input.projectId) await assertProjectAccess(actor, input.projectId);
  const requested = input.memberIds ?? (input.participantId ? [input.participantId] : []);
  const memberIds = [...new Set([actor.id, ...requested])];
  if (input.type === ChatConversationType.DIRECT &&
      (input.projectId || memberIds.length !== 2 || memberIds[0] === memberIds[1])) {
    throw new AppError("A direct conversation must contain exactly one other user.", 400, "INVALID_DIRECT_CONVERSATION");
  }
  const validUsers = await AppDataSource.getRepository(User).find({
    where: memberIds.map((id) => ({ id, organizationId: actor.organizationId, status: UserStatus.ACTIVE })),
    select: { id: true },
  });
  if (validUsers.length !== memberIds.length) {
    throw new AppError("All conversation members must be active users in your organization.", 400, "INVALID_MEMBERS");
  }
  const directPairKey = input.type === ChatConversationType.DIRECT ? pairKey(actor.id, memberIds[1]) : null;
  if (directPairKey) {
    const existing = await conversations().findOne({
      where: { organizationId: actor.organizationId, directPairKey, type: ChatConversationType.DIRECT },
    });
    if (existing) return getConversationForActor(actor, existing.id);
  }
  try {
    const conversation = await AppDataSource.transaction(async (manager) => {
      const created = await manager.save(ChatConversation, {
        organizationId: actor.organizationId,
        projectId: input.projectId ?? null,
        directPairKey,
        type: input.type,
        name: input.name ?? null,
      });
      await manager.save(ChatConversationMember, memberIds.map((userId) => ({ conversationId: created.id, userId })));
      return created;
    });
    return getConversationForActor(actor, conversation.id);
  } catch (error) {
    const driverError = error instanceof QueryFailedError ? (error as QueryFailedError & { driverError?: { code?: string } }).driverError : undefined;
    if (driverError?.code === "23505" && directPairKey) {
      const existing = await conversations().findOne({ where: { organizationId: actor.organizationId, directPairKey, type: ChatConversationType.DIRECT } });
      if (existing) return getConversationForActor(actor, existing.id);
    }
    throw error;
  }
}

export async function listMembers(actor: ChatActor) {
  if (!actor.organizationId) return [];
  const users = await AppDataSource.getRepository(User).find({
    where: { organizationId: actor.organizationId, status: UserStatus.ACTIVE },
    select: { id: true, fullName: true, email: true },
    order: { fullName: "ASC", email: "ASC" },
  });
  return users.filter((user) => user.id !== actor.id);
}

export async function listConversations(
  actor: ChatActor,
  page = 1,
  limit = 50,
) {
  if (!actor.organizationId) return [];
  const query = conversations().createQueryBuilder("conversation")
    .innerJoinAndSelect("conversation.members", "member")
    .leftJoinAndSelect("member.user", "user")
    .where("conversation.organization_id = :organizationId", { organizationId: actor.organizationId })
    .andWhere(`
      EXISTS (
        SELECT 1
        FROM chat_conversation_members current_member
        WHERE current_member.conversation_id = conversation.id
          AND current_member.user_id = :userId
      )
    `, { userId: actor.id })
    .orderBy("COALESCE(conversation.last_message_at, conversation.created_at)", "DESC")
    .addOrderBy("conversation.id", "DESC")
    .skip((page - 1) * limit)
    .take(limit);

  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.MANAGER) {
    query.andWhere(`(
      conversation.project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM project_members project_member
        WHERE project_member.project_id = conversation.project_id
          AND project_member.user_id = :userId
      )
    )`);
  }

  const result = await query.getMany();

  if (result.length === 0) return [];

  const convIds = result.map((c) => c.id);

  const latestMessages = await messages()
    .createQueryBuilder("message")
    .distinctOn(["message.conversationId"])
    .where("message.conversation_id IN (:...convIds)", { convIds })
    .andWhere("message.deleted_at IS NULL")
    .orderBy("message.conversation_id", "ASC")
    .addOrderBy("message.created_at", "DESC")
    .addOrderBy("message.id", "DESC")
    .getMany();

  const lastMessageMap = new Map<string, { id: string; content: string; createdAt: Date; senderId: string }>();
  for (const msg of latestMessages) {
    lastMessageMap.set(msg.conversationId, {
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt,
      senderId: msg.senderId,
    });
  }

  const unreadCountMap = new Map<string, number>();
  const unreadCounts = await messages()
    .createQueryBuilder("message")
    .select("message.conversationId", "conversationId")
    .addSelect("COUNT(*)", "unreadCount")
    .innerJoin(
      ChatConversationMember,
      "member",
      "member.conversationId = message.conversationId AND member.userId = :userId",
      { userId: actor.id },
    )
    .where("message.conversation_id IN (:...convIds)", { convIds })
    .andWhere("message.deleted_at IS NULL")
    .andWhere("message.sender_id != :userId", { userId: actor.id })
    .andWhere(
      "(member.last_read_at IS NULL OR message.created_at > member.last_read_at)",
    )
    .groupBy("message.conversation_id")
    .getRawMany<{ conversationId: string; unreadCount: string }>();

  for (const count of unreadCounts) {
    unreadCountMap.set(count.conversationId, Number(count.unreadCount));
  if (result.length === 0) return [];

  const convIds = result.map((c) => c.id);

  // Batched query: get recent messages for all conversations
  const recentMessages = await messages()
    .createQueryBuilder("message")
    .where("message.conversation_id IN (:...convIds)", { convIds })
    .andWhere("message.deleted_at IS NULL")
    .orderBy("message.created_at", "DESC")
    .addOrderBy("message.id", "DESC")
    .getMany();

  const lastMessageMap = new Map<string, { id: string; content: string; createdAt: Date; senderId: string }>();
  for (const msg of recentMessages) {
    if (!lastMessageMap.has(msg.conversationId)) {
      lastMessageMap.set(msg.conversationId, {
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
        senderId: msg.senderId,
      });
    }
  }

  // Batched query: compute unread counts per conversation
  const unreadCountMap = new Map<string, number>();
  for (const conversation of result) {
    const currentMember = conversation.members.find((member) => member.userId === actor.id);
    const unread = recentMessages.filter(
      (msg) =>
        msg.conversationId === conversation.id &&
        msg.senderId !== actor.id &&
        (!currentMember?.lastReadAt || msg.createdAt > currentMember.lastReadAt),
    ).length;
    unreadCountMap.set(conversation.id, unread);
  }

  return result.map((conversation) => {
    const currentMember = conversation.members.find((member) => member.userId === actor.id);
    const other = conversation.members.find((member) => member.userId !== actor.id)?.user;
    const lastMessage = lastMessageMap.get(conversation.id) || null;
    const unreadCount = unreadCountMap.get(conversation.id) || 0;

    return {
      ...conversation,
      otherParticipant: other ? { id: other.id, fullName: other.fullName, email: other.email } : null,
      lastMessage,
      unreadCount,
      lastReadAt: currentMember?.lastReadAt ?? null,
    };
  });
}

async function assertConversationManager(actor: ChatActor, conversationId: string) {
  const conversation = await conversations().findOne({ where: { id: conversationId } });
  if (!conversation || conversation.organizationId !== actor.organizationId) throw new AppError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
  if (conversation.projectId && actor.role !== UserRole.ADMIN && actor.role !== UserRole.MANAGER) {
    const membership = await AppDataSource.getRepository(ProjectMember).findOne({ where: { projectId: conversation.projectId, userId: actor.id } });
    if (!membership || ![ProjectRole.ADMIN, ProjectRole.LEAD].includes(membership.role)) throw new AppError("You cannot manage this conversation.", 403, "FORBIDDEN");
  } else if (!conversation.projectId && actor.role !== UserRole.ADMIN && actor.role !== UserRole.MANAGER) {
    throw new AppError("You cannot manage this conversation.", 403, "FORBIDDEN");
  }
  return conversation;
}

export async function addMember(actor: ChatActor, conversationId: string, userId: string) {
  const conversation = await assertConversationManager(actor, conversationId);
  if (conversation.type === ChatConversationType.DIRECT) throw new AppError("Direct conversations can only contain two users.", 400, "DIRECT_CONVERSATION_MEMBERS_LOCKED");
  const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId, organizationId: conversation.organizationId, status: UserStatus.ACTIVE } });
  if (!user) throw new AppError("User not found in this organization.", 404, "USER_NOT_FOUND");
  await members().insert({ conversationId, userId });
  return members().findOne({ where: { conversationId, userId }, relations: { user: true } });
}

export async function removeMember(actor: ChatActor, conversationId: string, userId: string) {
  const conversation = await assertConversationManager(actor, conversationId);
  if (conversation.type === ChatConversationType.DIRECT) throw new AppError("Direct conversations must keep both participants.", 400, "DIRECT_CONVERSATION_MEMBERS_LOCKED");
  await members().delete({ conversationId, userId });

  // Evict removed user from any live WebSocket room subscriptions
  try {
    const { evictUserFromConversationRoom } = require("../websocket/chat.gateway");
    if (typeof evictUserFromConversationRoom === "function") {
      evictUserFromConversationRoom(conversationId, userId);
    }
  } catch {
    // Ignore if websocket gateway not loaded
  }
}

export async function getMessages(actor: ChatActor, conversationId: string, limit: number, before?: Date) {
  if (!(await canAccessConversation(actor, conversationId))) throw new AppError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
  const query = messages().createQueryBuilder("message")
    .leftJoinAndSelect("message.sender", "sender")
    .addSelect(["sender.id", "sender.fullName", "sender.email"])
    .where("message.conversation_id = :conversationId", { conversationId })
    .andWhere("message.deleted_at IS NULL");
  if (before) query.andWhere("message.created_at < :before", { before });
  const page = await query.orderBy("message.created_at", "DESC").addOrderBy("message.id", "DESC").take(Math.min(limit, 100)).getMany();
  return page.reverse();
}

export async function saveMessage(actor: ChatActor, conversationId: string, content: string) {
  const normalized = content.trim();
  if (!normalized || normalized.length > 4000) throw new AppError("Message content must be between 1 and 4000 characters.", 400, "INVALID_MESSAGE");
  if (!(await canAccessConversation(actor, conversationId))) throw new AppError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
  return AppDataSource.transaction(async (manager) => {
    const message = await manager.save(ChatMessage, { conversationId, senderId: actor.id, content: normalized });
    await manager.update(ChatConversation, { id: conversationId }, { lastMessageAt: message.createdAt });
    return message;
  });
}

export async function markConversationRead(actor: ChatActor, conversationId: string) {
  if (!(await canAccessConversation(actor, conversationId))) throw new AppError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
  await members().update({ conversationId, userId: actor.id }, { lastReadAt: new Date() });
}
