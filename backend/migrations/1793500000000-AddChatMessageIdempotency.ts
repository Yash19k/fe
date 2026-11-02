import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatMessageIdempotency1793500000000 implements MigrationInterface {
  name = "AddChatMessageIdempotency1793500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_chat_messages_client_message"`);
    await queryRunner.query(`ALTER TABLE "chat_messages" DROP COLUMN "client_message_id"`);
  }
}
