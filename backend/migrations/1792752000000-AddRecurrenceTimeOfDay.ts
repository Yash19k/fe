import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecurrenceTimeOfDay1792752000000 implements MigrationInterface {
  name = "AddRecurrenceTimeOfDay1792752000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_item_recurrences"
      ADD COLUMN IF NOT EXISTS "time_of_day" character varying(5) NOT NULL DEFAULT '09:00'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_item_recurrences"
      DROP COLUMN IF EXISTS "time_of_day"
    `);
  }
}
