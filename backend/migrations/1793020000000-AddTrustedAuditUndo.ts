import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTrustedAuditUndo1793020000000 implements MigrationInterface {
  name = "AddTrustedAuditUndo1793020000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD COLUMN IF NOT EXISTS "trusted_for_undo" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      DROP COLUMN IF EXISTS "trusted_for_undo";
    `);
  }
}
