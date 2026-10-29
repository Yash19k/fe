"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRecurrenceTimeOfDay1792752000000 = void 0;
class AddRecurrenceTimeOfDay1792752000000 {
    constructor() {
        this.name = "AddRecurrenceTimeOfDay1792752000000";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "work_item_recurrences"
      ADD COLUMN IF NOT EXISTS "time_of_day" character varying(5) NOT NULL DEFAULT '09:00'
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "work_item_recurrences"
      DROP COLUMN IF EXISTS "time_of_day"
    `);
    }
}
exports.AddRecurrenceTimeOfDay1792752000000 = AddRecurrenceTimeOfDay1792752000000;
