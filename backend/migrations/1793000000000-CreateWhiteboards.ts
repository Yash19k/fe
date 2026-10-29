import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWhiteboards1793000000000 implements MigrationInterface {
  name = "CreateWhiteboards1793000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "whiteboards" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "name" character varying(150) NOT NULL,
        "scene_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "revision" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whiteboards_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_whiteboards_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_whiteboards_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_whiteboards_creator" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_whiteboards_project_id" ON "whiteboards" ("project_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_whiteboards_organization_id" ON "whiteboards" ("organization_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_whiteboards_organization_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_whiteboards_project_id"`);
    await queryRunner.query(`DROP TABLE "whiteboards"`);
  }
}
