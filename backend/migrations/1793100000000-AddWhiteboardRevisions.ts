import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWhiteboardRevisions1793100000000 implements MigrationInterface {
  name = "AddWhiteboardRevisions1793100000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "whiteboard_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "whiteboard_id" uuid NOT NULL,
        "revision_number" integer NOT NULL,
        "created_by_id" uuid,
        "scene_snapshot" jsonb NOT NULL,
        "change_summary" character varying(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whiteboard_revisions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_whiteboard_revisions_whiteboard_revision"
          UNIQUE ("whiteboard_id", "revision_number"),
        CONSTRAINT "FK_whiteboard_revisions_whiteboard"
          FOREIGN KEY ("whiteboard_id") REFERENCES "whiteboards"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_whiteboard_revisions_creator"
          FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_whiteboard_revisions_whiteboard_revision"
      ON "whiteboard_revisions" ("whiteboard_id", "revision_number")
    `);
    await queryRunner.query(`
      INSERT INTO "whiteboard_revisions"
        ("whiteboard_id", "revision_number", "created_by_id", "scene_snapshot", "change_summary")
      SELECT "id", "revision", "created_by_id", "scene_data", 'Initial whiteboard snapshot'
      FROM "whiteboards"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_whiteboard_revisions_whiteboard_revision"`);
    await queryRunner.query(`DROP TABLE "whiteboard_revisions"`);
  }
}
