"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MakeWorkItemPriorityNullable1792818000000 = void 0;
class MakeWorkItemPriorityNullable1792818000000 {
    constructor() {
        this.name = "MakeWorkItemPriorityNullable1792818000000";
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" DROP NOT NULL`);
    }
    async down(queryRunner) {
        await queryRunner.query(`UPDATE "work_items" SET "priority" = 'MEDIUM' WHERE "priority" IS NULL`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM'`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" SET NOT NULL`);
    }
}
exports.MakeWorkItemPriorityNullable1792818000000 = MakeWorkItemPriorityNullable1792818000000;
