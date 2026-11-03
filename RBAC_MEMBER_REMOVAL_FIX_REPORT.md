# RBAC Member Removal Fix Report

## Issues fixed

- **ORG-RBAC-01:** Persisted the organization creator ID, populated it during both organization-registration flows, and reject creator removal.
- **PROJ-RBAC-01:** Reject removal of the project creator in the backend for both project and organization administrators.
- **PROJ-RBAC-03:** Reject project self-removal for every actor, including organization administrators.
- **PROJ-RBAC-02:** Use effective project/organization removal permissions in the app state and both project-member views; hide self and creator actions and map project ownership from `createdById`.

## Files modified

- `backend/controllers/organization.controller.ts`
- `backend/controllers/project.controller.ts`
- `backend/controllers/user.controller.ts`
- `backend/entities/organization.entity.ts`
- `backend/migrations/1793600000000-AddOrganizationCreator.ts`
- `backend/tests/member-removal-rbac.test.ts`
- `frontend/src/features/project/ProjectMembersView.tsx`
- `frontend/src/features/project/ProjectSettingsView.tsx` — applies the same guard to the duplicate member-removal control.
- `frontend/src/services/api.ts`
- `frontend/src/state/AppContext.tsx`
- `frontend/tests/projects.test.ts`
- `RBAC_MEMBER_REMOVAL_FIX_REPORT.md`

## Migration

Adds nullable `organizations.created_by_user_id`, an index, and a restrictive foreign key to `users.id`. Existing organizations are backfilled from their earliest associated user; the down migration removes the constraint, index, and column. No previously executed migration was modified.

## Verification

- `backend/tests/member-removal-rbac.test.ts` and `backend/tests/api-contracts-and-permissions.test.ts`: **16 passed**.
- `frontend/tests/projects.test.ts`: **16 passed**.
- Backend `pnpm run typecheck`: **passed**.
- Frontend `pnpm run typecheck`: **passed**.
- Frontend `pnpm run build`: **passed**.
- Migration up/down SQL shape regression: **passed**.
- `git diff --check`: **passed**.

## Preserved behavior and limitations

Organization removal remains ADMIN-only, with self-removal and last-active-ADMIN protection. Project ADMIN removal authority, organization ADMIN project override, last-project-ADMIN protection, and membership scoping remain intact. Existing cleanup and response flows were not changed.

The migration was validated by type-checking and its SQL regression test, but was not applied to a live database. Organizations with no associated users remain without a creator ID. If an organization creator had already been detached before this migration, their historical ownership cannot be reliably recovered from the current schema.
