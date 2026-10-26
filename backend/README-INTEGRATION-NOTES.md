# TaskFlow project module integration notes

These files are a security-oriented starting update based on the supplied project module. Integrate them with the existing repository rather than blindly overwriting without checking imports and current migrations.

## Invariants preserved

- A user belongs to one organization (`users.organization_id`).
- Email identifies one user globally. Keep a database unique constraint on normalized email, not just application validation.
- `UserRole` remains the organization-level role (`ADMIN`, `MANAGER`, `TEAMMATE`).
- `ProjectRole` is project-level (`ADMIN`, `LEAD`, `MEMBER`).
- Project visibility is organization-scoped: PUBLIC projects are visible to the organization; PRIVATE projects are visible to organization ADMINs and project members.
- Controllers use `AppError`; there are no controller try/catch blocks.

## Important integration checks

1. **User email uniqueness:** ensure the `users` table has a unique constraint/index on normalized email. If email is case-insensitive, normalize it consistently at signup and invitation acceptance, or use a PostgreSQL `citext` column / unique index on `lower(email)`. Before adding the constraint, clean up existing duplicate emails.
2. **One organization per user:** `users.organization_id` should reference `organizations.id` and be non-null after onboarding. If the onboarding flow creates a user before an organization, use a deliberate transaction/temporary onboarding state instead of permitting a fully active user to belong to multiple organizations.
3. **Project visibility enum:** the entity uses `enumName: "projects_visibility_enum"`. Confirm the existing migration uses the same PostgreSQL enum name. If it does not, retain the migration's name or create a migration to rename/alter the enum safely.
4. **Project member enum:** confirm the migration's enum name is `project_members_role_enum` and values are `ADMIN`, `LEAD`, `MEMBER`.
5. **Date check constraint:** the `@Check` decorator requires a migration to create `CHK_projects_date_order`. Generate/review/run a migration; do not enable TypeORM `synchronize`.
6. **Unique project key races:** the pre-check improves the response, but PostgreSQL's unique constraint remains the source of truth. Update the global error handler to translate PostgreSQL error code `23505` for `UQ_projects_organization_key` into HTTP 409. Do not add try/catch to controllers.
7. **Permission middleware:** `checkPermission(...)` must be compatible with the intended organization roles. The controller also enforces project membership policies, but middleware should not accidentally deny legitimate users or grant access based only on a broad permission.
8. **Role policy:** this implementation lets organization ADMINs manage any project. Project members with project role ADMIN or LEAD can manage that project. Only organization ADMINs can grant the project ADMIN role. Review this policy against your exact product requirements.
9. **Deletion policy:** verify foreign keys/cascades for work items, sprints, attachments and audit history before allowing permanent project deletion. Consider archival if history must be retained.
10. **Concurrency:** last-project-admin protection is checked transactionally, but strict concurrent protection may require locking the project row (or another serialization strategy) in both removal and demotion flows.
11. **Type compatibility:** the sample assumes `req.user.id`, `User.organizationId`, `User.role`, `User.fullName`, `User.email`, `User.projectMemberships`, `Organization.projects`, and the imported entity paths match your repository.
12. **Joi and Express types:** run TypeScript build/tests after integration. Depending on your Express/Joi type versions, assigning the validated `req.params` value may need a small typing adjustment.
13. **Error handling:** `asyncHandler` and the global Express error middleware must forward async rejections and serialize `AppError` consistently.
14. **Tests required:** test cross-organization IDs, private-project access, organization ADMIN overrides, duplicate emails, duplicate project keys, invalid project roles, last-admin removal/demotion, and FK failures on project deletion.

## Email and organization rule

A project member must already be a `User` in the same organization. The project member endpoint does not create a second user or move a user to another organization. Invitation acceptance must locate/create the one global user record and must reject attempts to attach an existing user to a different organization.

## SLA and escalation

The `AddSlaToWorkItems1792600000000` migration adds nullable SLA fields to existing
work items, so it is safe to apply to databases that already contain tasks. Run it
with the repository's normal TypeORM migration command:

```sh
npx typeorm-ts-node-commonjs migration:run -d config/data.source.ts
```

SLA deadlines use elapsed hours: URGENT 4, HIGH 8, MEDIUM 24, and LOW 72. The
final 20% of the elapsed window is `AT_RISK`; an unresolved item past its
deadline is `BREACHED`. `ESCALATED` is independent of workflow status and
`DONE` items are reported as `RESOLVED`.

Project leads, project administrators, and organization administrators can call
`PATCH /api/work-items/:workItemId/escalate` with an optional
`{ "reason": "..." }` body. The endpoint is organization- and project-scoped,
idempotent, and records the event in `audit_logs`.

### SLA permission matrix

SLA authorization uses the existing organization user role, project membership
role, and `requireProjectPermission` middleware. Organization `ADMIN`s are
authorized for every project in their organization. Project `ADMIN`s and
`LEAD`s have the management actions below; project `MEMBER`s have view access
only.

| Action | Organization ADMIN | Project ADMIN/LEAD | Project MEMBER |
| --- | --- | --- | --- |
| View SLA information and escalation history | Allowed | Allowed | Allowed |
| Escalate a task | Allowed | Allowed | Forbidden |
| Configure or modify SLA deadlines | Allowed | Allowed | Forbidden |
| Resolve/reset an escalation | Allowed | Allowed | Forbidden |
| View SLA audit events | Allowed | Allowed | Forbidden |

The existing project permission table previously granted `task:escalate` to
project members. That conflicted with the SLA requirement for team members, so
the SLA endpoint now uses the narrower `sla:manage` action and members retain
ordinary task permissions without escalation authority. Organization `MANAGER`
users continue to be governed by their project membership role; there is no
separate SLA RBAC system.

SLA endpoints are:

- `GET /api/work-items/:workItemId/sla`
- `GET /api/work-items/:workItemId/sla/audit`
- `PATCH /api/work-items/:workItemId` with `slaDeadline` (or `null` to restore the policy deadline)
- `POST /api/work-items/:workItemId/escalate`
- `POST /api/work-items/:workItemId/escalate/resolve`

Every endpoint verifies the authenticated user's organization, project access,
and the relevant project action on the backend.

The server starts a single in-process SLA refresh interval. Its default interval
is 60 seconds and can be changed with `SLA_CHECK_INTERVAL_MS` (minimum 10
seconds). For multi-instance deployments, run the refresh job in one designated
instance or replace it with the deployment's existing scheduler.

## Real-time chat

Chat tables are added by `1792400000000-AddChatTables`. Apply migrations from
the `backend` directory with:

```sh
pnpm exec typeorm-ts-node-commonjs migration:run -d config/data.source.ts
```

Authenticated REST endpoints are mounted below `/api/conversations` for
creating and listing conversations, reading a conversation, managing members,
and retrieving paginated messages. The WebSocket endpoint is
`/ws/chat`; it accepts the existing `token` HTTP-only cookie or an
`Authorization: Bearer` header during the handshake. Browsers must use an
origin listed in `CORS_ORIGINS`.

The WebSocket protocol supports `conversation:join`,
`conversation:leave`, and `message:send` client events. Messages are persisted
before `message:new` is broadcast to sockets that joined the same authorized
conversation. Connections are limited to 64 KiB frames and 30 events per
10-second window.
