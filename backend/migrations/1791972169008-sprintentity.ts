import { MigrationInterface, QueryRunner } from "typeorm";

export class Sprintentity1791972169008 implements MigrationInterface {
    name = 'Sprintentity1791972169008'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."sprints_status_enum" AS ENUM('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "sprints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "project_id" uuid NOT NULL, "created_by_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "goal" text, "start_date" date NOT NULL, "end_date" date NOT NULL, "status" "public"."sprints_status_enum" NOT NULL DEFAULT 'PLANNED', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_sprints_valid_dates" CHECK ("end_date" >= "start_date"), CONSTRAINT "PK_6800aa2e0f508561812c4b9afb4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_sprints_project_status" ON "sprints"  ("project_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_sprints_created_by_id" ON "sprints"  ("created_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_sprints_project_id" ON "sprints"  ("project_id") `);
        await queryRunner.query(`ALTER TABLE "work_items" ADD "sprint_id" uuid`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_project_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_project_status"`);
        await queryRunner.query(`ALTER TYPE "public"."work_items_type_enum" RENAME TO "work_items_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."work_items_type_enum" AS ENUM('EPIC', 'STORY', 'TASK', 'SUBTASK', 'BUG')`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "type" TYPE "public"."work_items_type_enum" USING "type"::"text"::"public"."work_items_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."work_items_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."work_items_status_enum" RENAME TO "work_items_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."work_items_status_enum" AS ENUM('BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING_QA', 'BLOCKED', 'ON_HOLD', 'DONE')`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "status" TYPE "public"."work_items_status_enum" USING "status"::"text"::"public"."work_items_status_enum"`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "status" SET DEFAULT 'BACKLOG'`);
        await queryRunner.query(`DROP TYPE "public"."work_items_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."work_items_priority_enum" RENAME TO "work_items_priority_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."work_items_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT')`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" TYPE "public"."work_items_priority_enum" USING "priority"::"text"::"public"."work_items_priority_enum"`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM'`);
        await queryRunner.query(`DROP TYPE "public"."work_items_priority_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."project_members_role_enum" RENAME TO "project_members_role_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."project_members_role_enum" AS ENUM('ADMIN', 'LEAD', 'MEMBER')`);
        await queryRunner.query(`ALTER TABLE "project_members" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "project_members" ALTER COLUMN "role" TYPE "public"."project_members_role_enum" USING "role"::"text"::"public"."project_members_role_enum"`);
        await queryRunner.query(`ALTER TABLE "project_members" ALTER COLUMN "role" SET DEFAULT 'MEMBER'`);
        await queryRunner.query(`DROP TYPE "public"."project_members_role_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum" RENAME TO "users_role_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'MANAGER', 'TEAMMATE')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum" USING "role"::"text"::"public"."users_role_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'ADMIN'`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."users_status_enum" RENAME TO "users_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('PENDING', 'ACTIVE', 'DISABLED')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum" USING "status"::"text"::"public"."users_status_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_project_type" ON "work_items"  ("project_id", "type") `);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_project_status" ON "work_items"  ("project_id", "status") `);
        await queryRunner.query(`ALTER TABLE "sprints" ADD CONSTRAINT "FK_82145010051f3f2fc94671c0b35" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sprints" ADD CONSTRAINT "FK_f5d59fb0dc6d4bf3124f5b9006a" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "work_items" ADD CONSTRAINT "FK_0b92ed84dd33cded6b78dd3d600" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "work_items" DROP CONSTRAINT "FK_0b92ed84dd33cded6b78dd3d600"`);
        await queryRunner.query(`ALTER TABLE "sprints" DROP CONSTRAINT "FK_f5d59fb0dc6d4bf3124f5b9006a"`);
        await queryRunner.query(`ALTER TABLE "sprints" DROP CONSTRAINT "FK_82145010051f3f2fc94671c0b35"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_project_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_project_type"`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum_old" AS ENUM('PENDING', 'ACTIVE', 'DISABLED')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum_old" USING "status"::"text"::"public"."users_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."users_status_enum_old" RENAME TO "users_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum_old" AS ENUM('ADMIN', 'MANAGER', 'TEAMMATE')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum_old" USING "role"::"text"::"public"."users_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'ADMIN'`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum_old" RENAME TO "users_role_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."project_members_role_enum_old" AS ENUM('ADMIN', 'LEAD', 'MEMBER')`);
        await queryRunner.query(`ALTER TABLE "project_members" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "project_members" ALTER COLUMN "role" TYPE "public"."project_members_role_enum_old" USING "role"::"text"::"public"."project_members_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "project_members" ALTER COLUMN "role" SET DEFAULT 'MEMBER'`);
        await queryRunner.query(`DROP TYPE "public"."project_members_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."project_members_role_enum_old" RENAME TO "project_members_role_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."work_items_priority_enum_old" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT')`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" TYPE "public"."work_items_priority_enum_old" USING "priority"::"text"::"public"."work_items_priority_enum_old"`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM'`);
        await queryRunner.query(`DROP TYPE "public"."work_items_priority_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."work_items_priority_enum_old" RENAME TO "work_items_priority_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."work_items_status_enum_old" AS ENUM('BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING_QA', 'BLOCKED', 'ON_HOLD', 'DONE')`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "status" TYPE "public"."work_items_status_enum_old" USING "status"::"text"::"public"."work_items_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "status" SET DEFAULT 'BACKLOG'`);
        await queryRunner.query(`DROP TYPE "public"."work_items_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."work_items_status_enum_old" RENAME TO "work_items_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."work_items_type_enum_old" AS ENUM('EPIC', 'STORY', 'TASK', 'SUBTASK', 'BUG')`);
        await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "type" TYPE "public"."work_items_type_enum_old" USING "type"::"text"::"public"."work_items_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."work_items_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."work_items_type_enum_old" RENAME TO "work_items_type_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_project_status" ON "work_items" USING btree ("project_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_project_type" ON "work_items" USING btree ("project_id", "type") `);
        await queryRunner.query(`ALTER TABLE "work_items" DROP COLUMN "sprint_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sprints_project_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sprints_created_by_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sprints_project_status"`);
        await queryRunner.query(`DROP TABLE "sprints"`);
        await queryRunner.query(`DROP TYPE "public"."sprints_status_enum"`);
    }

}
