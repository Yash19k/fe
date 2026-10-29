import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkItemSchedulingFields1793030000000
  implements MigrationInterface
{
  name = "AddWorkItemSchedulingFields1793030000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Existing due dates and assignment estimates do not define reliable planned starts or durations.
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "planned_start_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "planned_duration_working_days" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "is_schedule_pinned" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD CONSTRAINT "CHK_work_items_planned_duration_positive" CHECK ("planned_duration_working_days" IS NULL OR "planned_duration_working_days" > 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP CONSTRAINT "CHK_work_items_planned_duration_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "is_schedule_pinned"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "planned_duration_working_days"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "planned_start_date"`,
    );
  }
}
