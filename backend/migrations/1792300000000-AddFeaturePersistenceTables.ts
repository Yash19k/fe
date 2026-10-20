import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFeaturePersistenceTables1792300000000
  implements MigrationInterface
{
  name = "AddFeaturePersistenceTables1792300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "work_item_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "work_item_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "body" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_item_comments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_work_item_comments_work_item" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_work_item_comments_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_work_item_comments_work_item" ON "work_item_comments" ("work_item_id");`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "work_item_time_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "work_item_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "duration_minutes" integer NOT NULL,
        "description" text,
        "start_time" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_item_time_entries_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_work_item_time_entries_work_item" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_work_item_time_entries_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_work_item_time_entries_work_item" ON "work_item_time_entries" ("work_item_id");`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_labels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "color" character varying(30) NOT NULL DEFAULT '#3B82F6',
        "description" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_labels_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_labels_project_name" UNIQUE ("project_id", "name"),
        CONSTRAINT "FK_project_labels_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_labels_project" ON "project_labels" ("project_id");`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "work_item_labels" (
        "work_item_id" uuid NOT NULL,
        "label_id" uuid NOT NULL,
        CONSTRAINT "PK_work_item_labels" PRIMARY KEY ("work_item_id", "label_id"),
        CONSTRAINT "FK_work_item_labels_work_item" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_work_item_labels_label" FOREIGN KEY ("label_id") REFERENCES "project_labels"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "work_item_dependencies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "work_item_id" uuid NOT NULL,
        "depends_on_work_item_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_item_dependencies_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_work_item_dependencies" UNIQUE ("work_item_id", "depends_on_work_item_id"),
        CONSTRAINT "FK_work_item_dependencies_item" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_work_item_dependencies_depends" FOREIGN KEY ("depends_on_work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_workflows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "name" character varying(150) NOT NULL,
        "statuses" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_workflows_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_project_workflows_project" UNIQUE ("project_id"),
        CONSTRAINT "FK_project_workflows_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "project_id" uuid,
        "user_id" uuid NOT NULL,
        "action" character varying(50) NOT NULL,
        "entity_type" character varying(50) NOT NULL,
        "entity_id" character varying(100) NOT NULL,
        "description" text NOT NULL,
        "previous_state" jsonb,
        "new_state" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_audit_logs_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_audit_logs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_project" ON "audit_logs" ("project_id", "created_at");`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_org" ON "audit_logs" ("organization_id", "created_at");`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "message" text NOT NULL,
        "read" boolean NOT NULL DEFAULT false,
        "link" character varying(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notifications_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_user" ON "notifications" ("user_id", "read", "created_at");`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_workflows";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "work_item_dependencies";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "work_item_labels";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_labels";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "work_item_time_entries";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "work_item_comments";`);
  }
}
