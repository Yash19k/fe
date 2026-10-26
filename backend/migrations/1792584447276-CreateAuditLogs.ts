import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from "typeorm";

export class CreateAuditLogs1792584447276 implements MigrationInterface {
  name = "CreateAuditLogs1792584447276";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Older databases already received audit_logs from
    // AddFeaturePersistenceTables. Treat this migration as satisfied there
    // instead of attempting to recreate the existing relation.
    if (await queryRunner.hasTable("audit_logs")) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: "audit_logs",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "uuid_generate_v4()",
          },
          {
            name: "organization_id",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "project_id",
            type: "uuid",
            isNullable: true,
          },
          {
            name: "user_id",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "action",
            type: "varchar",
            length: "50",
            isNullable: false,
          },
          {
            name: "entity_type",
            type: "varchar",
            length: "50",
            isNullable: false,
          },
          {
            name: "entity_id",
            type: "varchar",
            length: "100",
            isNullable: false,
          },
          {
            name: "description",
            type: "text",
            isNullable: false,
          },
          {
            name: "previous_state",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "new_state",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "is_undone",
            type: "boolean",
            default: "false",
            isNullable: false,
          },
          {
            name: "undone_at",
            type: "timestamptz",
            isNullable: true,
          },
          {
            name: "undone_by_id",
            type: "uuid",
            isNullable: true,
          },
          {
            name: "reversal_log_id",
            type: "uuid",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamptz",
            default: "now()",
            isNullable: false,
          },
        ],
      }),
    );

    await queryRunner.createForeignKeys("audit_logs", [
      new TableForeignKey({
        columnNames: ["organization_id"],
        referencedTableName: "organizations",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
      new TableForeignKey({
        columnNames: ["project_id"],
        referencedTableName: "projects",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      }),
      new TableForeignKey({
        columnNames: ["user_id"],
        referencedTableName: "users",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
    ]);

    await queryRunner.createIndices("audit_logs", [
      new TableIndex({
        name: "IDX_audit_logs_project",
        columnNames: ["project_id", "created_at"],
      }),
      new TableIndex({
        name: "IDX_audit_logs_org",
        columnNames: ["organization_id", "created_at"],
      }),
      new TableIndex({
        name: "IDX_audit_logs_is_undone",
        columnNames: ["is_undone"],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable("audit_logs")) {
      await queryRunner.dropTable("audit_logs", true);
    }
  }
}
