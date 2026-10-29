import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCloudinaryMetadataToWorkItemAttachments1793010000000
  implements MigrationInterface
{
  name = "AddCloudinaryMetadataToWorkItemAttachments1793010000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_item_attachments"
      ADD COLUMN "public_id" character varying(255),
      ADD COLUMN "resource_type" character varying(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_item_attachments"
      DROP COLUMN "resource_type",
      DROP COLUMN "public_id"
    `);
  }
}
