import { MigrationInterface, QueryRunner } from "typeorm";
export class AddWorkItemVersionAndDetails1793400000000 implements MigrationInterface
{
  name = "AddWorkItemVersionAndDetails1793400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "version" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "business_goal" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "success_criteria" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "acceptance_criteria" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "bug_severity" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "steps_to_reproduce" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "expected_behavior" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "actual_behavior" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "environment" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" ADD "estimated_hours" numeric(8,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "estimated_hours"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "environment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "actual_behavior"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "expected_behavior"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "steps_to_reproduce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "bug_severity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "acceptance_criteria"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "success_criteria"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "business_goal"`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_items" DROP COLUMN "version"`,
    );
  }
}
