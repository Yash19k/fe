"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialSchema1791869433890 = void 0;
class InitialSchema1791869433890 {
    constructor() {
        this.name = 'InitialSchema1791869433890';
    }
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "work_item_assignees" ("work_item_id" uuid NOT NULL, "user_id" uuid NOT NULL, "assigned_by_id" uuid, "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "start_date" date, "estimated_hours" numeric(8,2), CONSTRAINT "PK_bc87e1eae44570da007c7d2b235" PRIMARY KEY ("work_item_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_work_item_assignees_user_id" ON "work_item_assignees"  ("user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."work_items_type_enum" AS ENUM('EPIC', 'STORY', 'TASK', 'SUBTASK', 'BUG')`);
        await queryRunner.query(`CREATE TYPE "public"."work_items_status_enum" AS ENUM('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')`);
        await queryRunner.query(`CREATE TYPE "public"."work_items_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT')`);
        await queryRunner.query(`CREATE TABLE "work_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "created_by_id" uuid NOT NULL, "parent_work_item_id" uuid, "type" "public"."work_items_type_enum" NOT NULL, "title" character varying(255) NOT NULL, "description" text, "status" "public"."work_items_status_enum" NOT NULL DEFAULT 'TODO', "priority" "public"."work_items_priority_enum" NOT NULL DEFAULT 'MEDIUM', "due_date" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_afbfa01728533c866eafaf6f160" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_project_type" ON "work_items"  ("project_id", "type") `);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_project_status" ON "work_items"  ("project_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_parent_id" ON "work_items"  ("parent_work_item_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_created_by_id" ON "work_items"  ("created_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_project_id" ON "work_items"  ("project_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_organization_id" ON "work_items"  ("organization_id") `);
        await queryRunner.query(`CREATE TABLE "project_members" ("project_id" uuid NOT NULL, "user_id" uuid NOT NULL, "added_by_id" uuid, "joined_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b3f491d3a3f986106d281d8eb4b" PRIMARY KEY ("project_id", "user_id"))`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "key" character varying(20) NOT NULL, "description" text, "created_by_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_projects_organization_key" UNIQUE ("organization_id", "key"), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_projects_created_by_id" ON "projects"  ("created_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_projects_organization_id" ON "projects"  ("organization_id") `);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'MANAGER', 'TEAMMATE')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('PENDING', 'ACTIVE', 'DISABLED')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organization_id" uuid NOT NULL, "full_name" character varying(100) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'ADMIN', "status" "public"."users_status_enum" NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_users_organization_id" ON "users"  ("organization_id") `);
        await queryRunner.query(`CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "slug" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE ("slug"), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "work_item_assignees" ADD CONSTRAINT "FK_8af2c57abe484cafbed112dad75" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "work_item_assignees" ADD CONSTRAINT "FK_50ea5f7aa08eed482de82db4434" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "work_item_assignees" ADD CONSTRAINT "FK_29a1b213a45210bd10e6f4b3eb0" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD CONSTRAINT "FK_5546d4f73bf19d6e7fba13b59a7" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD CONSTRAINT "FK_aedce0ee415f869fe714c8dc5f8" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD CONSTRAINT "FK_2bf49537a7496406642f5d9a34c" FOREIGN KEY ("parent_work_item_id") REFERENCES "work_items"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD CONSTRAINT "FK_b5729113570c20c7e214cf3f58d" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD CONSTRAINT "FK_e89aae80e010c2faa72e6a49ce8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_members" ADD CONSTRAINT "FK_cfb6c136f3b97d5db98f22f6133" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_585c8ce06628c70b70100bfb842" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_c24760a4c22a838d6a8eb1fdc3a" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_21a659804ed7bf61eb91688dea7" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_21a659804ed7bf61eb91688dea7"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_c24760a4c22a838d6a8eb1fdc3a"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_585c8ce06628c70b70100bfb842"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_cfb6c136f3b97d5db98f22f6133"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_e89aae80e010c2faa72e6a49ce8"`);
        await queryRunner.query(`ALTER TABLE "project_members" DROP CONSTRAINT "FK_b5729113570c20c7e214cf3f58d"`);
        await queryRunner.query(`ALTER TABLE "work_items" DROP CONSTRAINT "FK_2bf49537a7496406642f5d9a34c"`);
        await queryRunner.query(`ALTER TABLE "work_items" DROP CONSTRAINT "FK_aedce0ee415f869fe714c8dc5f8"`);
        await queryRunner.query(`ALTER TABLE "work_items" DROP CONSTRAINT "FK_5546d4f73bf19d6e7fba13b59a7"`);
        await queryRunner.query(`ALTER TABLE "work_item_assignees" DROP CONSTRAINT "FK_29a1b213a45210bd10e6f4b3eb0"`);
        await queryRunner.query(`ALTER TABLE "work_item_assignees" DROP CONSTRAINT "FK_50ea5f7aa08eed482de82db4434"`);
        await queryRunner.query(`ALTER TABLE "work_item_assignees" DROP CONSTRAINT "FK_8af2c57abe484cafbed112dad75"`);
        await queryRunner.query(`DROP TABLE "organizations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_users_organization_id"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_projects_organization_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_projects_created_by_id"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TABLE "project_members"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_organization_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_project_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_created_by_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_parent_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_project_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_project_type"`);
        await queryRunner.query(`DROP TABLE "work_items"`);
        await queryRunner.query(`DROP TYPE "public"."work_items_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."work_items_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."work_items_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_item_assignees_user_id"`);
        await queryRunner.query(`DROP TABLE "work_item_assignees"`);
    }
}
exports.InitialSchema1791869433890 = InitialSchema1791869433890;
