# TASKFLOQ Migration Rollback Safety Report

## 1. Executive summary

The target migration's `down()` correctly removes the schema it created, but that reversal permanently deletes persisted feature data. The affected tables include audit history, notifications, project workflows, work-item dependencies, comments, time entries, labels, and label assignments.

The selected strategy is to preserve the existing TypeORM migration behavior and history, and prohibit production rollback through this migration unless the data is explicitly disposable, all required approvals and a verified recovery path exist. Editing the historical migration to retain tables or report a successful no-op would break rollback semantics and could produce schema/history divergence.

Review also found that the later `1792399247543-AddProjectLabels` migration's `down()` drops several tables that its own `up()` does not create. This makes a rollback reaching the target especially unsafe. That migration was not changed because this task is scoped to the target migration; it must be handled as a separate migration-history correction. Until then, do not roll back this chain in production.

## 2. Original rollback risk

`AddFeaturePersistenceTables1792300000000.down()` issues `DROP TABLE IF EXISTS` for every table created by its `up()`. `DROP TABLE` removes both the schema and every row in the table; TypeORM cannot recover those rows by reapplying `up()`.

The migration is the original owner of these tables. A later no-op `CreateAuditLogs1792584447276` migration explicitly recognizes that `audit_logs` was created by this migration. Therefore, preserving the target's correct reverse behavior while restricting production operations is less disruptive than editing historical DDL.

## 3. Tables and constraints affected

The target migration creates only these eight tables:

| Table | Primary/unique constraints | Foreign keys | Explicit indexes |
|---|---|---|---|
| `work_item_comments` | Primary key on `id` | `work_item_id -> work_items.id` (`CASCADE`); `author_id -> users.id` (`RESTRICT`) | `IDX_work_item_comments_work_item` |
| `work_item_time_entries` | Primary key on `id` | `work_item_id -> work_items.id` (`CASCADE`); `user_id -> users.id` (`RESTRICT`) | `IDX_work_item_time_entries_work_item` |
| `project_labels` | Primary key on `id`; unique `(project_id, name)` | `project_id -> projects.id` (`CASCADE`) | `IDX_project_labels_project` |
| `work_item_labels` | Composite primary key `(work_item_id, label_id)` | `work_item_id -> work_items.id` (`CASCADE`); `label_id -> project_labels.id` (`CASCADE`) | None |
| `work_item_dependencies` | Primary key on `id`; unique `(work_item_id, depends_on_work_item_id)` | Both work-item columns reference `work_items.id` (`CASCADE`) | None |
| `project_workflows` | Primary key on `id`; unique `project_id` | `project_id -> projects.id` (`CASCADE`) | None |
| `audit_logs` | Primary key on `id` | `organization_id -> organizations.id` (`CASCADE`); nullable `project_id -> projects.id` (`CASCADE`); `user_id -> users.id` (`RESTRICT`) | `IDX_audit_logs_project`, `IDX_audit_logs_org` |
| `notifications` | Primary key on `id` | `user_id -> users.id` (`CASCADE`); `organization_id -> organizations.id` (`CASCADE`) | `IDX_notifications_user` |

The primary/unique constraints and foreign keys are declared inline in `CREATE TABLE`. PostgreSQL drops those constraints and each table's indexes with the table; the migration does not need separate `DROP CONSTRAINT` or `DROP INDEX` statements. The `work_item_labels` table depends on `project_labels`, and its table is dropped first. All other foreign keys point to pre-existing application tables.

`up()` performs no unrelated schema changes. It creates the tables and the six explicit indexes listed above, using `IF NOT EXISTS`.

## 4. Migration dependency analysis

- `1792300000000-AddFeaturePersistenceTables.ts` owns all eight tables above.
- `1792399247543-AddProjectLabels.ts` alters other existing schema, adds the `work_items.label_id -> project_labels.id` relation, and operates on tables owned by the target. Its `down()` issues drops for `work_item_time_entries`, `work_item_comments`, `work_item_dependencies`, `project_workflows`, `notifications`, and `project_labels` even though its `up()` does not create them. It also removes `work_items.label_id`. In addition, it does not drop the target-owned `work_item_labels` table or its FK to `project_labels` before attempting to drop `project_labels`, so PostgreSQL may reject that statement. The exact outcome was not exercised against PostgreSQL. This is a separate rollback defect that makes reverting this migration chain unsafe and potentially incomplete.
- `1792400000000-AddAuditLogUndoTracking.ts` adds audit-log columns and an index; its `down()` removes those schema additions.
- `1792559847406-AddedComent.ts` alters existing relations, indexes, columns, and enums and rebuilds foreign keys involving target tables. Its rollback is part of the full rollback chain.
- `1792584447276-CreateAuditLogs.ts` is an explicit no-op for compatibility; its source states the target migration owns `audit_logs`.
- `1792736602187-changedNotification.ts` adds notification fields and an enum; its `down()` removes those later additions.
- `1793000000000-RepairWorkItemLabelRelation.ts` adds/repairs the `work_items.label_id -> project_labels.id` relation. Its `down()` intentionally retains that relation. The earlier `1792399247543` rollback removes `label_id`; this history requires particular care if attempting rollback.

Relevant TypeORM entities map directly to the target tables: `AuditLog`, `Notification`, `ProjectWorkflow`, `WorkItemDependency`, `WorkItemComment`, `WorkItemTimeEntry`, and `ProjectLabel`. Their repository metadata confirms these are active application data, not disposable migration scaffolding. The notification and audit-log entities also include columns added by later migrations.

Migration filenames preserve the existing timestamp ordering. This was inspected statically; no database was queried to inspect applied migration status.

## 5. Root cause

`down()` reverses schema but necessarily cannot reverse data creation or ongoing application writes. The application stores durable, user- and organization-related records in these tables, while `DROP TABLE` permanently deletes them. TypeORM's ordinary rollback mechanism does not distinguish disposable development data from production records or enforce a backup/retention policy. Also, because `up()` uses `CREATE TABLE IF NOT EXISTS`, it can leave an already-existing table untouched while `down()` will still drop it; a rollback must not proceed if schema history cannot prove that the migration created each affected object.

The risk is compounded by the later `AddProjectLabels.down()` dropping target-owned tables outside its own `up()` changes.

## 6. Rollback strategy selected

**Keep the target migration's reversible `down()` unchanged; impose a documented production rollback restriction.**

- Do not remove the `DROP TABLE` statements: that would make TypeORM rollback incomplete and leave schema inconsistent with migration history.
- Do not turn `down()` into a silent no-op or a success-shaped guard.
- Do not edit historical DDL: the migration has later migrations depending on its tables and is part of the established migration ordering.
- Treat rollback to or through `1792300000000` as destructive and prohibited in production by default. Also prohibit rollback through `1792399247543` until its independent `down()` defect is addressed and verified.
- Prefer a forward corrective migration when the goal is to change or repair the current schema; it avoids erasing active feature data and avoids rewriting applied migration history.

This is an operational policy, not a code-level lockout. Production release/change controls must enforce it. A future, separately reviewed migration correction should address the unrelated `AddProjectLabels.down()` behavior without silently rewriting already-applied migration history.

## 7. Files modified

- `MIGRATION_ROLLBACK_SAFETY_REPORT.md` - added this investigation, policy, verification record, and production procedure.
- No migration, entity, controller, or business-logic files were changed.

## 8. Changes made

- Documented that production rollback through the target is prohibited by default.
- Documented the target's full table/constraint/index footprint and correct reverse drop order.
- Identified the downstream rollback defect and its impact.
- Preserved existing TypeORM `up()`/`down()` behavior and migration ordering.
- Provided a backup verification, approval, rollback, and recovery procedure below.

## 9. Data-loss risk assessment

**Risk: HIGH / irreversible without a usable backup or recovery point.**

If the target's `down()` runs, it permanently removes all rows in all eight target tables. In particular:

- `audit_logs`: historical audit events and undo history added by later migrations.
- `notifications`: notification history and any later-added notification values.
- `project_workflows`: project-specific workflow configuration.
- `work_item_dependencies`: dependency relationships.
- `work_item_comments` and `work_item_time_entries`: user-entered work history.
- `project_labels` and `work_item_labels`: project labels and their assignments.

Reapplying the migration recreates empty tables; it does not restore deleted rows. The later `AddProjectLabels.down()` can delete six of these tables before rollback reaches the target.

## 10. Migration test results

| Check | Result | Evidence / limitation |
|---|---|---|
| Focused audit-log migration tests | **PASS** | `tests/audit-log-migrations.test.ts`: 5/5 passed, including owning-migration table removal and later-migration preservation behavior. These use an isolated in-memory test runner, not PostgreSQL. |
| Backend TypeScript type-check | **PASS** | `pnpm run typecheck` completed successfully. |
| Backend build / migration compilation | **PASS** | `pnpm run build` completed successfully and compiled migration sources. |
| Static migration ordering and source dependency inspection | **PASS** | Migration filenames and relevant `up()`/`down()` implementations were inspected. |
| `git diff --check` | **PASS** | No whitespace errors in the final changes. |
| Real isolated PostgreSQL `up()` / data / rollback / reapply test | **NOT EXECUTED** | No isolated database was established; no database was connected to or modified. |
| TypeORM applied-migration status inspection | **NOT EXECUTED** | Deliberately not connected to any configured database. |
| Production or shared database rollback | **NOT EXECUTED** | Prohibited by task constraints. |

## 11. Production rollback procedure

### When rollback may be considered

Only consider rollback in an approved maintenance window when all of the following are true:

1. The change-control owner, database owner, and data/retention owners approve the loss or approved migration of every affected record.
2. The target's exact schema ownership is established; do not proceed if `IF NOT EXISTS` may have caused the migration to skip any pre-existing table or index.
3. The rollback target and every later migration's `down()` have been reviewed. Do not proceed while the `1792399247543` rollback behavior remains uncorrected and its FK/drop ordering unverified.
4. Writes are quiesced, the exact migration state is confirmed using the deployed TypeORM migration tooling, and the complete ordered rollback path has been rehearsed in an isolated environment matching the production version.
5. A consistent pre-change backup or point-in-time recovery point has been created and verified by restoring it to an isolated database and checking representative tables, row counts, and application integrity.
6. A written recovery owner, recovery time objective, and plan for reconciling writes made after the backup are in place.

If any affected data must remain available, do not roll back. Prefer a forward corrective migration.

### Before an approved destructive rollback

1. Stop or quiesce application writes and record the maintenance start time.
2. Capture a database-consistent backup using the organization's approved PostgreSQL backup process. For `pg_dump`, use a protected destination and a custom-format archive, for example:

   ```sh
   pg_dump --format=custom --file=/secure-backups/taskflow-pre-rollback.dump "$DATABASE_URL"
   ```

   Protect the archive and connection credentials according to operational policy. Capture required cluster globals/roles separately if the recovery plan depends on them.
3. Verify that the archive is readable (for example, inspect it with `pg_restore --list`) and, critically, restore it into a separate isolated database. Check expected schema, representative records in all eight tables, and application-level integrity. Do not state that a backup exists or is usable until this restoration check succeeds.
4. Record the backup identifier, creation time, database/migration state, verification evidence, approvers, and rollback plan.
5. Rehearse the full rollback sequence against a disposable database before scheduling the production operation. Do not use a shared database for this rehearsal.

### During and after rollback

1. Follow the approved TypeORM migration order; do not skip later migrations or manually drop tables/constraints to force progress.
2. Stop immediately on any mismatch or failure. Do not retry with destructive SQL or `CASCADE`.
3. Verify the resulting migration state and schema, then validate the application before restoring writes.

### Recovery if rollback causes data loss

Do not blindly restore the pre-rollback backup over the production database: that can discard valid writes made after the backup. Restore the backup or point-in-time recovery to a separate database, validate it, and then use an approved recovery plan to restore the complete database or selectively reconcile records into production. Selective recovery must account for foreign keys, identifiers, later-added columns, duplicates, and writes since the backup. Reopen production writes only after the data owner and database owner accept the reconciled state.

## 12. Remaining risks

- The restriction is documented rather than enforced by TypeORM or application code; production change controls must prevent accidental invocation.
- The later `1792399247543-AddProjectLabels.down()` issues drops for target-owned tables not created by its `up()` and attempts to drop `project_labels` while target-owned `work_item_labels` still references it. This remains a separate unresolved migration defect and blocks a trustworthy production rollback through that point.
- Target `up()` uses `IF NOT EXISTS`, so source inspection alone cannot establish that the target created every table/index in an actual database; the deployed migration history and schema provenance must be verified before any rollback.
- No real PostgreSQL rollback/reapply test or applied migration status check was performed.
- A backup without a successful isolated restore test is not a verified recovery path. Even a verified pre-rollback backup requires reconciliation planning for later writes.

## 13. Final verdict

**The selected rollback policy is implemented and its source-level behavior is verified; production rollback remains prohibited by default.** The target migration's historical TypeORM behavior is preserved, and no production/shared database was touched. Do not treat production rollback as safe or issue a rollback approval based on this report alone: the later migration defect and lack of an isolated PostgreSQL rehearsal must first be addressed for any proposed rollback. For production schema corrections, use a forward migration.
