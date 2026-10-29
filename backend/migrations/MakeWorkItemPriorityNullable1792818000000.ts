import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeWorkItemPriorityNullable1792818000000 implements MigrationInterface {
  name = "MakeWorkItemPriorityNullable1792818000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "work_items" SET "priority" = 'MEDIUM' WHERE "priority" IS NULL`);
    await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM'`);
    await queryRunner.query(`ALTER TABLE "work_items" ALTER COLUMN "priority" SET NOT NULL`);
  }
}
