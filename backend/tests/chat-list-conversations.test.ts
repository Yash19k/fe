import assert from "node:assert/strict";
import { test } from "node:test";
import { DataSource, SelectQueryBuilder } from "typeorm";
import { AppDataSource } from "../config/data.source";
import { ChatConversation } from "../entities/chat-conversation.entity";
import { ChatMessage } from "../entities/chat-message.entity";
import { UserRole } from "../entities/user.entity";
import { listConversations } from "../services/chat.service";

class MetadataOnlyDataSource extends DataSource {
  async buildEntityMetadata() {
    await this.buildMetadatas();
  }
}

class PaginationInspectingQueryBuilder extends SelectQueryBuilder<ChatConversation> {
  getPaginationOrder() {
    return this.createOrderByCombinedWithSelectExpression("distinctAlias");
  }
}

test("TypeORM resolves the aliased fallback order for joined entity pagination", async () => {
  const dataSource = new MetadataOnlyDataSource(AppDataSource.options);
  await dataSource.buildEntityMetadata();

  const query = new PaginationInspectingQueryBuilder(dataSource);
  query
    .select("conversation")
    .from(ChatConversation, "conversation")
    .innerJoinAndSelect("conversation.members", "member")
    .leftJoinAndSelect("member.user", "user")
    .addSelect(
      "COALESCE(conversation.lastMessageAt, conversation.createdAt)",
      "conversationSortTimestamp",
    )
    .orderBy("conversationSortTimestamp", "DESC")
    .addOrderBy("conversation.id", "DESC")
    .skip(10)
    .take(10);
  const [selectedColumns, orderBy] = query.getPaginationOrder();

  assert.match(selectedColumns, /conversationSortTimestamp/);
  assert.equal(orderBy['"distinctAlias"."conversationSortTimestamp"'], "DESC");
  assert.equal(orderBy['"distinctAlias"."conversation_id"'], "DESC");
});

test("listConversations orders and paginates safely within the actor's access", async () => {
  const actor = {
    id: "actor-1",
    organizationId: "organization-1",
    role: UserRole.TEAMMATE,
  };
  const conversation = (
    id: string,
    createdAt: string,
    lastMessageAt: string | null,
    options: { organizationId?: string; memberIds?: string[]; projectId?: string | null; projectMemberIds?: string[] } = {},
  ) => ({
    id,
    organizationId: options.organizationId ?? actor.organizationId,
    projectId: options.projectId ?? null,
    lastMessageAt: lastMessageAt ? new Date(lastMessageAt) : null,
    createdAt: new Date(createdAt),
    members: (options.memberIds ?? [actor.id, `${id}-other`]).map((userId) => ({
      userId,
      lastReadAt: null,
      user: userId === actor.id
        ? { id: actor.id, fullName: "Actor", email: "actor@example.test" }
        : { id: userId, fullName: id, email: `${id}@example.test` },
    })),
    projectMemberIds: options.projectMemberIds ?? [],
  });
  const conversations = [
    conversation("message-new", "2025-01-01", "2025-01-05"),
    conversation("fallback-new", "2025-01-04", null),
    conversation("message-middle", "2025-01-02", "2025-01-03"),
    conversation("tie-z", "2025-01-02", "2025-01-02"),
    conversation("tie-a", "2025-01-01", "2025-01-02"),
    conversation("fallback-old", "2025-01-01", null),
    conversation("other-organization", "2025-01-10", "2025-01-10", {
      organizationId: "organization-2",
    }),
    conversation("not-a-member", "2025-01-09", "2025-01-09", {
      memberIds: ["someone-else"],
    }),
    conversation("restricted-project", "2025-01-08", "2025-01-08", {
      projectId: "project-1",
    }),
  ];
  const messageRows = [
    { id: "msg-new", conversationId: "message-new", createdAt: new Date("2025-01-05"), content: "new", senderId: "message-new-other", deletedAt: null },
    { id: "msg-middle", conversationId: "message-middle", createdAt: new Date("2025-01-03"), content: "middle", senderId: "message-middle-other", deletedAt: null },
    { id: "msg-tie-z", conversationId: "tie-z", createdAt: new Date("2025-01-02"), content: "tie", senderId: "tie-z-other", deletedAt: null },
    { id: "msg-tie-a", conversationId: "tie-a", createdAt: new Date("2025-01-02"), content: "tie", senderId: "tie-a-other", deletedAt: null },
  ];
  const queryState = {
    selectedSortExpression: "",
    sortAlias: "",
    secondarySort: "",
    skip: -1,
    take: -1,
    where: [] as string[],
    parameters: {} as Record<string, string>,
  };
  const conversationQuery = {
    innerJoinAndSelect() { return this; },
    leftJoinAndSelect() { return this; },
    where(sql: string, parameters: Record<string, string> = {}) {
      queryState.where.push(sql);
      Object.assign(queryState.parameters, parameters);
      return this;
    },
    andWhere(sql: string, parameters: Record<string, string> = {}) {
      queryState.where.push(sql);
      Object.assign(queryState.parameters, parameters);
      return this;
    },
    addSelect(expression: string, alias: string) {
      queryState.selectedSortExpression = expression;
      queryState.sortAlias = alias;
      return this;
    },
    orderBy(criteria: string) {
      queryState.sortAlias = criteria;
      return this;
    },
    addOrderBy(criteria: string) {
      queryState.secondarySort = criteria;
      return this;
    },
    skip(value: number) {
      queryState.skip = value;
      return this;
    },
    take(value: number) {
      queryState.take = value;
      return this;
    },
    async getMany() {
      const organizationId = queryState.parameters.organizationId;
      const userId = queryState.parameters.userId;
      return conversations
        .filter((item) =>
          item.organizationId === organizationId &&
          item.members.some((member) => member.userId === userId) &&
          (!item.projectId || item.projectMemberIds.includes(userId)),
        )
        .sort((left, right) => {
          const leftTimestamp = left.lastMessageAt ?? left.createdAt;
          const rightTimestamp = right.lastMessageAt ?? right.createdAt;
          return rightTimestamp.getTime() - leftTimestamp.getTime() || right.id.localeCompare(left.id);
        })
        .slice(queryState.skip, queryState.skip + queryState.take);
    },
  };
  const messageRepository = {
    createQueryBuilder() {
      let conversationIds: string[] = [];
      let isLatestMessageQuery = false;
      const builder = {
        distinctOn() {
          isLatestMessageQuery = true;
          return builder;
        },
        select() { return builder; },
        addSelect() { return builder; },
        innerJoin() { return builder; },
        where(_sql: string, parameters: { convIds?: string[] } = {}) {
          conversationIds = parameters.convIds ?? [];
          return builder;
        },
        andWhere() { return builder; },
        orderBy() { return builder; },
        addOrderBy() { return builder; },
        groupBy() { return builder; },
        async getMany() {
          return messageRows
            .filter((message) => conversationIds.includes(message.conversationId))
            .sort((left, right) =>
              right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id),
            )
            .filter((message, index, rows) =>
              rows.findIndex((row) => row.conversationId === message.conversationId) === index,
            );
        },
        async getRawMany() {
          assert.equal(isLatestMessageQuery, false);
          return [];
        },
      };
      return builder;
    },
  };

  Reflect.defineProperty(AppDataSource, "getRepository", {
    configurable: true,
    value: (entity: unknown) => {
      if (entity === ChatConversation) return { createQueryBuilder: () => conversationQuery };
      if (entity === ChatMessage) return messageRepository;
      throw new Error("Unexpected repository in listConversations test.");
    },
  });

  try {
    const firstPage = await listConversations(actor, 1, 3);
    const secondPage = await listConversations(actor, 2, 3);
    const thirdPage = await listConversations(actor, 3, 3);
    const pages = [firstPage, secondPage, thirdPage];
    const ids = pages.flat().map((item) => item.id);

    assert.deepEqual(ids, [
      "message-new",
      "fallback-new",
      "message-middle",
      "tie-z",
      "tie-a",
      "fallback-old",
    ]);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(firstPage[0].lastMessage?.content, "new");
    assert.equal(firstPage[1].lastMessage, null);
    assert.equal(firstPage[1].unreadCount, 0);
    assert.equal(queryState.selectedSortExpression, "COALESCE(conversation.lastMessageAt, conversation.createdAt)");
    assert.equal(queryState.sortAlias, "conversationSortTimestamp");
    assert.equal(queryState.secondarySort, "conversation.id");
    assert.equal(queryState.skip, 6);
    assert.equal(queryState.take, 3);
    assert.equal(queryState.parameters.organizationId, actor.organizationId);
    assert.equal(queryState.parameters.userId, actor.id);
    assert.ok(queryState.where.some((sql) => sql.includes("current_member.user_id = :userId")));
    assert.ok(queryState.where.some((sql) => sql.includes("project_member.user_id = :userId")));
    assert.ok(queryState.where.some((sql) => sql.includes("conversation.project_id IS NULL")));
  } finally {
    Reflect.deleteProperty(AppDataSource, "getRepository");
  }
});
