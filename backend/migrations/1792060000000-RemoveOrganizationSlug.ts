import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveOrganizationSlug1792060000000
  implements MigrationInterface
{
  name = "RemoveOrganizationSlug1792060000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasSlug = await queryRunner.hasColumn("organizations", "slug");

    if (!hasSlug) {
      return;
    }

    await queryRunner.dropColumn("organizations", "slug");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasSlug = await queryRunner.hasColumn("organizations", "slug");

    if (hasSlug) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "organizations" ADD "slug" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE ("slug")`,
    );
  }
}