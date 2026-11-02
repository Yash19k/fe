"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddChatMessageIdempotency1793500000000 = void 0;
class AddChatMessageIdempotency1793500000000 {
    constructor() {
        this.name = "AddChatMessageIdempotency1793500000000";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "chat_messages"
      ADD COLUMN "client_message_id" uuid
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_chat_messages_client_message"
      ON "chat_messages" ("conversation_id", "sender_id", "client_message_id")
      WHERE "client_message_id" IS NOT NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "UQ_chat_messages_client_message"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "client_message_id"`);
    }
}
exports.AddChatMessageIdempotency1793500000000 = AddChatMessageIdempotency1793500000000;
