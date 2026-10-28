import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordResetTokens1793200000000 implements MigrationInterface {
  name = "AddPasswordResetTokens1793200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_password_reset_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_password_reset_tokens_token_hash"
      ON "password_reset_tokens" ("token_hash")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_password_reset_tokens_user_id"
      ON "password_reset_tokens" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_password_reset_tokens_expires_at"
      ON "password_reset_tokens" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_password_reset_tokens_expires_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_password_reset_tokens_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_password_reset_tokens_token_hash"`);
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
  }
}
