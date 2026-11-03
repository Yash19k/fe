# TASKFLOQ Organization and Project Member-Removal RBAC Audit

**Audit type:** Read-only static code audit  
**Scope:** Frontend and backend organization/project membership removal paths  
**Execution note:** No source files were changed. The pass/fail results below are based on inspected code paths; live HTTP/database integration tests were not run.

## 1. Executive summary

Organization member removal is authorized by the backend: only an organization `ADMIN` can remove a member, the target is looked up within the actor's organization, self-removal is rejected, and removal of the last active organization administrator is rejected. An administrator can remove another administrator if the last-admin check remains satisfied. The intended organization-creator protection is ineffective: the controller refers to a creator field that is not present in the organization entity/schema.

Project membership roles are `ADMIN`, `LEAD`, and `MEMBER` (not the organization roles). A project `ADMIN` can remove project members; `LEAD` and `MEMBER` cannot. An organization `ADMIN` is granted project-management permission independently of project membership/role. The backend scopes project and target-member lookups and protects the last project administrator. However, the project creator can be removed through the API if another project administrator remains; the creator check exists only in the frontend and its owner mapping may not identify the creator correctly. The project endpoint also does not apply its self-removal check to an organization `ADMIN`.

The main role authorization boundaries are enforced server-side, so hiding/removing frontend controls is not the security boundary. Current production readiness is **not ready for owner-protection requirements** until creator protection is persisted/enforced for organizations and enforced on the project endpoint. Frontend project-role decisions also need to reflect the effective project permission rules.

## 2. Existing role model and enforcement

### Organization roles

The organization roles relevant to member management are `ADMIN`, `MANAGER`, and `TEAMMATE`. The removal endpoint checks the acting user's current organization role and permits only `ADMIN`; there is no manager/team-member removal permission.

Backend authorization reloads the current user/organization role (`backend/middleware/is.loggedin.ts`, lines 84–104). Organization removal is implemented in `backend/controllers/organization.controller.ts`, function `removeOrganizationMember` (lines 354 onward), and exposed through the authenticated route in `backend/routes/organization.routes.ts` (line 27).

### Project roles

The actual project membership enum is `ADMIN`, `LEAD`, and `MEMBER` (`backend/entities/project.member.entity.ts`, lines 13–17). The frontend maps its Manager/Teammate labels to `LEAD`/`MEMBER` (`frontend/src/services/api.ts`, lines 1230–1237). Project-member permissions are defined in `backend/middleware/project.permission.ts` (including lines 40–45, 63–84, and 346).

For non-organization-admins, only project `ADMIN` receives `member:remove`. `LEAD` and `MEMBER` do not. An organization `ADMIN` receives project-management permission for projects in their organization independently of their project membership or project role.

## 3. Organization-level removal matrix

The matrix describes backend behavior for an existing target in the same organization. `ALLOWED` is conditional on the target not being the actor and on the last-active-admin check passing. The creator restriction is **NOT ENFORCED** in practice because the referenced organization creator field is absent.

| Acting organization role | Remove ADMIN | Remove MANAGER | Remove TEAMMATE |
|---|---|---|---|
| ADMIN | ALLOWED* | ALLOWED* | ALLOWED* |
| MANAGER | DENIED | DENIED | DENIED |
| TEAMMATE | DENIED | DENIED | DENIED |

`*` An administrator cannot remove themselves or the last active organization administrator. The server-side creator check does not reliably protect the organization creator.

**Answers to the requested cases:**

- An `ADMIN` can remove another `ADMIN` only if the target is not the actor and another active administrator remains.
- An `ADMIN` can remove a `MANAGER` or `TEAMMATE`, subject to same-organization target lookup.
- A `MANAGER` or `TEAMMATE` cannot remove any organization role through this endpoint.
- Self-removal: explicitly denied.
- Last organization administrator: explicitly protected.
- Organization creator: intended protection is ineffective; removal can occur if the other checks pass.
- Client-supplied role values do not grant removal authority; the backend checks the authenticated user's current role.

## 4. Project-level removal matrix

The matrix uses actual project roles. It describes an actor who is **not** an organization `ADMIN`; organization-admin override behavior is shown separately. The backend permits a project `ADMIN` to remove members of any project role, subject to self/last-project-admin checks. Project-owner protection is not enforced by the endpoint.

| Acting project role (non-organization-admin) | Remove project ADMIN | Remove project LEAD | Remove project MEMBER |
|---|---|---|---|
| ADMIN | ALLOWED* | ALLOWED* | ALLOWED* |
| LEAD | DENIED | DENIED | DENIED |
| MEMBER | DENIED | DENIED | DENIED |

`*` A non-organization-admin project `ADMIN` cannot remove themselves; removing the sole project `ADMIN` is denied. A project creator/owner is not protected by the server endpoint.

| Effective actor authority | Remove project ADMIN | Remove project LEAD | Remove project MEMBER |
|---|---|---|---|
| Organization ADMIN (any project role, including non-member) | ALLOWED**, except last project ADMIN | ALLOWED | ALLOWED |

`**` The project controller's self-removal guard is conditional on the actor not being an organization administrator. Thus an organization `ADMIN` can remove their own project membership if the last-project-admin check does not block it.

**Requested organization-role/project-role combinations:**

- Organization `ADMIN`: can remove project members across project roles within the authorized organization scope, whether or not they hold a project membership. The sole project `ADMIN` remains protected.
- Organization `MANAGER`: can remove project members only when their effective project role is `ADMIN`; as `LEAD`/`MEMBER` or a non-member, the request is denied.
- Organization `TEAMMATE`: same project-level rule as a manager: removal is available only if their project role is `ADMIN`; organization `TEAMMATE` alone grants no project removal permission.
- A non-project-member who is not an organization `ADMIN` is denied. An organization `ADMIN` is an explicit exception.

## 5. Frontend audit findings

### Organization membership

- `frontend/src/features/settings/SettingsView.tsx` (line 59) renders the organization removal action only for organization administrators and hides removal of the current user.
- The UI gate is consistent with the backend's organization-role requirement and self-removal rule. The backend independently enforces both.
- The UI does not provide effective protection for an organization creator because the backend's creator check is ineffective; UI visibility is not an authorization control.

### Project membership

- `frontend/src/features/project/ProjectMembersView.tsx` (lines 82, 161, 247–257) bases removal controls on the global organization role and applies a client-side owner condition.
- `frontend/src/state/AppContext.tsx` (lines 2483, 2491, 2518) similarly gates the project removal action using the global role and client-side owner state before issuing the API request.
- This does not model the backend's effective permission rule consistently: a non-admin organization `MANAGER`/`TEAMMATE` who is a project `ADMIN` may be blocked by the UI, while a non-admin organization `MANAGER` can be shown a control that the API rejects when they are not a project `ADMIN`.
- The owner mapping in `frontend/src/services/api.ts` (line 1427) uses `proj.ownerId || memberIds[0]`, while the backend project entity stores `createdById`. Consequently, the client-side project-owner gate may fail to identify the actual creator.
- Frontend protection does not prevent direct API requests. The backend currently fails to enforce project-owner protection.

### API integration and request payload

- The project removal request is integrated with `DELETE /api/projects/:projectId/members/:memberId` (`backend/routes/project.routes.ts`, lines 98–104).
- The project deletion target is taken from the path and the controller selects membership using both project and user IDs; adding a forged role or member ID to a DELETE body does not change the selected target or grant authority.

## 6. Backend audit findings

### Organization endpoint

- Authentication is required by the organization route (`backend/routes/organization.routes.ts`, line 27).
- `removeOrganizationMember` explicitly requires the actor's organization role to be `ADMIN` (`backend/controllers/organization.controller.ts`, lines 360–361).
- It rejects self-removal (line 367), scopes the target lookup by the actor's organization (lines 369–375), and checks active administrator count before removal (lines 378–391).
- The owner check around line 402 refers to `createdByUserId`, but `backend/entities/organization.entity.ts` (lines 15–29) and the initial schema migration (`backend/migrations/1791869433890-InitialSchema.ts`, line 27) do not define/persist that field. Organization creation also does not persist the creator. Thus the intended restriction is not effective.
- On successful removal, the controller also deletes the target's project memberships and sessions and clears/changes their organization association and role (`backend/controllers/organization.controller.ts`, lines 406–433).

### Project endpoint

- `DELETE /api/projects/:projectId/members/:memberId` requires `member:remove` (`backend/routes/project.routes.ts`, lines 98–104). The permission middleware grants organization administrators project-management authority (`backend/middleware/project.permission.ts`, line 346) and grants `member:remove` to project `ADMIN`, not `LEAD`/`MEMBER` (lines 40–45, 63–84).
- Project/controller authorization reloads the actor and checks the project/organization context (`backend/controllers/project.controller.ts`, lines 17–55).
- The project and target membership lookups are scoped to the authorized organization, project, and member IDs (`backend/controllers/project.controller.ts`, lines 423–441). Project IDs are UUID-v4 validated (`backend/validations/project.validations.ts`, lines 7, 13–16).
- The controller rejects self-removal only for actors who are not organization administrators (`backend/controllers/project.controller.ts`, lines 425–430). An organization-admin override can therefore remove that administrator's own project membership unless the last-project-admin guard blocks it.
- The controller protects the last project administrator through `ensureNotLastProjectAdmin` (`backend/controllers/project.controller.ts`, lines 65–82 and 446).
- The endpoint does not compare the target with the project's persisted `createdById` (`backend/entities/project.entity.ts`, line 58). A project creator can therefore be removed through the API if other checks permit it, even though the UI has a client-side owner restriction.

### Cross-scope and payload protections

- Organization target lookup is scoped to the acting user's organization; cross-organization target IDs do not resolve to removable targets.
- Project access and membership lookups are scoped by organization/project and by project/member pair; a target from a different project cannot be removed through the requested project's membership route.
- Project parameter validation rejects malformed identifiers. The deletion target and authority are not taken from a caller-supplied role field or DELETE body.
- The role checks are performed in middleware/controllers and therefore apply to direct API callers; the frontend is not the only authorization boundary.

## 7. Security issues and severity

Severity mapping uses the requested categories: P0 critical, P1 high-priority authorization vulnerability, P2 medium permission inconsistency, P3 low frontend/maintainability issue. The two creator-removal issues were assessed as medium in the security review and are classified P2 here.

| Issue ID | Severity | Scope | File and function | Current behavior | Expected behavior and impact | Recommended fix |
|---|---|---|---|---|---|---|
| ORG-RBAC-01 | P2 | Organization | `backend/controllers/organization.controller.ts` — `removeOrganizationMember` (around lines 354, 402) | Intended creator check uses a creator field absent from the organization entity/schema. Another organization `ADMIN` can remove the creator if other checks pass; related memberships/sessions are then cleaned up and organization access is cleared. | If organization ownership/creator protection is a business rule, the persisted creator must not be removable through this endpoint. Current behavior can revoke the creator's access and ownership-related continuity. | Persist creator/owner identity in the organization entity and a migration, set it at organization creation, and enforce it on the server. |
| PROJ-RBAC-01 | P2 | Project | `backend/controllers/project.controller.ts` — `removeProjectMember` (around lines 417, 423–447) | Project creator (`createdById`) is not checked by the endpoint; another authorized actor can remove them if last-admin/self checks permit. | If project ownership is protected, API calls must not remove the owner absent an explicit ownership transfer. Private-project access may be revoked. | Enforce the persisted creator/owner restriction in the removal controller, with an explicit transfer policy if ownership is transferable. |
| PROJ-RBAC-02 | P2 | Project/frontend consistency | `frontend/src/features/project/ProjectMembersView.tsx`, `frontend/src/state/AppContext.tsx`, `frontend/src/services/api.ts` | UI uses organization role rather than effective project permission; owner mapping may not reflect backend `createdById`. Controls can be hidden for allowed project admins or shown to actors rejected by the API; owner gating is not reliable. | UI should reflect the effective permission and accurate owner identity. This is an inconsistent UX, not a bypass of backend role checks. | Derive controls from the effective project permission and map the backend's actual creator/owner field; retain all server-side checks. |
| PROJ-RBAC-03 | P2 | Project | `backend/controllers/project.controller.ts` — `removeProjectMember` (around lines 425–430) | Organization `ADMIN` actors bypass the self-removal guard. If more than one project administrator exists, an organization administrator may remove their own project membership. | Apply a consistent self-removal policy regardless of organization-admin override, unless this exception is an explicit business rule. | Make the self-removal rule explicit and enforce it consistently before the organization-admin permission override, or document/test the intended exception. |

## 8. Required authorization test cases

The results in this section are static code-path assessments, not executed integration tests. “Pass” means the current code enforces the stated expected result for the specified conditions. Owner tests reflect the creator-protection behavior indicated by the code/UI; the audit does not invent an ownership-transfer policy.

### Organization role combinations

| Acting role | Target role | Expected result under current removal policy | Current implementation |
|---|---|---|---|
| ADMIN | ADMIN | Allow another admin only when not self and not the last active admin | PASS, conditional |
| ADMIN | MANAGER | Allow | PASS |
| ADMIN | TEAMMATE | Allow | PASS |
| MANAGER | ADMIN | Deny | PASS |
| MANAGER | MANAGER | Deny | PASS |
| MANAGER | TEAMMATE | Deny | PASS |
| TEAMMATE | ADMIN | Deny | PASS |
| TEAMMATE | MANAGER | Deny | PASS |
| TEAMMATE | TEAMMATE | Deny | PASS |

### Project role combinations

For these cases, the acting user is not an organization `ADMIN`. `ADMIN`/`LEAD`/`MEMBER` are project roles.

| Acting project role | Target project role | Expected result under current permission policy | Current implementation |
|---|---|---|---|
| ADMIN | ADMIN | Allow unless target is actor or last project administrator | PASS, conditional |
| ADMIN | LEAD | Allow unless target is actor | PASS, conditional |
| ADMIN | MEMBER | Allow unless target is actor | PASS, conditional |
| LEAD | ADMIN | Deny | PASS |
| LEAD | LEAD | Deny | PASS |
| LEAD | MEMBER | Deny | PASS |
| MEMBER | ADMIN | Deny | PASS |
| MEMBER | LEAD | Deny | PASS |
| MEMBER | MEMBER | Deny | PASS |

An organization `ADMIN` has a separate override: can remove any project role, including while not a project member, except that the sole project administrator cannot be removed. The implementation does not consistently prevent this actor from removing themselves from a project.

### Additional authorization and edge-case tests

| Test | Expected secure result | Current implementation |
|---|---|---|
| Organization ADMIN removes self | Denied | PASS — explicit self check |
| Organization ADMIN removes only active organization ADMIN | Denied | PASS — active-admin count check |
| Organization ADMIN removes creator while another active admin remains | Denied if creator protection is intended | FAIL — creator field is not persisted/available to the check |
| Organization MANAGER/TEAMMATE directly calls organization DELETE | Denied | PASS — controller requires organization ADMIN |
| Cross-organization organization-member target ID | Denied/not found; no removal | PASS — target lookup is organization-scoped |
| Non-organization-admin project ADMIN removes self | Denied | PASS — explicit self check |
| Organization ADMIN removes self from a project with another project ADMIN | Denied under consistent self-removal policy | FAIL — organization-admin override bypasses self check |
| Authorized actor removes the only project ADMIN | Denied | PASS — last-project-admin guard |
| Authorized project ADMIN removes project creator while another project ADMIN remains | Denied if creator protection is intended | FAIL — server endpoint does not check `createdById` |
| Non-project-member who is not organization ADMIN removes a project member | Denied | PASS — no project `member:remove` permission |
| Organization ADMIN who is not a project member removes a project member in their authorized organization | Allowed by the current organization-admin override | PASS |
| Project ID belongs to another organization | Denied/not found; no removal | PASS — project lookup/access is organization-scoped |
| Member ID belongs to a different project | Denied/not found; no removal | PASS — membership lookup uses project and member IDs |
| Caller adds forged `role` or `memberId` in DELETE body | Must not grant authority or change target | PASS — target is selected from the path; body does not authorize removal |
| Caller manipulates project/member identifiers | No cross-scope removal | PASS on inspected path — UUID validation and scoped lookups |
| Direct API call bypasses frontend | Must still be authorized by backend | PASS for role/scope checks; owner restriction remains a backend gap |

Existing backend permission tests assert that only project `ADMIN` has the project `member:remove` permission (`backend/tests/api-contracts-and-permissions.test.ts`, lines 69–72). They do not cover the removal controllers, owner restrictions, self-removal override, or cross-scope requests.

## 9. Recommended permission hierarchy

This is a recommendation for implementation/test clarity, not a claim that the current business rules already establish ownership policy:

1. Keep organization removal permission restricted to organization `ADMIN`; retain same-organization target scoping, self-removal protection, and last-active-admin protection.
2. Keep project removal permission for project `ADMIN` and the existing organization-admin override only if that override is intended. Do not grant removal to project `LEAD` or `MEMBER` by implication.
3. Decide and document whether organization administrators may act on projects without project membership and whether they may remove their own project membership. Enforce the chosen behavior consistently in backend code and UI.
4. If creators/owners are protected, persist organization creator identity and enforce both organization and project owner restrictions on the server. If ownership transfer is allowed, require a completed transfer before removal.
5. Treat frontend controls as usability only; retain independent backend authorization and scope validation for every endpoint.

## 10. Exact files requiring changes

No changes were made as part of this audit. If addressing the findings:

- Organization creator protection: `backend/entities/organization.entity.ts`, `backend/controllers/organization.controller.ts`, organization-creation implementation, and a new schema migration under `backend/migrations/`.
- Project creator protection and consistent self-removal: `backend/controllers/project.controller.ts`.
- Project permission/UI consistency and owner mapping: `frontend/src/features/project/ProjectMembersView.tsx`, `frontend/src/state/AppContext.tsx`, and `frontend/src/services/api.ts`.
- Regression coverage: `backend/tests/api-contracts-and-permissions.test.ts` and/or focused controller/API integration tests for removal, ownership, self-removal, last-admin, and cross-scope cases.

## 11. Production-readiness assessment

**Assessment: Partially enforced; not production-ready where creator protection is required.** Backend role and membership-scope checks protect the normal organization/project removal paths, including organization-role denial, project-role denial, self/last-organization-admin checks, last-project-admin checks, and cross-scope target lookup. The organization creator check cannot be trusted because the identity it reads is not persisted. The project creator is not protected by the backend, and an organization administrator can bypass the project self-removal guard. Project UI decisions also do not consistently reflect the backend's effective project permissions. These gaps should be resolved and covered by API-level tests before claiming complete owner and self-removal protection.
