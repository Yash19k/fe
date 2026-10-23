import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWeekdaysOnlyToWorkItemRecurrence1792760400000 implements MigrationInterface {
  name = "AddWeekdaysOnlyToWorkItemRecurrence1792760400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_item_recurrences"
      ADD COLUMN IF NOT EXISTS "time_of_day" character varying(5) NOT NULL DEFAULT '09:00'
    `);
    await queryRunner.query(`
      ALTER TABLE "work_item_recurrences"
      ADD COLUMN IF NOT EXISTS "weekdays_only" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "work_item_recurrences"
      ALTER COLUMN "timezone" SET DEFAULT 'Asia/Kolkata'
    `);
    await queryRunner.query(`
      UPDATE "work_item_recurrences"
      SET "time_of_day" = '09:00', "timezone" = 'Asia/Kolkata'
      WHERE "time_of_day" IS DISTINCT FROM '09:00'
         OR "timezone" IS DISTINCT FROM 'Asia/Kolkata'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_item_recurrences"
      DROP COLUMN IF EXISTS "weekdays_only"
    `);
  }
}
