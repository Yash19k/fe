"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSlaToWorkItems1792600000000 = void 0;
class AddSlaToWorkItems1792600000000 {
    constructor() {
        this.name = "AddSlaToWorkItems1792600000000";
    }
    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."work_items_sla_status_enum" AS ENUM('ON_TRACK', 'AT_RISK', 'BREACHED', 'ESCALATED', 'RESOLVED')`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD "sla_deadline" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD "sla_status" "public"."work_items_sla_status_enum"`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD "sla_deadline_is_custom" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD "escalated_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD "escalated_by_id" uuid`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD "escalation_reason" text`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD "sla_breached_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD "sla_resolved_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_sla_deadline_status" ON "work_items" ("sla_deadline", "sla_status")`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD CONSTRAINT "FK_work_items_escalated_by" FOREIGN KEY ("escalated_by_id") REFERENCES "users"("id") ON DELETE SET NULL`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "work_items" DROP CONSTRAINT "FK_work_items_escalated_by"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_sla_deadline_status"`);
        await queryRunner.query(`ALTER TABLE "work_items" DROP COLUMN "sla_resolved_at"`);
        await queryRunner.query(`ALTER TABLE "work_items" DROP COLUMN "sla_breached_at"`);
        await queryRunner.query(`ALTER TABLE "work_items" DROP COLUMN "escalation_reason"`);
        await queryRunner.query(`ALTER TABLE "work_items" DROP COLUMN "escalated_by_id"`);
        await queryRunner.query(`ALTER TABLE "work_items" DROP COLUMN "escalated_at"`);
        await queryRunner.query(`ALTER TABLE "work_items" DROP COLUMN "sla_deadline_is_custom"`);
        await queryRunner.query(`ALTER TABLE "work_items" DROP COLUMN "sla_status"`);
        await queryRunner.query(`ALTER TABLE "work_items" DROP COLUMN "sla_deadline"`);
        await queryRunner.query(`DROP TYPE "public"."work_items_sla_status_enum"`);
    }
}
exports.AddSlaToWorkItems1792600000000 = AddSlaToWorkItems1792600000000;
