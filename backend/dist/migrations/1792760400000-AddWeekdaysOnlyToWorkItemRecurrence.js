"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddWeekdaysOnlyToWorkItemRecurrence1792760400000 = void 0;
class AddWeekdaysOnlyToWorkItemRecurrence1792760400000 {
    constructor() {
        this.name = "AddWeekdaysOnlyToWorkItemRecurrence1792760400000";
    }
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "work_item_recurrences"
      DROP COLUMN IF EXISTS "weekdays_only"
    `);
    }
}
exports.AddWeekdaysOnlyToWorkItemRecurrence1792760400000 = AddWeekdaysOnlyToWorkItemRecurrence1792760400000;
