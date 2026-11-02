"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerChatMessageBroadcaster = registerChatMessageBroadcaster;
exports.broadcastChatMessage = broadcastChatMessage;
exports.serializeChatMessage = serializeChatMessage;
exports.canAccessConversation = canAccessConversation;
exports.getConversationForActor = getConversationForActor;
exports.createConversation = createConversation;
exports.listMembers = listMembers;
exports.listConversations = listConversations;
exports.addMember = addMember;
exports.registerRoomEvictor = registerRoomEvictor;
exports.removeMember = removeMember;
exports.getMessages = getMessages;
exports.saveMessage = saveMessage;
exports.markConversationRead = markConversationRead;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../config/data.source");
const chat_conversation_entity_1 = require("../entities/chat-conversation.entity");
const chat_conversation_member_entity_1 = require("../entities/chat-conversation-member.entity");
const chat_message_entity_1 = require("../entities/chat-message.entity");
const project_member_entity_1 = require("../entities/project.member.entity");
const project_entity_1 = require("../entities/project.entity");
const user_entity_1 = require("../entities/user.entity");
const app_error_1 = require("../errors/app.error");
let messageBroadcaster = null;
function registerChatMessageBroadcaster(broadcaster) {
    messageBroadcaster = broadcaster;
}
async function broadcastChatMessage(message) {
    if (!messageBroadcaster)
        return;
    try {
        await messageBroadcaster(message);
    }
    catch (error) {
        console.error(JSON.stringify({
            scope: "chat",
            event: "message_new_broadcast_failed",
            conversationId: message.conversationId,
            messageId: message.id,
            errorName: error instanceof Error ? error.name : "UnknownError",
        }));
    }
}
function serializeChatMessage(message) {
    return {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        ...(message.clientMessageId ? { clientMessageId: message.clientMessageId } : {}),
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        sender: message.sender
            ? {
                id: message.sender.id,
                fullName: message.sender.fullName,
                email: message.sender.email,
            }
            : null,
    };
}
const conversations = () => data_source_1.AppDataSource.getRepository(chat_conversation_entity_1.ChatConversation);
const members = () => data_source_1.AppDataSource.getRepository(chat_conversation_member_entity_1.ChatConversationMember);
const messages = () => data_source_1.AppDataSource.getRepository(chat_message_entity_1.ChatMessage);
function pairKey(first, second) {
    return [first, second].sort().join(":");
}
async function assertProjectAccess(actor, projectId) {
    const project = await data_source_1.AppDataSource.getRepository(project_entity_1.Project).findOne({ where: { id: projectId } });
    if (!project || project.organizationId !== actor.organizationId) {
        throw new app_error_1.AppError("Project not found.", 404, "PROJECT_NOT_FOUND");
    }
    if (actor.role === user_entity_1.UserRole.ADMIN || actor.role === user_entity_1.UserRole.MANAGER)
        return project;
    const membership = await data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember).findOne({ where: { projectId, userId: actor.id } });
    if (!membership)
        throw new app_error_1.AppError("You do not have access to this project.", 403, "FORBIDDEN");
    return project;
}
async function hasProjectAccess(actor, projectId) {
    const project = await data_source_1.AppDataSource.getRepository(project_entity_1.Project).findOne({ where: { id: projectId } });
    if (!project || project.organizationId !== actor.organizationId)
        return false;
    if (actor.role === user_entity_1.UserRole.ADMIN || actor.role === user_entity_1.UserRole.MANAGER)
        return true;
    if (project.visibility === "PUBLIC")
        return true;
    const membership = await data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember).findOne({ where: { projectId, userId: actor.id } });
    return Boolean(membership);
}
async function canAccessConversation(actor, conversationId) {
    const conversation = await conversations().findOne({ where: { id: conversationId } });
    if (!conversation || conversation.organizationId !== actor.organizationId)
        return false;
    if (conversation.projectId && !(await hasProjectAccess(actor, conversation.projectId))) {
        return false;
    }
    return Boolean(await members().findOne({ where: { conversationId, userId: actor.id } }));
}
async function getConversationForActor(actor, conversationId) {
    if (!(await canAccessConversation(actor, conversationId))) {
        throw new app_error_1.AppError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
    }
    return conversations().findOne({ where: { id: conversationId }, relations: { members: { user: true } } });
}
async function createConversation(actor, input) {
    if (!actor.organizationId || (input.organizationId && input.organizationId !== actor.organizationId)) {
        throw new app_error_1.AppError("You can only create conversations in your organization.", 403, "FORBIDDEN");
    }
    if (input.projectId)
        await assertProjectAccess(actor, input.projectId);
    const requested = input.memberIds ?? (input.participantId ? [input.participantId] : []);
    const memberIds = [...new Set([actor.id, ...requested])];
    if (input.type === chat_conversation_entity_1.ChatConversationType.DIRECT &&
        (input.projectId || memberIds.length !== 2 || memberIds[0] === memberIds[1])) {
        throw new app_error_1.AppError("A direct conversation must contain exactly one other user.", 400, "INVALID_DIRECT_CONVERSATION");
    }
    if (input.type === chat_conversation_entity_1.ChatConversationType.GROUP && memberIds.length < 3) {
        throw new app_error_1.AppError("A group conversation must include at least two other participants.", 400, "INVALID_GROUP_CONVERSATION");
    }
    const validUsers = await data_source_1.AppDataSource.getRepository(user_entity_1.User).find({
        where: memberIds.map((id) => ({ id, organizationId: actor.organizationId, status: user_entity_1.UserStatus.ACTIVE })),
        select: { id: true },
    });
    if (validUsers.length !== memberIds.length) {
        throw new app_error_1.AppError("All conversation members must be active users in your organization.", 400, "INVALID_MEMBERS");
    }
    const directPairKey = input.type === chat_conversation_entity_1.ChatConversationType.DIRECT ? pairKey(actor.id, memberIds[1]) : null;
    if (directPairKey) {
        const existing = await conversations().findOne({
            where: { organizationId: actor.organizationId, directPairKey, type: chat_conversation_entity_1.ChatConversationType.DIRECT },
        });
        if (existing)
            return getConversationForActor(actor, existing.id);
    }
    return data_source_1.AppDataSource.transaction(async (manager) => {
        const created = await manager.save(chat_conversation_entity_1.ChatConversation, {
            organizationId: actor.organizationId,
            projectId: input.projectId ?? null,
            directPairKey,
            type: input.type,
            name: input.name ?? null,
        });
        await manager.save(chat_conversation_member_entity_1.ChatConversationMember, memberIds.map((userId) => ({ conversationId: created.id, userId })));
        return created;
    })
        .then((created) => getConversationForActor(actor, created.id))
        .catch(async (error) => {
        const driverError = error instanceof typeorm_1.QueryFailedError
            ? error.driverError
            : undefined;
        if (driverError?.code === "23505" && directPairKey) {
            const existing = await conversations().findOne({
                where: {
                    organizationId: actor.organizationId,
                    directPairKey,
                    type: chat_conversation_entity_1.ChatConversationType.DIRECT,
                },
            });
            if (existing)
                return getConversationForActor(actor, existing.id);
        }
        throw error;
    });
}
async function listMembers(actor) {
    if (!actor.organizationId)
        return [];
    const users = await data_source_1.AppDataSource.getRepository(user_entity_1.User).find({
        where: { organizationId: actor.organizationId, status: user_entity_1.UserStatus.ACTIVE },
        select: { id: true, fullName: true, email: true },
        order: { fullName: "ASC", email: "ASC" },
    });
    return users.filter((user) => user.id !== actor.id);
}
async function listConversations(actor, page = 1, limit = 50) {
    if (!actor.organizationId)
        return [];
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
        .addSelect("COALESCE(conversation.lastMessageAt, conversation.createdAt)", "conversationSortTimestamp")
        .orderBy("conversationSortTimestamp", "DESC")
        .addOrderBy("conversation.id", "DESC")
        .skip((page - 1) * limit)
        .take(limit);
    if (actor.role !== user_entity_1.UserRole.ADMIN && actor.role !== user_entity_1.UserRole.MANAGER) {
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
    if (result.length === 0)
        return [];
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
    const lastMessageMap = new Map();
    for (const msg of latestMessages) {
        lastMessageMap.set(msg.conversationId, msg);
    }
    const unreadCountMap = new Map();
    const unreadCounts = await messages()
        .createQueryBuilder("message")
        .select("message.conversationId", "conversationId")
        .addSelect("COUNT(*)", "unreadCount")
        .innerJoin(chat_conversation_member_entity_1.ChatConversationMember, "member", "member.conversationId = message.conversationId AND member.userId = :userId", { userId: actor.id })
        .where("message.conversation_id IN (:...convIds)", { convIds })
        .andWhere("message.deleted_at IS NULL")
        .andWhere("message.sender_id != :userId", { userId: actor.id })
        .andWhere("(member.last_read_at IS NULL OR message.created_at > member.last_read_at)")
        .groupBy("message.conversation_id")
        .getRawMany();
    for (const count of unreadCounts) {
        unreadCountMap.set(count.conversationId, Number(count.unreadCount));
    }
    return result.map((conversation) => {
        const currentMember = conversation.members.find((member) => member.userId === actor.id);
        const other = conversation.members.find((member) => member.userId !== actor.id)?.user;
        const lastMessageEntity = lastMessageMap.get(conversation.id);
        const lastMessage = lastMessageEntity
            ? serializeChatMessage(lastMessageEntity)
            : null;
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
async function assertConversationManager(actor, conversationId) {
    const conversation = await conversations().findOne({ where: { id: conversationId } });
    if (!conversation || conversation.organizationId !== actor.organizationId)
        throw new app_error_1.AppError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
    if (conversation.projectId && actor.role !== user_entity_1.UserRole.ADMIN && actor.role !== user_entity_1.UserRole.MANAGER) {
        const membership = await data_source_1.AppDataSource.getRepository(project_member_entity_1.ProjectMember).findOne({ where: { projectId: conversation.projectId, userId: actor.id } });
        if (!membership || ![project_member_entity_1.ProjectRole.ADMIN, project_member_entity_1.ProjectRole.LEAD].includes(membership.role))
            throw new app_error_1.AppError("You cannot manage this conversation.", 403, "FORBIDDEN");
    }
    else if (!conversation.projectId && actor.role !== user_entity_1.UserRole.ADMIN && actor.role !== user_entity_1.UserRole.MANAGER) {
        throw new app_error_1.AppError("You cannot manage this conversation.", 403, "FORBIDDEN");
    }
    return conversation;
}
async function addMember(actor, conversationId, userId) {
    const conversation = await assertConversationManager(actor, conversationId);
    if (conversation.type === chat_conversation_entity_1.ChatConversationType.DIRECT)
        throw new app_error_1.AppError("Direct conversations can only contain two users.", 400, "DIRECT_CONVERSATION_MEMBERS_LOCKED");
    const user = await data_source_1.AppDataSource.getRepository(user_entity_1.User).findOne({ where: { id: userId, organizationId: conversation.organizationId, status: user_entity_1.UserStatus.ACTIVE } });
    if (!user)
        throw new app_error_1.AppError("User not found in this organization.", 404, "USER_NOT_FOUND");
    await members().insert({ conversationId, userId });
    return members().findOne({ where: { conversationId, userId }, relations: { user: true } });
}
let roomEvictor = null;
function registerRoomEvictor(evictor) {
    roomEvictor = evictor;
}
async function removeMember(actor, conversationId, userId) {
    const conversation = await assertConversationManager(actor, conversationId);
    if (conversation.type === chat_conversation_entity_1.ChatConversationType.DIRECT)
        throw new app_error_1.AppError("Direct conversations must keep both participants.", 400, "DIRECT_CONVERSATION_MEMBERS_LOCKED");
    await members().delete({ conversationId, userId });
    if (roomEvictor) {
        roomEvictor(conversationId, userId);
    }
}
async function getMessages(actor, conversationId, limit, before, beforeId) {
    if (!(await canAccessConversation(actor, conversationId)))
        throw new app_error_1.AppError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
    const query = messages().createQueryBuilder("message")
        .leftJoin("message.sender", "sender")
        .addSelect(["sender.id", "sender.fullName", "sender.email"])
        .where("message.conversation_id = :conversationId", { conversationId })
        .andWhere("message.deleted_at IS NULL");
    if (before) {
        if (beforeId) {
            query.andWhere("(date_trunc('milliseconds', message.created_at) < :before OR " +
                "(date_trunc('milliseconds', message.created_at) = :before AND message.id < :beforeId))", { before, beforeId });
        }
        else {
            query.andWhere("date_trunc('milliseconds', message.created_at) < :before", { before });
        }
    }
    const page = await query
        .addSelect("date_trunc('milliseconds', message.createdAt)", "messageCreatedAtMillis")
        .orderBy("messageCreatedAtMillis", "DESC")
        .addOrderBy("message.id", "DESC")
        .take(Math.min(limit, 100))
        .getMany();
    return page.reverse().map(serializeChatMessage);
}
async function saveMessage(actor, conversationId, content, clientMessageId) {
    const normalized = content.trim();
    if (!normalized || normalized.length > 4000)
        throw new app_error_1.AppError("Message content must be between 1 and 4000 characters.", 400, "INVALID_MESSAGE");
    if (!(await canAccessConversation(actor, conversationId)))
        throw new app_error_1.AppError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
    const findByClientId = () => clientMessageId
        ? messages().findOne({
            where: { conversationId, senderId: actor.id, clientMessageId },
            relations: { sender: true },
        })
        : Promise.resolve(null);
    const existing = await findByClientId();
    if (existing)
        return serializeChatMessage(existing);
    try {
        const message = await data_source_1.AppDataSource.transaction(async (manager) => {
            const created = await manager.save(chat_message_entity_1.ChatMessage, {
                conversationId,
                senderId: actor.id,
                content: normalized,
                clientMessageId: clientMessageId ?? null,
            });
            await manager.update(chat_conversation_entity_1.ChatConversation, { id: conversationId }, { lastMessageAt: created.createdAt });
            return created;
        });
        const savedMessage = await messages().findOne({
            where: { id: message.id },
            relations: { sender: true },
        });
        if (!savedMessage)
            throw new app_error_1.AppError("Message could not be loaded after saving.", 500, "CHAT_MESSAGE_LOAD_FAILED");
        return serializeChatMessage(savedMessage);
    }
    catch (error) {
        const driverError = error instanceof typeorm_1.QueryFailedError
            ? error.driverError
            : undefined;
        if (driverError?.code === "23505" && clientMessageId) {
            const concurrentlySaved = await findByClientId();
            if (concurrentlySaved)
                return serializeChatMessage(concurrentlySaved);
        }
        throw error;
    }
}
async function markConversationRead(actor, conversationId) {
    if (!(await canAccessConversation(actor, conversationId)))
        throw new app_error_1.AppError("Conversation not found.", 404, "CONVERSATION_NOT_FOUND");
    await members().update({ conversationId, userId: actor.id }, { lastReadAt: new Date() });
}
