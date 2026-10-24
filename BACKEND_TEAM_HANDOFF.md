# BACKEND TEAM HANDOFF — AUDIT LOG UNDO ELIGIBILITY & UUID CASTING

## 1. Executive Summary
During investigation of audit log undo persistence across browser refreshes, the frontend was verified to correctly consume the existing `GET /api/projects/:projectId/audit-logs` endpoint and execute reversals via `POST /api/projects/:projectId/audit-logs/:logId/undo`.

However, an edge case in the backend audit log query causes `canUndo` to be returned as `false` for all tasks in a project if any audit log in that project references a non-UUID task ID.

The frontend has implemented robust fallback evaluation using authoritative persisted fields (`isUndone`, `undoneAt`, `previousState`, and `action`). To ensure backend data contract purity, this document describes the exact issue and recommended backend fix.

---

## 2. Inspected Endpoint & Behavior

### Endpoint
`GET /api/projects/:projectId/audit-logs`

### Handler Location
`backend/controllers/feature-persistence.controller.ts` (`getProjectAuditLogs`)

### Existing Code (lines 482–499)
```typescript
const taskIds = logs
  .filter((l) => l.entityType === "task" && l.entityId)
  .map((l) => l.entityId);

const taskMap: Record<string, string> = {};
if (taskIds.length > 0) {
  try {
    const foundTasks = await AppDataSource.getRepository(WorkItem).find({
      where: { id: In(taskIds) },
      select: { id: true, title: true },
    });
    foundTasks.forEach((t) => {
      taskMap[t.id] = t.title;
    });
  } catch {
    // In case of non-uuid entityId, gracefully continue
  }
}
```

And in lines 520–528:
```typescript
const canUndo =
  !l.isUndone &&
  Boolean(l.previousState) &&
  l.action !== "undone" &&
  l.action !== "UNDONE" &&
  l.action !== "deleted" &&
  l.action !== "DELETED" &&
  (l.entityType !== "task" || Boolean(taskMap[l.entityId]));
```

---

## 3. Root Cause Analysis
1. PostgreSQL defines `work_items.id` as a `UUID` primary key (`@PrimaryGeneratedColumn("uuid")`).
2. When `taskIds` contains any string that is not a valid 36-character UUID (for example, client-generated temporary IDs like `tf-1792785352413`), PostgreSQL rejects the query:
   `invalid input syntax for type uuid: "tf-1792785352413"`
3. The enclosing `try/catch` block catches the error and silently continues, leaving `taskMap` completely empty (`{}`).
4. Consequently, `taskMap[l.entityId]` is `undefined` for every task log.
5. `Boolean(taskMap[l.entityId])` evaluates to `false`, forcing `canUndo: false` on the entire payload.

---

## 4. Expected Response Behavior
- Audit log records for existing tasks with `is_undone = false`, non-null `previous_state`, and reversible action must return `canUndo: true`.
- Presence of any legacy or non-UUID entity ID in `audit_logs` must not invalidate `canUndo` for legitimate UUID tasks.

---

## 5. Recommended Backend Modification
In `backend/controllers/feature-persistence.controller.ts` in `getProjectAuditLogs`, sanitize `taskIds` before querying TypeORM:

```typescript
// Filter to valid UUID format to avoid PostgreSQL type cast error
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const validTaskUuids = taskIds.filter((id) => typeof id === "string" && UUID_REGEX.test(id));

const taskMap: Record<string, string> = {};
if (validTaskUuids.length > 0) {
  try {
    const foundTasks = await AppDataSource.getRepository(WorkItem).find({
      where: { id: In(validTaskUuids) },
      select: { id: true, title: true },
    });
    foundTasks.forEach((t) => {
      taskMap[t.id] = t.title;
    });
  } catch (err) {
    // Graceful error logging
  }
}
```

---

## 6. Frontend Mitigation Already Applied
1. In `AppContext.tsx`, `mappedAudit` evaluates `canUndo` using the server's authoritative persisted state (`isUndone`, `previousState`, `action`, and server `canUndo`).
2. If `isUndone` is `true`, `canUndo` is strictly `false` and "Change undone" is displayed.
3. In `createTask`, client-generated temporary IDs (`tf-*`) are prevented from being posted to `createAuditLogApi` until the authoritative server UUID is returned.
