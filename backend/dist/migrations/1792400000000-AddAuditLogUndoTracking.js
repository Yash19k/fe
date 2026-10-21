"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAuditLogUndoTracking1792400000000 = void 0;
class AddAuditLogUndoTracking1792400000000 {
    constructor() {
        this.name = "AddAuditLogUndoTracking1792400000000";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "is_undone" boolean NOT NULL DEFAULT false;
    `);
        await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "undone_at" TIMESTAMP WITH TIME ZONE;
    `);
        await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "undone_by_id" uuid;
    `);
        await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "reversal_log_id" uuid;
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_is_undone" ON "audit_logs" ("is_undone");
    `);
        // Backfill any existing audit logs that were marked as undone by historical "undone" logs
        await queryRunner.query(`
      UPDATE "audit_logs" target
      SET "is_undone" = true,
          "undone_at" = rev."created_at"
      FROM "audit_logs" rev
      WHERE LOWER(rev."action") = 'undone'
        AND target."entity_id" = rev."entity_id"
        AND target."created_at" < rev."created_at"
        AND target."is_undone" = false;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_is_undone";`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "reversal_log_id";`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "undone_by_id";`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "undone_at";`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "is_undone";`);
    }
}
exports.AddAuditLogUndoTracking1792400000000 = AddAuditLogUndoTracking1792400000000;
