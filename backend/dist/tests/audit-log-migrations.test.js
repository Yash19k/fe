"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const _1792300000000_AddFeaturePersistenceTables_1 = require("../migrations/1792300000000-AddFeaturePersistenceTables");
const _1792399247543_AddProjectLabels_1 = require("../migrations/1792399247543-AddProjectLabels");
const _1792584447276_CreateAuditLogs_1 = require("../migrations/1792584447276-CreateAuditLogs");
class IsolatedMigrationRunner {
    constructor() {
        this.tables = new Map();
        this.auditLogsCreateCount = 0;
    }
    async query(sql) {
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
    async hasTable(name) {
        return this.tables.has(name);
    }
    async createTable(table) {
        this.createTableIfMissing(table.name);
    }
    seedAuditLogs(records) {
        this.tables.set("audit_logs", { records });
    }
    auditLogRecords() {
        return this.tables.get("audit_logs")?.records;
    }
    createTableIfMissing(name) {
        if (this.tables.has(name)) {
            return;
        }
        this.tables.set(name, { records: [] });
        if (name === "audit_logs") {
            this.auditLogsCreateCount += 1;
        }
    }
}
function asQueryRunner(runner) {
    return runner;
}
(0, node_test_1.test)("the later migration does not create or replace an existing audit_logs table", async () => {
    const runner = new IsolatedMigrationRunner();
    const existingRecords = ["existing-audit-record"];
    runner.seedAuditLogs(existingRecords);
    await new _1792584447276_CreateAuditLogs_1.CreateAuditLogs1792584447276().up(asQueryRunner(runner));
    strict_1.default.equal(runner.auditLogsCreateCount, 0);
    strict_1.default.equal(runner.auditLogRecords(), existingRecords);
});
(0, node_test_1.test)("rolling back the later migration preserves audit_logs and its records", async () => {
    const runner = new IsolatedMigrationRunner();
    const existingRecords = ["existing-audit-record"];
    runner.seedAuditLogs(existingRecords);
    await new _1792584447276_CreateAuditLogs_1.CreateAuditLogs1792584447276().down(asQueryRunner(runner));
    strict_1.default.equal(await runner.hasTable("audit_logs"), true);
    strict_1.default.deepEqual(runner.auditLogRecords(), existingRecords);
});
(0, node_test_1.test)("rolling back a migration that only alters audit_logs preserves its table and records", async () => {
    const runner = new IsolatedMigrationRunner();
    const existingRecords = ["existing-audit-record"];
    runner.seedAuditLogs(existingRecords);
    await new _1792399247543_AddProjectLabels_1.AddProjectLabels1792399247543().down(asQueryRunner(runner));
    strict_1.default.equal(await runner.hasTable("audit_logs"), true);
    strict_1.default.deepEqual(runner.auditLogRecords(), existingRecords);
});
(0, node_test_1.test)("a fresh migration sequence creates audit_logs exactly once", async () => {
    const runner = new IsolatedMigrationRunner();
    await new _1792300000000_AddFeaturePersistenceTables_1.AddFeaturePersistenceTables1792300000000().up(asQueryRunner(runner));
    await new _1792399247543_AddProjectLabels_1.AddProjectLabels1792399247543().up(asQueryRunner(runner));
    await new _1792584447276_CreateAuditLogs_1.CreateAuditLogs1792584447276().up(asQueryRunner(runner));
    strict_1.default.equal(await runner.hasTable("audit_logs"), true);
    strict_1.default.equal(runner.auditLogsCreateCount, 1);
});
(0, node_test_1.test)("rolling back the owning migration removes its audit_logs table", async () => {
    const runner = new IsolatedMigrationRunner();
    const owningMigration = new _1792300000000_AddFeaturePersistenceTables_1.AddFeaturePersistenceTables1792300000000();
    await owningMigration.up(asQueryRunner(runner));
    strict_1.default.equal(await runner.hasTable("audit_logs"), true);
    await owningMigration.down(asQueryRunner(runner));
    strict_1.default.equal(await runner.hasTable("audit_logs"), false);
});
