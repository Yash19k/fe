import { MigrationInterface, QueryRunner } from "typeorm";

export class RetainRecentWhiteboardRevisions1793110000000 implements MigrationInterface {
  name = "RetainRecentWhiteboardRevisions1793110000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "whiteboard_revisions" revision
      WHERE revision."revision_number" <= (
        SELECT MAX(older."revision_number") - 99
        FROM "whiteboard_revisions" older
        WHERE older."whiteboard_id" = revision."whiteboard_id"
      )
    `);
  }

  async down(): Promise<void> {
    // Revision snapshots removed by the retention policy cannot be restored.
  }
}
