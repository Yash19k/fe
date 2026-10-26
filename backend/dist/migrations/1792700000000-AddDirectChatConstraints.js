"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddDirectChatConstraints1792700000000 = void 0;
class AddDirectChatConstraints1792700000000 {
    constructor() {
        this.name = "AddDirectChatConstraints1792700000000";
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "chat_conversations" ADD "direct_pair_key" character varying(73)`);
        await queryRunner.query(`ALTER TABLE "chat_conversations" ADD "last_message_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "chat_conversation_members" ADD "last_read_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "edited_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_chat_conversations_direct_pair"
      ON "chat_conversations" ("organization_id", "direct_pair_key")
      WHERE "type" = 'DIRECT' AND "direct_pair_key" IS NOT NULL
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_chat_messages_conversation_created_id"
      ON "chat_messages" ("conversation_id", "created_at", "id")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "IDX_chat_messages_conversation_created_id"`);
        await queryRunner.query(`DROP INDEX "UQ_chat_conversations_direct_pair"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "edited_at"`);
        await queryRunner.query(`ALTER TABLE "chat_conversation_members" DROP COLUMN "last_read_at"`);
        await queryRunner.query(`ALTER TABLE "chat_conversations" DROP COLUMN "last_message_at"`);
        await queryRunner.query(`ALTER TABLE "chat_conversations" DROP COLUMN "direct_pair_key"`);
    }
}
exports.AddDirectChatConstraints1792700000000 = AddDirectChatConstraints1792700000000;
