import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInviteFieldsToUser1792056466964 implements MigrationInterface {
    name = 'AddInviteFieldsToUser1792056466964'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "inviteTokenHash" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "inviteExpiresAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sprints_project_status"`);
        await queryRunner.query(`ALTER TYPE "public"."sprints_status_enum" RENAME TO "sprints_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."sprints_status_enum" AS ENUM('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "sprints" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "sprints" ALTER COLUMN "status" TYPE "public"."sprints_status_enum" USING "status"::"text"::"public"."sprints_status_enum"`);
        await queryRunner.query(`ALTER TABLE "sprints" ALTER COLUMN "status" SET DEFAULT 'PLANNED'`);
        await queryRunner.query(`DROP TYPE "public"."sprints_status_enum_old"`);
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
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`);
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
        await queryRunner.query(`CREATE INDEX "IDX_sprints_project_status" ON "sprints"  ("project_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_project_type" ON "work_items"  ("project_id", "type") `);
        await queryRunner.query(`CREATE INDEX "IDX_work_items_project_status" ON "work_items"  ("project_id", "status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_project_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_items_project_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sprints_project_status"`);
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
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`);
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
        await queryRunner.query(`CREATE TYPE "public"."sprints_status_enum_old" AS ENUM('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "sprints" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "sprints" ALTER COLUMN "status" TYPE "public"."sprints_status_enum_old" USING "status"::"text"::"public"."sprints_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "sprints" ALTER COLUMN "status" SET DEFAULT 'PLANNED'`);
        await queryRunner.query(`DROP TYPE "public"."sprints_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."sprints_status_enum_old" RENAME TO "sprints_status_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_sprints_project_status" ON "sprints" USING btree ("project_id", "status") `);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "inviteExpiresAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "inviteTokenHash"`);
    }

}
