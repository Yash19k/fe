import { MigrationInterface, QueryRunner } from "typeorm";

export class RepairWorkItemLabelRelation1793000000000
  implements MigrationInterface
{
  name = "RepairWorkItemLabelRelation1793000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_items"
      ADD COLUMN IF NOT EXISTS "label_id" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint constraint_row
          JOIN pg_attribute column_row
            ON column_row.attrelid = constraint_row.conrelid
           AND column_row.attnum = ANY(constraint_row.conkey)
          WHERE constraint_row.conrelid = 'work_items'::regclass
            AND constraint_row.contype = 'f'
            AND constraint_row.confrelid = 'project_labels'::regclass
            AND column_row.attname = 'label_id'
        ) THEN
          ALTER TABLE "work_items"
          ADD CONSTRAINT "FK_work_items_label"
          FOREIGN KEY ("label_id") REFERENCES "project_labels"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Keep the repaired relation in place if this migration is rolled back.
  }
}
