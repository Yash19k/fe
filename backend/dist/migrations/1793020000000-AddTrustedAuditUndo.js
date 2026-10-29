"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTrustedAuditUndo1793020000000 = void 0;
class AddTrustedAuditUndo1793020000000 {
    constructor() {
        this.name = "AddTrustedAuditUndo1793020000000";
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "trusted_for_undo" boolean NOT NULL DEFAULT false;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP COLUMN IF EXISTS "trusted_for_undo";
    `);
    }
}
exports.AddTrustedAuditUndo1793020000000 = AddTrustedAuditUndo1793020000000;
