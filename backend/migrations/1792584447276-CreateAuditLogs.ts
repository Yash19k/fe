import { MigrationInterface, QueryRunner } from "typeorm";

// audit_logs is created and owned by AddFeaturePersistenceTables. Keep this
// migration as a no-op for compatibility with databases that have recorded it.
export class CreateAuditLogs1792584447276 implements MigrationInterface {
  name = "CreateAuditLogs1792584447276";

  public async up(_queryRunner: QueryRunner): Promise<void> {}

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
