"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddMappedEntityTables1791980000000 = void 0;
class AddMappedEntityTables1791980000000 {
    constructor() {
        this.name = "AddMappedEntityTables1791980000000";
    }
    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."work_item_attachments_type_enum" AS ENUM('IMAGE', 'VIDEO', 'DOCUMENT', 'OTHER')`);
        await queryRunner.query(`CREATE TYPE "public"."work_item_recurrences_frequency_enum" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY')`);
        await queryRunner.query(`CREATE TYPE "public"."work_item_recurrences_monthly_pattern_enum" AS ENUM('DAY_OF_MONTH', 'FIRST_DAY', 'LAST_FRIDAY')`);
        await queryRunner.query(`CREATE TABLE "work_item_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "work_item_id" uuid NOT NULL, "uploaded_by_id" uuid NOT NULL, "original_name" character varying(255) NOT NULL, "type" "public"."work_item_attachments_type_enum" NOT NULL, "mime_type" character varying(150) NOT NULL, "size" bigint NOT NULL, "storage_key" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_work_item_attachments_storage_key" UNIQUE ("storage_key"), CONSTRAINT "PK_work_item_attachments_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_work_item_attachments_work_item_created" ON "work_item_attachments" ("work_item_id", "created_at")`);
        await queryRunner.query(`CREATE TABLE "work_item_recurrences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "work_item_id" uuid NOT NULL, "frequency" "public"."work_item_recurrences_frequency_enum" NOT NULL, "interval" integer NOT NULL DEFAULT 1, "days_of_week" smallint[], "monthly_pattern" "public"."work_item_recurrences_monthly_pattern_enum", "day_of_month" smallint, "starts_on" date NOT NULL, "ends_on" date, "next_run_at" TIMESTAMP WITH TIME ZONE, "timezone" character varying(100) NOT NULL DEFAULT 'UTC', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_recurrence_interval_positive" CHECK ("interval" > 0), CONSTRAINT "PK_work_item_recurrences_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_work_item_recurrences_work_item" UNIQUE ("work_item_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_recurrence_next_run" ON "work_item_recurrences" ("is_active", "next_run_at")`);
        await queryRunner.query(`CREATE TABLE "work_item_occurrences" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "recurrence_id" uuid NOT NULL, "scheduled_for" date NOT NULL, "work_item_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_occurrence_recurrence_date" UNIQUE ("recurrence_id", "scheduled_for"), CONSTRAINT "UQ_work_item_occurrences_work_item" UNIQUE ("work_item_id"), CONSTRAINT "PK_work_item_occurrences_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_occurrence_recurrence" ON "work_item_occurrences" ("recurrence_id")`);
        await queryRunner.query(`ALTER TABLE "work_item_attachments" ADD CONSTRAINT "FK_work_item_attachments_work_item" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "work_item_attachments" ADD CONSTRAINT "FK_work_item_attachments_user" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "work_item_recurrences" ADD CONSTRAINT "FK_work_item_recurrences_work_item" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "work_item_occurrences" ADD CONSTRAINT "FK_work_item_occurrences_recurrence" FOREIGN KEY ("recurrence_id") REFERENCES "work_item_recurrences"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "work_item_occurrences" ADD CONSTRAINT "FK_work_item_occurrences_work_item" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "work_item_occurrences" DROP CONSTRAINT "FK_work_item_occurrences_work_item"`);
        await queryRunner.query(`ALTER TABLE "work_item_occurrences" DROP CONSTRAINT "FK_work_item_occurrences_recurrence"`);
        await queryRunner.query(`ALTER TABLE "work_item_recurrences" DROP CONSTRAINT "FK_work_item_recurrences_work_item"`);
        await queryRunner.query(`ALTER TABLE "work_item_attachments" DROP CONSTRAINT "FK_work_item_attachments_user"`);
        await queryRunner.query(`ALTER TABLE "work_item_attachments" DROP CONSTRAINT "FK_work_item_attachments_work_item"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_occurrence_recurrence"`);
        await queryRunner.query(`DROP TABLE "work_item_occurrences"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_recurrence_next_run"`);
        await queryRunner.query(`DROP TABLE "work_item_recurrences"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_work_item_attachments_work_item_created"`);
        await queryRunner.query(`DROP TABLE "work_item_attachments"`);
        await queryRunner.query(`DROP TYPE "public"."work_item_recurrences_monthly_pattern_enum"`);
        await queryRunner.query(`DROP TYPE "public"."work_item_recurrences_frequency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."work_item_attachments_type_enum"`);
    }
}
exports.AddMappedEntityTables1791980000000 = AddMappedEntityTables1791980000000;
