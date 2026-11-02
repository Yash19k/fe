import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryRunner } from "typeorm";
import { AddFeaturePersistenceTables1792300000000 } from "../migrations/1792300000000-AddFeaturePersistenceTables";
import { AddProjectLabels1792399247543 } from "../migrations/1792399247543-AddProjectLabels";
import { CreateAuditLogs1792584447276 } from "../migrations/1792584447276-CreateAuditLogs";

class IsolatedMigrationRunner {
  private readonly tables = new Map<string, { records: string[] }>();
  auditLogsCreateCount = 0;

  async query(sql: string): Promise<unknown[]> {
    const createTable = sql.match(/CREATE TABLE IF NOT EXISTS "([^"]+)"/i);
    if (createTable) {
      this.createTableIfMissing(createTable[1]);
    }

    const dropTable = sql.match(/DROP TABLE(?: IF EXISTS)? "([^"]+)"/i);
    if (dropTable) {
      this.tables.delete(dropTable[1]);
    }

    return [];
  }

  async hasTable(name: string): Promise<boolean> {
    return this.tables.has(name);
  }

  async createTable(table: { name: string }): Promise<void> {
    this.createTableIfMissing(table.name);
  }

  seedAuditLogs(records: string[]): void {
    this.tables.set("audit_logs", { records });
  }

  auditLogRecords(): string[] | undefined {
    return this.tables.get("audit_logs")?.records;
  }

  private createTableIfMissing(name: string): void {
    if (this.tables.has(name)) {
      return;
    }

    this.tables.set(name, { records: [] });
    if (name === "audit_logs") {
      this.auditLogsCreateCount += 1;
    }
  }
}

function asQueryRunner(runner: IsolatedMigrationRunner): QueryRunner {
  return runner as unknown as QueryRunner;
}

test("the later migration does not create or replace an existing audit_logs table", async () => {
  const runner = new IsolatedMigrationRunner();
  const existingRecords = ["existing-audit-record"];
  runner.seedAuditLogs(existingRecords);

  await new CreateAuditLogs1792584447276().up(asQueryRunner(runner));

  assert.equal(runner.auditLogsCreateCount, 0);
  assert.equal(runner.auditLogRecords(), existingRecords);
});

test("rolling back the later migration preserves audit_logs and its records", async () => {
  const runner = new IsolatedMigrationRunner();
  const existingRecords = ["existing-audit-record"];
  runner.seedAuditLogs(existingRecords);

  await new CreateAuditLogs1792584447276().down(asQueryRunner(runner));

  assert.equal(await runner.hasTable("audit_logs"), true);
  assert.deepEqual(runner.auditLogRecords(), existingRecords);
});

test("rolling back a migration that only alters audit_logs preserves its table and records", async () => {
  const runner = new IsolatedMigrationRunner();
  const existingRecords = ["existing-audit-record"];
  runner.seedAuditLogs(existingRecords);

  await new AddProjectLabels1792399247543().down(asQueryRunner(runner));

  assert.equal(await runner.hasTable("audit_logs"), true);
  assert.deepEqual(runner.auditLogRecords(), existingRecords);
});

test("a fresh migration sequence creates audit_logs exactly once", async () => {
  const runner = new IsolatedMigrationRunner();

  await new AddFeaturePersistenceTables1792300000000().up(asQueryRunner(runner));
  await new AddProjectLabels1792399247543().up(asQueryRunner(runner));
  await new CreateAuditLogs1792584447276().up(asQueryRunner(runner));

  assert.equal(await runner.hasTable("audit_logs"), true);
  assert.equal(runner.auditLogsCreateCount, 1);
});

test("rolling back the owning migration removes its audit_logs table", async () => {
  const runner = new IsolatedMigrationRunner();
  const owningMigration = new AddFeaturePersistenceTables1792300000000();

  await owningMigration.up(asQueryRunner(runner));
  assert.equal(await runner.hasTable("audit_logs"), true);

  await owningMigration.down(asQueryRunner(runner));

  assert.equal(await runner.hasTable("audit_logs"), false);
});
