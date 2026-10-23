import { MigrationInterface, QueryRunner } from "typeorm";

export class FixInvitationUserFields1792059000000
  implements MigrationInterface
{
  name = "FixInvitationUserFields1792059000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCamelTokenHash = await queryRunner.hasColumn(
      "users",
      "inviteTokenHash",
    );
    const hasSnakeTokenHash = await queryRunner.hasColumn(
      "users",
      "invite_token_hash",
    );
    const hasCamelExpiresAt = await queryRunner.hasColumn(
      "users",
      "inviteExpiresAt",
    );
    const hasSnakeExpiresAt = await queryRunner.hasColumn(
      "users",
      "invite_expires_at",
    );

    if (hasCamelTokenHash && !hasSnakeTokenHash) {
      await queryRunner.renameColumn(
        "users",
        "inviteTokenHash",
        "invite_token_hash",
      );
    }

    if (hasCamelExpiresAt && !hasSnakeExpiresAt) {
      await queryRunner.renameColumn(
        "users",
        "inviteExpiresAt",
        "invite_expires_at",
      );
    }

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "full_name" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "users" SET "full_name" = "email" WHERE "full_name" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL`,
    );

    const hasSnakeTokenHash = await queryRunner.hasColumn(
      "users",
      "invite_token_hash",
    );
    const hasCamelTokenHash = await queryRunner.hasColumn(
      "users",
      "inviteTokenHash",
    );
    const hasSnakeExpiresAt = await queryRunner.hasColumn(
      "users",
      "invite_expires_at",
    );
    const hasCamelExpiresAt = await queryRunner.hasColumn(
      "users",
      "inviteExpiresAt",
    );

    if (hasSnakeTokenHash && !hasCamelTokenHash) {
      await queryRunner.renameColumn(
        "users",
        "invite_token_hash",
        "inviteTokenHash",
      );
    }

    if (hasSnakeExpiresAt && !hasCamelExpiresAt) {
      await queryRunner.renameColumn(
        "users",
        "invite_expires_at",
        "inviteExpiresAt",
      );
    }
  }
}
