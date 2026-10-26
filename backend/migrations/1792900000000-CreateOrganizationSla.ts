import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrganizationSla1792900000000 implements MigrationInterface {
  name = "CreateOrganizationSla1792900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_sla" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "urgent_hours" integer NOT NULL DEFAULT 4,
        "high_hours" integer NOT NULL DEFAULT 8,
        "medium_hours" integer NOT NULL DEFAULT 24,
        "low_hours" integer NOT NULL DEFAULT 72,
        "escalate_hours" integer NOT NULL DEFAULT 8,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_sla_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organization_sla_organization_id" UNIQUE ("organization_id"),
        CONSTRAINT "FK_organization_sla_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_organization_sla_org" ON "organization_sla" ("organization_id");
    `);

    // Populate default SLA settings for any existing organizations
    await queryRunner.query(`
      INSERT INTO "organization_sla" ("organization_id", "urgent_hours", "high_hours", "medium_hours", "low_hours", "escalate_hours")
      SELECT "id", 4, 8, 24, 72, 8 FROM "organizations"
      ON CONFLICT ("organization_id") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_organization_sla_org";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_sla";`);
  }
}
