import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMemberInvitations1793300000000
  implements MigrationInterface
{
  name = "CreateMemberInvitations1793300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "member_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "email" character varying(255) NOT NULL,
        "role" "public"."users_role_enum" NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "consumed_at" TIMESTAMP WITH TIME ZONE,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_member_invitations_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_member_invitations_consumed_or_revoked"
          CHECK ("consumed_at" IS NULL OR "revoked_at" IS NULL),
        CONSTRAINT "FK_member_invitations_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_member_invitations_organization_id"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_member_invitations_token_hash" ON "member_invitations" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_member_invitations_user_id" ON "member_invitations" ("user_id")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_member_invitations_one_outstanding_per_user"
      ON "member_invitations" ("user_id")
      WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_member_invitations_one_outstanding_per_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_member_invitations_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_member_invitations_token_hash"`,
    );
    await queryRunner.query(`DROP TABLE "member_invitations"`);
  }
}
