"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddChatTables1792400000000 = void 0;
class AddChatTables1792400000000 {
    constructor() {
        this.name = "AddChatTables1792400000000";
    }
    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "chat_conversations_type_enum" AS ENUM ('DIRECT', 'GROUP', 'PROJECT')`);
        await queryRunner.query(`
      CREATE TABLE "chat_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "project_id" uuid,
        "type" "chat_conversations_type_enum" NOT NULL,
        "name" character varying(150),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_conversations_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_conversations_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_conversations_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`CREATE INDEX "IDX_chat_conversations_organization_id" ON "chat_conversations" ("organization_id")`);
        await queryRunner.query(`
      CREATE TABLE "chat_conversation_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_conversation_members_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_chat_conversation_member" UNIQUE ("conversation_id", "user_id"),
        CONSTRAINT "FK_chat_conversation_members_conversation" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_conversation_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`CREATE INDEX "IDX_chat_conversation_members_user_id" ON "chat_conversation_members" ("user_id")`);
        await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "sender_id" uuid NOT NULL,
        "content" character varying(4000) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_chat_messages_sender" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
        await queryRunner.query(`CREATE INDEX "IDX_chat_messages_conversation_created" ON "chat_messages" ("conversation_id", "created_at")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE "chat_messages"`);
        await queryRunner.query(`DROP TABLE "chat_conversation_members"`);
        await queryRunner.query(`DROP INDEX "IDX_chat_conversations_organization_id"`);
        await queryRunner.query(`DROP TABLE "chat_conversations"`);
        await queryRunner.query(`DROP TYPE "chat_conversations_type_enum"`);
    }
}
exports.AddChatTables1792400000000 = AddChatTables1792400000000;
