import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrganizationCreator1793600000000
  implements MigrationInterface
{
  name = "AddOrganizationCreator1793600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN "created_by_user_id" uuid
    `);
    await queryRunner.query(`
      UPDATE "organizations" AS organization
      SET "created_by_user_id" = (
        SELECT "users"."id"
        FROM "users"
        WHERE "users"."organization_id" = "organization"."id"
        ORDER BY "users"."created_at" ASC, "users"."id" ASC
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1
        FROM "users"
        WHERE "users"."organization_id" = "organization"."id"
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_organizations_created_by_user_id"
      ON "organizations" ("created_by_user_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD CONSTRAINT "FK_organizations_created_by_user_id"
      FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
      DROP CONSTRAINT "FK_organizations_created_by_user_id"
    `);
    await queryRunner.query(
      `DROP INDEX "IDX_organizations_created_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" DROP COLUMN "created_by_user_id"`,
    );
  }
}
