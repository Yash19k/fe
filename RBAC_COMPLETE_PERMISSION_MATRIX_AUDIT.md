# TASKFLOQ RBAC Complete Permission Matrix Audit

## Scope and method

This is a read-only audit of the implementation present in the working tree. It follows authentication, route middleware, controller/service checks, and frontend permission gating. A permission is described as **ALLOWED**, **DENIED**, **CONDITIONAL**, **NOT IMPLEMENTED**, or **UNPROTECTED** as defined in the request. A route that checks authentication or organization scope is not described as role-protected unless a role check exists.

Primary evidence:

- Authentication: `backend/middleware/is.loggedin.ts` (`isLoggedIn`) verifies the access token, reloads the active user and current role/organization from the database, and sets `req.user`.
- Organization-level permission definitions: `backend/middleware/check.permissions.ts` (`ROLE_PERMISSIONS`, `checkPermission`). This role table is applied only to project creation and project-list reads in the inspected routes.
- Project-level permission definitions and enforcement: `backend/entities/project.member.entity.ts` (`ProjectRole`), `backend/middleware/project.permission.ts` (`permissions`, `authorizeWorkItemCreationForActor`, `authorizeProjectPermission`, `requireProjectPermission`).
- Organization member actions: `backend/controllers/organization.controller.ts`; routes in `backend/routes/organization.routes.ts` and `backend/routes/user.routes.ts`.
- Project operations: `backend/controllers/project.controller.ts`; routes in `backend/routes/project.routes.ts`.
- Work item operations and resource membership: `backend/controllers/task.controller.ts`, `backend/controllers/work-item-collaboration.controller.ts`, `backend/services/work-item.service.ts`, `backend/routes/work.item.routes.ts`.
- Project-level settings/audit/sprints/resources: `backend/controllers/project-settings.controller.ts`, `backend/controllers/auditlog.controller.ts`, `backend/controllers/sprint.controller.ts`; corresponding `backend/routes/project.routes.ts`, `backend/routes/sprint.routes.ts`, and `backend/routes/whiteboard.routes.ts`.
- Frontend policy and gating: `frontend/src/domain/permissions.ts`, `frontend/src/state/AppContext.tsx`, `frontend/src/features/settings/SettingsView.tsx`, `frontend/src/features/project/ProjectSettingsView.tsx`, `frontend/src/features/project/ProjectMembersView.tsx`, `frontend/src/services/api.ts`.

## Model and enforcement overview

1. **Organization role** is `ADMIN`, `MANAGER`, or `TEAMMATE` (`backend/entities/user.entity.ts`, `UserRole`).
2. **Project role** is `ADMIN`, `LEAD`, or `MEMBER` (`backend/entities/project.member.entity.ts`, `ProjectRole`). A project creator is automatically inserted as project `ADMIN`.
3. `isLoggedIn` authenticates and reloads the current organization role; it does not itself authorize a resource action.
4. `checkPermission` uses organization roles, but its route usage is narrow: `project:create` and `project:read` on the project collection. Most project APIs use `requireProjectPermission`, which locates the project in the caller's organization and evaluates project membership/role.
5. In `authorizeProjectPermission`, an organization `ADMIN` bypasses project membership and the project-role table for project actions **except `task:create`**. That action is specially routed through `authorizeWorkItemCreationForActor`, which requires project membership and a role with `task:create`, even for an organization `ADMIN`.
6. Non-organization-admins need project membership for protected project operations. The exception is read-only access to `PUBLIC` projects for `project:view` and `task:read`. `PUBLIC` is organization-scoped: project lookup still requires the caller's organization.
7. Controller/service checks may further restrict an allowed route (e.g. member-removal safeguards, same-organization targets, active project-member assignees). Such checks are included below.

### Effective role permissions in code

`backend/middleware/check.permissions.ts` defines the organization-level global permission set, but most listed permissions are not attached to routes:

| Organization role | Global permissions defined in `check.permissions.ts` | Routes actually using this map |
|---|---|---|
| ADMIN | `user:manage`, `role:manage`, project create/read-all/read/update/delete/member-manage, task create/read/update/delete/assign/comment | Project creation; project collection read. Org actions instead use controller checks. |
| MANAGER | Project create/read/update/member-manage; task create/read/update/delete/assign/comment | Project creation; project collection read. These global entries do **not** make a manager a project member or project manager. |
| TEAMMATE | Project read; task read/update/comment | Project collection read. Other project actions use project role checks. |

`backend/middleware/project.permission.ts` is the effective project-role map:

| Project action | Project ADMIN | Project LEAD | Project MEMBER |
|---|---:|---:|---:|
| View project, read tasks, view SLA, view sprints | ALLOWED | ALLOWED | ALLOWED |
| Update project, add members, update member roles | ALLOWED | ALLOWED | DENIED |
| Delete project, remove members | ALLOWED | DENIED | DENIED |
| Create, update, assign, escalate, delete tasks | ALLOWED | ALLOWED | Create/update/assign ALLOWED; escalate/delete DENIED |
| Manage/resolve/audit SLA | ALLOWED | ALLOWED | DENIED |
| Create/update/delete sprints | ALLOWED | ALLOWED | DENIED |

Organization `ADMIN` bypasses this project-role table for project actions with the `task:create` exception above. The effective project-role assignment check additionally prevents a non-project-ADMIN from granting project role `ADMIN`; an organization `ADMIN` is exempt.

## Matrix 1: Organization-Level Permissions

| Action | ADMIN | MANAGER | TEAMMATE | Actual implementation / restrictions |
|---|---|---|---|---|
| View own organization details | CONDITIONAL | CONDITIONAL | CONDITIONAL | `GET /api/users/me` (`currentUser`, `backend/controllers/user.controller.ts`) returns the caller's organization details for an authenticated active user with an organization. Registration/login also return organization details for the newly authenticated account. |
| View organization members | CONDITIONAL | CONDITIONAL | CONDITIONAL | `GET /api/organizations/members` and `/api/organization/members` require authentication and use `req.user.organizationId`; no organization-role check. `GET /api/users/` likewise returns active users for the caller's organization. |
| Update organization name/details | NOT IMPLEMENTED | NOT IMPLEMENTED | NOT IMPLEMENTED | No organization update route/controller was found. Registration creates an organization; `/me` reads it. |
| Manage organization settings (SLA policy) | ALLOWED | ALLOWED | DENIED | `GET /api/sla` and `/api/organization/sla` require authentication and organization context; `PUT`/`PATCH` additionally require role `ADMIN` or `MANAGER` in `updateOrganizationSla` (`backend/controllers/sla.controller.ts`). |
| Invite/add members via `/members` | CONDITIONAL | DENIED | DENIED | `addOrganizationMembers` (`backend/controllers/organization.controller.ts`) requires organization `ADMIN`, then rejects `ADMIN` as an invite role; this route accepts `MANAGER` or `TEAMMATE`. |
| Invite members via `/members/invite` or `/users/invite` | CONDITIONAL | DENIED | DENIED | `inviteMembersController` (`backend/controllers/member-invitation.controller.ts`) requires organization `ADMIN`; its schema/service permit invitation roles `ADMIN`, `MANAGER`, and `TEAMMATE`. The invitation is a pending organization user until accepted. |
| Assign/change an existing member's organization role | ALLOWED | DENIED | DENIED | `updateOrganizationMemberRole` requires organization `ADMIN`, checks target belongs to same organization, and validates enum role. Demoting the last active `ADMIN` is blocked. No separate owner restriction or self-role-change prohibition exists. |
| Remove organization member | CONDITIONAL | DENIED | DENIED | `removeOrganizationMember` requires organization `ADMIN`; detailed target/self/owner/last-admin rules are in Matrix 2. |
| Access organization-scoped data | CONDITIONAL | CONDITIONAL | CONDITIONAL | APIs typically scope queries by `req.user.organizationId`; role differences depend on the specific route. Organization membership is required by auth context, not a universal role permission. |
| Register a new organization / first administrator | ALLOWED | ALLOWED | ALLOWED | Public onboarding routes (`POST /api/organizations`, `/api/organization`, `/api/users`, `/api/users/register`) create an organization and first active `ADMIN`. They do not operate on a caller's existing organization. |
| Accept an organization invitation | ALLOWED | ALLOWED | ALLOWED | Public token-based accept routes (`POST /api/organizations/accept`, `/api/organization/accept`, `/api/users/accept-invitation`) validate invitation token, expiry/status and set the invited role; authentication is not required for acceptance. |

### Matrix 2: Organization Member Removal Matrix

| Acting role | Can remove ADMIN | Can remove MANAGER | Can remove TEAMMATE | Can remove self | Actual restrictions |
|---|---|---|---|---|---|
| ADMIN | CONDITIONAL | ALLOWED | ALLOWED | DENIED | Target must be in same organization. Cannot remove self, the organization creator, or the last active organization `ADMIN`. Another `ADMIN` can be removed if not the creator and more than one active admin remains. |
| MANAGER | DENIED | DENIED | DENIED | DENIED | Controller returns forbidden unless actor role is organization `ADMIN`. |
| TEAMMATE | DENIED | DENIED | DENIED | DENIED | Controller returns forbidden unless actor role is organization `ADMIN`. |

Evidence: `DELETE /api/organizations/members/:userId` and alias `/api/organization/members/:userId` in `backend/routes/organization.routes.ts`; `removeOrganizationMember` in `backend/controllers/organization.controller.ts` checks actor role, self-ID, same-organization target, active-admin count, and `Organization.createdByUserId`. Removal deletes the target's project memberships in that organization, revokes sessions, detaches the user from the organization, and resets their role to `TEAMMATE`; it does not delete the global user account.

## Matrix 3: Project-Level Permissions

The columns are the actual database project roles `ADMIN`, `LEAD`, and `MEMBER`. Organization-admin override and membership/visibility conditions are noted separately; they are not project roles.

| Action | Project ADMIN | Project LEAD | Project MEMBER | Actual implementation / restrictions |
|---|---|---|---|---|
| Create project | CONDITIONAL | CONDITIONAL | CONDITIONAL | Not determined by project role: organization `ADMIN` or `MANAGER` can create; `TEAMMATE` is denied by `checkPermission("project:create")`. Creator is inserted as project `ADMIN`. |
| View/list projects | ALLOWED | ALLOWED | ALLOWED | Authenticated organization members can call collection read. Returned rows are filtered to organization and `PUBLIC`, project membership, or organization-admin status. Individual project reads also allow same-organization `PUBLIC` projects without membership. |
| Update project details/settings | ALLOWED | ALLOWED | DENIED | `project:update` in project middleware; same-organization project lookup. Project settings controllers independently allow organization `ADMIN`, project `ADMIN`/`LEAD`, or `PUBLIC` read-only access. |
| Delete project | ALLOWED | DENIED | DENIED | Requires `project:delete`. Organization `ADMIN` override applies. |
| View project members | ALLOWED | ALLOWED | ALLOWED | Requires `project:view`; public non-members may pass the route read gate. Controller restricts project lookup to same organization. |
| Add project members | ALLOWED | ALLOWED | DENIED | Requires `member:add`; controller only accepts an existing user in the same organization and rejects duplicate membership. Assigning project `ADMIN` is further restricted to an organization `ADMIN` or project `ADMIN`. |
| Change project member role | ALLOWED | CONDITIONAL | DENIED | Requires `member:role:update`. A `LEAD` may update roles except it cannot grant `ADMIN`; organization `ADMIN` or project `ADMIN` can grant `ADMIN`. Demoting the last project `ADMIN` is blocked. No self-role-change or project-creator-role-change restriction is implemented. |
| Remove project member | ALLOWED | DENIED | DENIED | Requires `member:remove`, which is only on project `ADMIN`; organization `ADMIN` bypasses. Controller also prevents self-removal, removal of project creator, and removal of the last project `ADMIN`. |
| Create work item | ALLOWED | ALLOWED | ALLOWED | Project member required even for organization `ADMIN`; role must have `task:create`. Selected assignees must be active same-organization users and already project members (`validateAssignees`, `backend/services/work-item.service.ts`). |
| View/read work items | ALLOWED | ALLOWED | ALLOWED | Requires `task:read`; same-organization public projects also allow non-member reads. Work-item service rechecks project access. |
| Update work item | ALLOWED | ALLOWED | ALLOWED | Requires `task:update`; route and service enforce project/org access. No per-work-item creator/assignee ownership restriction was found. |
| Assign/reassign work items | ALLOWED | ALLOWED | ALLOWED | `task:assign` is present in project role table, but assignment is carried through work-item create/update routes gated by `task:create`/`task:update`; all three project roles receive those actions. Assignees must be active same-org project members. |
| Delete work item | ALLOWED | ALLOWED | DENIED | Requires `task:delete`. |
| Upload work-item attachments | ALLOWED | ALLOWED | ALLOWED | `POST /api/work-items/:workItemId/attachments` requires `task:update`; no separate attachment role. Read/listing depends on task read endpoints. |
| Add/view comments and time entries | Add: ALLOWED; view: ALLOWED | Add: ALLOWED; view: ALLOWED | Add: ALLOWED; view: CONDITIONAL | Add uses `task:update`, so project members in all three roles can add. Read routes use `task:read`, but controller `assertWorkItemAccess` requires project membership unless actor is organization `ADMIN`; consequently public non-members are denied by the controller despite passing the route read gate. |
| Create/view/delete work-item dependencies | Create/delete: ALLOWED; view: ALLOWED | Create/delete: ALLOWED; view: ALLOWED | Create/delete: ALLOWED; view: ALLOWED | Routes use `task:update` for mutations and `task:read` for reads. Service checks organization/project access; public task-read rules apply where the service permits them. |
| Create/update/delete sprints | ALLOWED | ALLOWED | DENIED | `sprint:create`, `sprint:update`, `sprint:delete`; route middleware requires project membership or organization-admin override. Sprint controller also treats the project creator/org admin as authorized. |
| View sprints | ALLOWED | ALLOWED | ALLOWED | Requires `sprint:view` and membership or organization-admin override. Unlike `project:view`/`task:read`, generic middleware does not grant this action to public non-members. |
| Manage labels and workflow | ALLOWED | ALLOWED | DENIED | Reads require `project:view`; writes require `project:update`. `assertProjectSettingsAccess` also allows organization `ADMIN`; read-only public access is supported. |
| Create/update whiteboards | ALLOWED | ALLOWED | DENIED | Requires `project:update`; organization `ADMIN` override applies. |
| Delete whiteboards | ALLOWED | DENIED | DENIED | Requires `project:delete`; organization `ADMIN` override applies. |
| View project audit logs | ALLOWED | ALLOWED | ALLOWED | Requires `project:view`; `assertAuditProjectAccess` enforces organization scope and membership or `PUBLIC` visibility (organization `ADMIN` has override). |
| Undo audit actions | ALLOWED | ALLOWED | DENIED | Routes require `project:update`; `executeAuditUndo` independently requires organization `ADMIN` or project `ADMIN`/`LEAD`, same-org project/log/work-item match, trusted reversible audit entry, and valid current state. |
| Create audit log via API | DENIED | DENIED | DENIED | Routes have permission middleware, but `createAuditLog` always throws `403` (“Audit entries must be created by server-side operations”). Server-side mutation code records audit entries; direct API creation is not implemented. |

Evidence for the project role map and membership exception: `backend/middleware/project.permission.ts` (`permissions`, `authorizeProjectPermission`, `authorizeWorkItemCreationForActor`). Route mappings are in `backend/routes/project.routes.ts`, `backend/routes/work.item.routes.ts`, `backend/routes/sprint.routes.ts`, and `backend/routes/whiteboard.routes.ts`. Project creation membership is created in `createProject` (`backend/controllers/project.controller.ts`).

### Matrix 4: Project Member Removal Matrix

`Target Organization Role` does not independently control removal. A target must be an existing member of the same-organization project. The controller's project-creator and last-project-admin checks apply regardless of the target's organization role.

| Acting organization role | Acting project role | Target organization role | Target project role | Allowed/Denied | Actual reason |
|---|---|---|---|---|---|
| ADMIN | None, ADMIN, LEAD, or MEMBER | Any same-org role | Any | CONDITIONAL | Organization `ADMIN` bypasses project permission/membership; controller blocks self, project creator, and last project `ADMIN`. |
| MANAGER | ADMIN | Any same-org role | MEMBER or LEAD | ALLOWED | Project `ADMIN` has `member:remove`; controller safeguards still apply. |
| MANAGER | ADMIN | Any same-org role | ADMIN | CONDITIONAL | Allowed if target is not creator and at least one other project `ADMIN` remains; otherwise denied. |
| TEAMMATE | ADMIN | Any same-org role | MEMBER or LEAD | ALLOWED | Project role, not organization role, grants `member:remove`; controller safeguards still apply. |
| TEAMMATE | ADMIN | Any same-org role | ADMIN | CONDITIONAL | Allowed if target is not creator and at least one other project `ADMIN` remains; otherwise denied. |
| MANAGER or TEAMMATE | LEAD | Any same-org role | Any | DENIED | `LEAD` does not have `member:remove`. |
| MANAGER or TEAMMATE | MEMBER | Any same-org role | Any | DENIED | `MEMBER` does not have `member:remove`. |
| Any non-ADMIN organization role | No project membership | Any same-org role | Any | DENIED | Membership required; project role cannot be inferred from organization role. |
| Any actor | Any | Any | Actor themself | DENIED | `removeProjectMember` explicitly blocks self-removal. |
| Any actor allowed by route | Any | Any | Project creator | DENIED | `removeProjectMember` explicitly protects `project.createdById`. |
| Any actor allowed by route | Any | Any | Last project ADMIN | DENIED | `ensureNotLastProjectAdmin` protects the final project administrator. |

Evidence: `requireProjectPermission("member:remove")` on `DELETE /api/projects/:projectId/members/:memberId` (`backend/routes/project.routes.ts`), permission table and org-admin bypass in `backend/middleware/project.permission.ts`, and `removeProjectMember`/`ensureNotLastProjectAdmin` in `backend/controllers/project.controller.ts`. The controller does not restrict targets based on their organization role; target organization membership follows from project membership creation rules and project organization scope.

### Matrix 5: Organization vs Project Role Interaction

| Organization role | Project role | Organization access | Project access | Effective permissions | Restrictions |
|---|---|---|---|---|---|
| ADMIN | None | Same-org resources; admin-only organization actions | Project access across projects in own organization | Full project management override for ordinary project actions | Cannot create a work item without project membership; self-removal, project creator, and last project admin safeguards still apply. |
| ADMIN | ADMIN | Same | Full | Organization admin override plus project ADMIN rights | Same-org project boundary; work-item creation still needs membership. |
| ADMIN | LEAD | Same | Full | Organization admin override; effectively exceeds LEAD matrix | Same-org project boundary; work-item creation still needs membership. |
| ADMIN | MEMBER | Same | Full | Organization admin override; effectively exceeds MEMBER matrix | Same-org project boundary; work-item creation still needs membership. |
| MANAGER | None | Same-org resource access; can create projects and manage org SLA | Public project read only; private project denied | No inherited project manager role | Project membership is required for project operations. |
| MANAGER | ADMIN | Same | Full | Project ADMIN permissions in that project | Project-level status is independent of organization role; no broader org-admin permission. |
| MANAGER | LEAD | Same | Project LEAD permissions | Project-level permissions in that project | Cannot delete project/remove members/grant project ADMIN. |
| MANAGER | MEMBER | Same | Project MEMBER permissions | Project-level permissions in that project | Cannot project-manage despite organization manager status. |
| TEAMMATE | None | Same-org resource access; organization role changes/invites denied | Public project read only; private project denied | No inherited project permissions | Membership required for project operations. |
| TEAMMATE | ADMIN | Same | Full | Project ADMIN permissions in that project | Project role can confer project-level admin rights; cannot manage organization members/settings beyond org role policy. |
| TEAMMATE | LEAD | Same | Project LEAD permissions | Project-level permissions in that project | Backend permits it; current UI often hides manager controls for organization teammates. |
| TEAMMATE | MEMBER | Same | Project MEMBER permissions | Project-level permissions in that project | Can create/update/assign work items; cannot delete work items/manage project settings. |

**Answers to the role-interaction questions**

- An organization `ADMIN` has broad project administrative access within their organization, including private projects, without project membership, **except work-item creation**, which explicitly requires project membership. Project creator/last-admin/self-removal safeguards remain.
- An organization `MANAGER` does **not** automatically become project `LEAD`/`ADMIN`; a teammate does not automatically access private projects. Project membership/role is separate. A person who creates a project is automatically project `ADMIN`.
- For non-organization-admins, project membership is mandatory for operations. Membership-free exceptions are limited to read operations where the route explicitly allows `PUBLIC` projects, and this exception is not applied consistently to every resource read.
- Organization project lookup always constrains the project to the authenticated user's organization. Project roles cannot grant access to another organization.
- Project role can grant rights beyond a user's organization role **within that project** (e.g. a `TEAMMATE` who is project `ADMIN` receives project-admin operations); it does not grant organization-wide actions.
- Public visibility affects read access, not project writes. Private projects are readable by same-organization project members and organization admins; public projects can be read by same-organization non-members for routes using `project:view`/`task:read`.

## Matrix 6: API Authorization Matrix

Routes are expressed with their `backend/app.ts` mount prefixes. `isLoggedIn` is authentication only; role/resource decisions after it are named explicitly. Aliased organization/project mounts share the same router behavior.

| API endpoint | HTTP method | Required organization role | Required project role | Middleware / permission check | Authorization result |
|---|---|---|---|---|---|
| `/api/organizations/`, `/api/organization/`, `/api/users/`, `/api/users/register` | POST | None (public onboarding) | None | `registerOrganization` validates onboarding and creates first active ADMIN | ALLOWED for valid new registration; not an operation on an existing organization. |
| `/api/organizations/members`, `/api/organization/members` | GET | Any authenticated org member | None | `isLoggedIn`; controller scopes by `req.user.organizationId` | CONDITIONAL on active authenticated user with org context; no role gate. |
| `/api/users/` | GET | Any authenticated org member | None | `isLoggedIn`; `getOrganizationUsers` scopes to same org and active users | CONDITIONAL; returns organization roster details. |
| `/api/organizations/members`, `/api/organization/members` | POST | ADMIN | None | `isLoggedIn`; `addOrganizationMembers` checks `UserRole.ADMIN`; role target restricted to MANAGER/TEAMMATE | CONDITIONAL; ADMIN target role is rejected by this route. |
| `/api/organizations/members/invite`, `/api/organization/members/invite`, `/api/users/invite` | POST | ADMIN | None | `isLoggedIn`; `inviteMembersController` checks ADMIN; Joi/service allow ADMIN/MANAGER/TEAMMATE invite roles | CONDITIONAL; invitee becomes pending until token acceptance. |
| `/api/organizations/members/:userId`, `/api/organization/members/:userId` | PATCH | ADMIN | None | `isLoggedIn`; `updateOrganizationMemberRole` validates role, same-org target and last active ADMIN | CONDITIONAL; self-role change is not prohibited; last active ADMIN cannot be demoted. |
| Same member path | DELETE | ADMIN | None | `isLoggedIn`; `removeOrganizationMember` checks self, same org, creator and last active ADMIN | CONDITIONAL; see Matrix 2. |
| `/api/organizations/accept`, `/api/organization/accept`, `/api/users/accept-invitation` | POST | None (public token flow) | None | Invitation token/schema/service validation | ALLOWED only for a valid, unexpired, unused invitation. |
| `/api/sla/`, `/api/organization/sla/` | GET | Any authenticated org member | None | `isLoggedIn`; controller requires organization context | CONDITIONAL; all three org roles can read. |
| Same SLA paths | PUT, PATCH | ADMIN or MANAGER | None | `isLoggedIn`; `updateOrganizationSla` explicit role check | CONDITIONAL; TEAMMATE denied. |
| `/api/projects/` | POST | ADMIN or MANAGER | None | `isLoggedIn`, `checkPermission("project:create")`, validation | CONDITIONAL; TEAMMATE denied; creator becomes project ADMIN. |
| `/api/projects/` | GET | Any authenticated org member | None | `isLoggedIn`, `checkPermission("project:read")`; controller filters public/member/admin projects within org | CONDITIONAL; no cross-organization results. |
| `/api/projects/:projectId` | GET | Any same-org user | ADMIN/LEAD/MEMBER, or none for PUBLIC read; org ADMIN override | `isLoggedIn`, `requireProjectPermission("project:view")` | CONDITIONAL on project org, membership/role or PUBLIC visibility. |
| `/api/projects/:projectId` | PATCH | Any same-org user | ADMIN or LEAD; org ADMIN override | `requireProjectPermission("project:update")` | CONDITIONAL. |
| `/api/projects/:projectId` | DELETE | Any same-org user | ADMIN; org ADMIN override | `requireProjectPermission("project:delete")` | CONDITIONAL. |
| `/api/projects/:projectId/members` | GET | Any same-org user | Any member; public read may pass; org ADMIN override | `requireProjectPermission("project:view")` | CONDITIONAL; handler returns project roster. |
| `/api/projects/:projectId/members` | POST | Any same-org user | ADMIN or LEAD; org ADMIN override | `requireProjectPermission("member:add")`, validation, controller same-org target/duplicate/admin-role checks | CONDITIONAL. |
| `/api/projects/:projectId/members/:memberId` | DELETE | Any same-org user | ADMIN; org ADMIN override | `requireProjectPermission("member:remove")`, `removeProjectMember` safeguards | CONDITIONAL; see Matrix 4. |
| `/api/projects/:projectId/members/:memberId` | PATCH | Any same-org user | ADMIN or LEAD; org ADMIN override; only ADMIN/org ADMIN may grant project ADMIN | `requireProjectPermission("member:role:update")`, controller last-admin check | CONDITIONAL. |
| `/api/projects/:projectId/labels` | GET | Any same-org user | Any role with project:view; public read; org ADMIN override | `requireProjectPermission("project:view")`, `assertProjectSettingsAccess` | CONDITIONAL. |
| `/api/projects/:projectId/labels` | POST, DELETE `/:labelId` | Any same-org user | ADMIN or LEAD; org ADMIN override | `requireProjectPermission("project:update")`, settings controller write check | CONDITIONAL. |
| `/api/projects/:projectId/workflow` | GET | Any same-org user | Any role with project:view; public read; org ADMIN override | `requireProjectPermission("project:view")`, `assertProjectSettingsAccess` | CONDITIONAL. |
| Same workflow path | POST, PUT | Any same-org user | ADMIN or LEAD; org ADMIN override | `requireProjectPermission("project:update")`, `assertProjectSettingsAccess` | CONDITIONAL. |
| `/api/projects/:projectId/audit-logs` | GET | Any same-org user | Any role with project:view; public read; org ADMIN override | `requireProjectPermission("project:view")`; `assertAuditProjectAccess` repeats scope/read check | CONDITIONAL. |
| `/api/projects/:projectId/audit-logs`, `/api/projects/audit-logs` | POST | Role allowed by `project:update` or `task:update` middleware | ADMIN/LEAD or task-update role; org ADMIN override | `requireProjectPermission`; `createAuditLog` then always throws 403 | DENIED in controller; direct API audit creation is not implemented. |
| `/api/projects/:projectId/audit-logs/:logId/undo`, `/api/projects/audit-logs/:logId/undo` | POST | Any same-org user | ADMIN or LEAD; org ADMIN override | `requireProjectPermission("project:update")`; `executeAuditUndo` independently checks role, ownership, trusted/reversible entry and current state | CONDITIONAL. |
| `/api/work-items/` | POST | Any same-org user | Any project member with task:create; org ADMIN still must be a member | `requireProjectPermission("task:create")` -> `authorizeWorkItemCreationForActor`; controller/service validates project, assignees and data | CONDITIONAL; membership is mandatory. |
| `/api/work-items/:workItemId` | GET | Any same-org user | Any with task:read; PUBLIC nonmember read; org ADMIN override | `requireProjectPermission("task:read")`; `getAccessibleWorkItem`/`assertAccessibleProject` | CONDITIONAL. |
| Same work-item path | PATCH | Any same-org user | Any project member with task:update; org ADMIN override | `requireProjectPermission("task:update")`; work-item service checks project access | CONDITIONAL; assignment changes also validate active same-org project membership. |
| Same work-item path | DELETE | Any same-org user | ADMIN or LEAD; org ADMIN override | `requireProjectPermission("task:delete")` | CONDITIONAL. |
| `/api/work-items/project/:projectId` | GET | Any same-org user | Any with task:read; PUBLIC nonmember read; org ADMIN override | `requireProjectPermission("task:read")`; `assertAccessibleProject` | CONDITIONAL. |
| `/api/work-items/:workItemId/attachments` | POST | Any same-org user | Any project member with task:update; org ADMIN override | `requireProjectPermission("task:update")`, upload middleware | CONDITIONAL; no separate attachment role. |
| `/api/work-items/:workItemId/sla`, `/sla/audit` | GET | Any same-org user | `sla:view` (all project roles); org ADMIN override | `requireProjectPermission("sla:view")` / `sla:audit` | CONDITIONAL; project MEMBER can view SLA, but audit requires ADMIN/LEAD. |
| `/api/work-items/:workItemId/escalate`, `/escalate/resolve` | PATCH, POST | Any same-org user | `sla:manage` or `sla:resolve` (ADMIN/LEAD); org ADMIN override | `requireProjectPermission` with corresponding SLA action | CONDITIONAL. |
| `/api/work-items/:workItemId/comments`, `/time-entries` | GET | Any same-org user | task:read; public nonmember passes middleware but fails controller membership check | `requireProjectPermission("task:read")`; `assertWorkItemAccess` | CONDITIONAL; public-read behavior is inconsistent. |
| Same comments/time-entry paths | POST | Any same-org user | Any project member with task:update; org ADMIN override | `requireProjectPermission("task:update")`; `assertWorkItemAccess` | CONDITIONAL. |
| `/api/work-items/:workItemId/dependencies` and `/:depId` | GET, POST, DELETE | Any same-org user | task:read for GET; task:update for mutations; org ADMIN override | `requireProjectPermission`; dependency service/access checks | CONDITIONAL. |
| `/api/projects/:projectId/sprints` | GET, POST | Any same-org user | GET: any project member; POST: ADMIN/LEAD; org ADMIN override | `requireProjectPermission("sprint:view" / "sprint:create")`; controller validates project/tasks | CONDITIONAL; public nonmembers do not pass sprint:view middleware. |
| `/api/projects/:projectId/sprints/:sprintId` | GET, PATCH, DELETE | Any same-org user | GET: any project member; PATCH/DELETE: ADMIN/LEAD; org ADMIN override | `requireProjectPermission("sprint:view" / "sprint:update" / "sprint:delete")` | CONDITIONAL. |
| `/api/projects/:projectId/sprints/:sprintId/start`, `/complete` | POST | Any same-org user | ADMIN/LEAD; org ADMIN override | `requireProjectPermission("sprint:update")` | CONDITIONAL. |
| `/api/projects/:projectId/whiteboards` | GET, POST | Any same-org user | GET: project:view; POST: ADMIN/LEAD; org ADMIN override | `requireProjectPermission("project:view" / "project:update")` | CONDITIONAL; public project read applies to GET. |
| `/api/whiteboards/:whiteboardId`, `/revisions...` | GET, PATCH, DELETE | Any same-org user | GET: project:view; PATCH: ADMIN/LEAD; DELETE: ADMIN; org ADMIN override | `requireProjectPermission` maps reads to `project:view`, writes to `project:update` or delete to `project:delete` | CONDITIONAL. |
| `/api/projects/:projectId/dashboard` | GET | Any same-org user | project:view; public read; org ADMIN override | `requireProjectPermission("project:view")` | CONDITIONAL. |
| `/api/dashboard/personal` | GET | Any authenticated user | None | `isLoggedIn`; personal controller | CONDITIONAL on authentication and own-user context; no project role. |
| `/api/users/me/audit-logs` | GET | Any authenticated user | Project memberships used to scope results | `isLoggedIn`; controller queries projects where caller has membership | CONDITIONAL; organization-admin override is not applied to non-member projects. |

Other routes such as notifications and chat are authenticated at router level and use caller/conversation ownership or membership checks in their controllers/services; they do not use organization/project role middleware as such.

## Organization and project resource ownership restrictions

- Organization APIs use the `organizationId` populated from the active database user. Member role updates/removal additionally query targets by both user ID and organization ID.
- Project lookups in `authorizeProjectPermission`, project controllers, and settings controllers include the caller's organization ID. Organization-admin override is not cross-organization.
- Project members can add only existing users from the same organization (`addProjectMember`); task assignees must be active same-organization users who are already project members (`validateAssignees`).
- Project member removal is based on actor's organization-admin override or project `ADMIN`, not target organization role. Project creator and last project `ADMIN` protections are controller-level.
- Work-item changes are not restricted to the work-item creator or current assignee in the inspected service; project action authorization is the effective gate.
- No organization-name/update endpoint or dedicated organization details endpoint was found; `/api/users/me` is the read path for the caller's own organization data.

## RBAC inconsistencies and findings

### MEDIUM — Organization member roster endpoints have no admin-only role gate

`GET /api/organizations/members` and alias `/api/organization/members` use only `isLoggedIn`; `getOrganizationMembers` returns names, emails, roles, statuses and creation dates for the caller's organization. `GET /api/users/` similarly returns active organization users. The Settings UI (`SettingsView.tsx`) only renders the organization member-management view to organization `Admin`, but the backend does not enforce that visibility restriction for these reads. The queries are organization-scoped, so this is not a demonstrated cross-organization access bypass; it is a backend/frontend role-policy mismatch and exposes roster data to all authenticated organization roles.

### MEDIUM — Frontend project controls use organization role where backend uses project role

`ProjectSettingsView.tsx` and `ProjectMembersView.tsx` gate settings/member controls using `currentUser.role` (`Admin`/`Manager`/`Teammate`) rather than the backend `ADMIN`/`LEAD`/`MEMBER` action permissions. The backend allows project `ADMIN`/`LEAD` to edit/manage members regardless of organization role, but the UI hides these controls from an organization `TEAMMATE` who is project `ADMIN`/`LEAD`. Conversely, an organization `MANAGER` who is only project `MEMBER` sees some controls that the backend rejects. The API remains authoritative; this manifests as missing UI capability or denied requests, not a backend authorization bypass.

### MEDIUM — Public-project read is inconsistent across resource endpoints

`authorizeProjectPermission` grants membership-free `PUBLIC` reads only for `project:view` and `task:read`. However, `GET /api/work-items/:workItemId/comments` and `.../time-entries` pass the route's `task:read` gate but are then blocked by `assertWorkItemAccess`, which requires membership unless the actor is organization `ADMIN`. Sprint routes use `sprint:view`, which the generic middleware does not include in its public-read exception, even though sprint controller helper logic describes public-project read access. Thus public project visibility is not consistently sufficient for these read endpoints. This is an inconsistent/overly restrictive authorization outcome rather than an unauthorized disclosure.

### MEDIUM — Organization member invitation UI offers an Admin role that its API rejects

`SettingsView.tsx` includes an `Admin` option and submits via `addOrganizationMemberApi` to `POST /api/organization/members`. `addOrganizationMembers` explicitly rejects `ADMIN` invitations on this path. A separate `/api/users/invite` and `/api/organization/members/invite` path accepts `ADMIN`, but the Settings form does not use it. Selecting Admin in that UI therefore fails despite the option being shown.

### LOW — Organization role permission map is only partially wired and duplicates role policy

`check.permissions.ts` defines broad organization-wide project/task permissions, including project update/delete/member management and task delete/assign. Only `project:create` and `project:read` are used in project routes. Other routes use explicit controller organization checks or `requireProjectPermission`. This creates potential confusion (e.g. organization `MANAGER` has `project:delete` in the unused map but cannot delete a project without project-level permission) and requires policy to be inferred from the actual route rather than the global table.

### LOW — Project action entries exist without matching dedicated route checks

Project actions such as `task:assign` and `task:escalate` exist in `project.permission.ts`, but work-item assignment/reassignment routes use `task:update`, and escalation uses `sla:manage`. The current role grants overlap, so the inspected effective access is not different, but the unused action entries can drift from real API enforcement.

### Other noted asymmetries (not classified as standalone vulnerabilities)

- `updateOrganizationMemberRole` protects the last active organization `ADMIN`, but does not prohibit changing the organization creator's role. Removal separately prohibits removing the creator.
- Project role updates do not protect the project creator from a role change, although project member removal does protect the creator.
- The project-member removal UI helper (`canRemoveProjectMember` in `frontend/src/services/api.ts`) checks self, project creator, organization-admin/project-admin actor, but does not model the backend last-project-admin condition; the backend still blocks the request.
- `POST /api/projects/audit-logs` is permission-gated but always rejected by `createAuditLog`; actual audit entries are created from server-side operations.
- `GET /api/users/me/audit-logs` is membership-scoped and does not apply the organization-admin project override used by other project audit reads.

### Missing authorization checks / unprotected endpoints

No project mutation endpoint reviewed was found to rely solely on authentication without a project/org resource check: project, task, sprint, labels/workflow, whiteboard, dashboard and project audit routes use project middleware, and controllers/services provide additional same-organization, membership or ownership checks. Organization member roster reads are authenticated and organization-scoped but lack the admin-only role gate described above. Public registration, invitation acceptance, login, refresh, and password recovery are designed public/auth-flow endpoints rather than operations on an existing protected project.

## Final summary

1. **Organization roles:** `ADMIN`, `MANAGER`, `TEAMMATE`.
2. **Project roles:** `ADMIN`, `LEAD`, `MEMBER`.
3. **Effective organization permissions:** organization `ADMIN` can invite members, change roles, remove members subject to safeguards, and manage SLA settings; `MANAGER` can create projects and update SLA settings but cannot administer organization members; `TEAMMATE` can read organization-scoped resources and project collections but has no organization member-management/SLA-write privileges.
4. **Organization member removal:** only organization `ADMIN`; can remove a different ADMIN, MANAGER, or TEAMMATE if target is not the organization creator and not the last active ADMIN. Self-removal is blocked.
5. **Project member removal:** organization `ADMIN` can remove project members without project membership, and project `ADMIN` can remove members; project `LEAD` and `MEMBER` cannot. Self, project creator and last project ADMIN cannot be removed. Target organization role otherwise does not matter.
6. **Role interaction:** organization roles do not automatically translate into project roles. Organization `ADMIN` has a project-wide override within their organization except membership-required work-item creation. Organization `MANAGER`/`TEAMMATE` need project membership for operations. A project role can confer project-level privileges to any organization role but cannot cross organization boundaries or grant organization-wide permissions.
7. **Consistency:** backend authorization is substantially resource-scoped, but it is not fully consistent: public-read exceptions vary by endpoint, frontend project UI relies partly on organization roles instead of project roles, and the organization roster API is less restrictive than the UI.
8. **Most important gaps:** organization roster data is accessible to every authenticated organization role; project-level controls can be hidden or shown incorrectly by frontend role checks; public-project read is inconsistent across comments/time entries and sprints. These are MEDIUM/LOW findings; no CRITICAL or HIGH authorization bypass was substantiated in the inspected code.
9. **Overall assessment:** RBAC has distinct organization and project role layers and generally enforces organization boundaries, project membership and role-based writes in backend routes. The main concern is policy drift between route middleware, controllers, and frontend gating—not a demonstrated cross-organization privilege escalation. Overall: **moderate, inconsistent implementation; backend generally enforces access, with medium role/privacy and consistency gaps**.
