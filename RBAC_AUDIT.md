# RBAC Audit

## 1. Executive summary

Authorization is split across organization-role middleware, project-membership middleware, controller checks, and frontend-only permission helpers. Backend routes generally enforce authorization independently of the UI, and project/work-item queries are scoped to the authenticated user's organization.

The most material policy discrepancy is that organization Managers can update the organization-wide SLA policy even though the supplied matrix reserves that action for Admins. Other notable differences are that Managers cannot invite organization members, project permissions are determined by a separate project role, and project Members can update and reassign any work item in their project rather than only work items assigned to them. The last point is a mismatch only if “update assigned tasks” in the expected matrix means an assignee-only restriction.

No source, configuration, dependency, or database files were changed. This report is the only file created for the audit.

## 2. Scope and constraints

This is a read-only source review of authorization for organization members, invitations, organization roles/settings, SLA policy, projects, work items, and audit activity. It compares the implementation with the supplied Admin / Manager / Member matrix.

The review inspected backend routes, middleware, controllers, services, entities, and the relevant frontend permission and view code. No database connection, migration, live request, or application test was run. Findings describe behavior evident from the inspected source; they are not claims of runtime testing.

## 3. Organization role definitions

The backend organization enum is `ADMIN`, `MANAGER`, and `TEAMMATE` ([user.entity.ts](backend/entities/user.entity.ts#L23-L26)). The UI maps these to Admin, Manager, and Teammate. “Member” in the supplied expected matrix therefore corresponds to backend `TEAMMATE` when referring to an organization role.

## 4. Authorization architecture

There are at least three distinct authorization mechanisms:

1. `checkPermission` uses organization roles for selected operations, such as project creation ([check.permissions.ts](backend/middleware/check.permissions.ts#L25-L64)).
2. `requireProjectPermission` resolves the project and checks project membership and project role ([project.permission.ts](backend/middleware/project.permission.ts#L94-L99), [project.permission.ts](backend/middleware/project.permission.ts#L182-L285)).
3. Frontend `domain/permissions.ts` maintains a separate organization-role permission map ([permissions.ts](frontend/src/domain/permissions.ts#L25-L54)).

These are not a single unified policy. The backend is authoritative for API calls, but frontend visibility and optimistic actions do not always match the backend decision.

## 5. Expected-versus-actual comparison

“Member” below means organization `TEAMMATE`. Project actions additionally depend on the caller's project membership and project role; see sections 6 and 12.

| Permission | Expected policy | Actual backend behavior | Result |
|---|---|---|---|
| View organization members | Admin, Manager, Member | Authenticated users can list members scoped to their organization. The Settings roster UI itself is rendered only for Admins; `/api/users` also returns active same-organization users to authenticated users. | Partial: API allows all, Settings roster is Admin-only. |
| Add/invite organization members | Admin yes; Manager conditional yes; Member no | All inspected organization invitation routes require Admin. | Mismatch: Manager cannot invite. |
| Remove organization members | Admin yes; Manager/Member no | Admin-only; self-removal and removal/demotion of the last active Admin are protected. | Match. |
| Change organization member roles | Admin yes; Manager/Member no | Admin-only; requested role must be in the organization enum. Last active Admin cannot be demoted. | Match. |
| Promote a member to Manager | Admin yes; Manager/Member no | Admin can assign `MANAGER` using the role-update endpoint. | Match. |
| Promote a member to Admin | Admin conditional yes; Manager/Member no | Admin can promote an existing member using the role-update endpoint. The standard organization-add route rejects an Admin invite role, while the separate `/api/users/invite` route accepts it in its invitation schema. | Match for promotion; invitation paths are inconsistent. |
| Manage organization settings | Admin only | No organization metadata/settings update endpoint was found in the inspected organization routes. Profile/theme UI is not an organization settings API; SLA policy is a separate endpoint. | Not implemented / unverifiable beyond inspected routes. |
| Manage organization SLA policy | Admin only | Admin and Manager can update it; all authenticated organization users can read it. | Mismatch: Manager has write access. |
| Create and manage projects | Admin and Manager; Member according to project permissions | Admin and Manager can create projects. Project actions thereafter are project-role based; organization Admin bypasses project membership checks. An organization Manager without a suitable project role cannot manage that project. | Partial: Manager project management is conditional on project role. |
| Create and assign tasks | Admin and Manager; Member according to project permissions | Project Admin, Lead, and Member all have `task:create` and `task:assign`. Non-admin organization users need project membership (except public-project read access). Frontend Teammates do not have `CREATE_TASK`. | Partial: backend grants project Members more than the frontend exposes. |
| Update assigned tasks | Admin and Manager; Member according to project permissions | All three project roles have `task:update`. The backend does not check whether the actor is assigned to the specific work item; Members can update work items and change their assignees throughout their project. | Conditional mismatch if the expected policy means assignee-only editing. |
| View audit activity | Admin and Manager; Member according to project permissions | Project audit reads use `project:view`; all project roles have it. Organization Admin bypasses project membership. Authenticated users can also view logs for public projects in their organization. | Partial: public-project logs are visible without project membership. |

## 6. Actual effective permissions matrix

### Organization-level behavior

| Action | Admin | Manager | Teammate |
|---|---|---|---|
| Read organization member list | Yes | Yes | Yes |
| Invite/add organization members | Yes | No | No |
| Remove organization members | Yes, with self/last-Admin protections | No | No |
| Change organization role / promote to Manager or Admin | Yes, subject to last-Admin protection | No | No |
| Create projects | Yes | Yes | No |
| Read project list | Yes | Yes | Yes |
| Update organization SLA policy | Yes | Yes | No |
| Read organization SLA policy | Yes | Yes | Yes |
| Project-scoped actions | Bypasses project membership and project-role checks within own organization | Determined by project role; no automatic Manager project-admin grant | Determined by project role |

The organization permission list grants Admin and Manager project creation, but not Teammates ([check.permissions.ts](backend/middleware/check.permissions.ts#L25-L64)). The project list itself is restricted to public projects, organization Admins, or projects where the user is a member ([project.controller.ts](backend/controllers/project.controller.ts#L153-L184)).

### Project-level behavior

| Project role | Effective actions |
|---|---|
| `ADMIN` | View/update/delete project; add/remove members and change roles; create/read/assign/update/escalate/delete tasks; view/manage/resolve/audit SLA; view/create/update/delete sprints. |
| `LEAD` | View/update project; add members and change roles; create/read/assign/update/escalate/delete tasks; view/manage/resolve/audit SLA; view/create/update/delete sprints. Cannot delete the project or remove project members. |
| `MEMBER` | View project; create/read/assign/update tasks; view SLA; view sprints. Cannot update/delete project settings, manage members, delete tasks, manage SLA, or modify sprints. |

The exact action map is in [project.permission.ts](backend/middleware/project.permission.ts#L25-L91). Organization Admin is a separate override and has full project-management access within their organization ([project.permission.ts](backend/middleware/project.permission.ts#L240-L248)). Public projects permit non-members to view the project and read tasks, but do not grant other actions ([project.permission.ts](backend/middleware/project.permission.ts#L250-L263)).

## 7. Organization member visibility

`GET /api/organization/members` requires authentication but no organization-role permission, and the controller filters by the authenticated user's organization ([organization.routes.ts](backend/routes/organization.routes.ts#L19), [organization.controller.ts](backend/controllers/organization.controller.ts#L254-L284)). `GET /api/users` similarly returns active users from the caller's organization ([user.routes.ts](backend/routes/user.routes.ts#L25), [user.controller.ts](backend/controllers/user.controller.ts#L409-L430)).

The Settings page loads and displays its organization roster only when `currentUser.role === 'Admin'` ([SettingsView.tsx](frontend/src/features/settings/SettingsView.tsx#L59-L83)). Thus the API access policy is broader than that particular UI surface.

## 8. Organization invitations and provisioning

The organization add/invite controllers require Admin and limit that invitation path to Manager and Teammate roles ([organization.controller.ts](backend/controllers/organization.controller.ts#L190-L232)). The shared invitation controller also requires Admin ([member-invitation.controller.ts](backend/controllers/member-invitation.controller.ts#L42-L77)); its schema accepts Admin as an invite role ([member-invitation.controller.ts](backend/controllers/member-invitation.controller.ts#L10-L18)). Consequently:

- The expected conditional Manager invite permission is not implemented.
- Admin role invitations behave differently across the standard organization-add and `/api/users/invite` paths.
- Admin can still promote an existing organization member to Admin through the role-update endpoint.

## 9. Organization member removal

Removal is Admin-only and scoped to the caller's organization. The controller rejects self-removal and protects the last active Admin ([organization.controller.ts](backend/controllers/organization.controller.ts#L350-L405)). This matches the expected matrix and includes safeguards against losing the final administrator.

## 10. Organization role changes and elevation controls

Only Admin can update an organization's member role; the target must belong to the same organization and the new role must be a valid `UserRole` ([organization.controller.ts](backend/controllers/organization.controller.ts#L287-L343)). Demoting the last active Admin is rejected. The backend does not allow Managers or Teammates to elevate themselves through this endpoint.

Project role changes are separate. The project permission layer allows project Admins and Leads to change project roles, but only a project Admin (or organization Admin override) may grant project Admin ([project.permission.ts](backend/middleware/project.permission.ts#L267-L285)). The project role entity is `ADMIN`, `LEAD`, or `MEMBER` ([project.member.entity.ts](backend/entities/project.member.entity.ts#L13-L16)).

## 11. Organization settings and SLA policy

The inspected organization router exposes registration, member listing, invitations, role changes, and member removal, but no organization metadata/settings update route ([organization.routes.ts](backend/routes/organization.routes.ts#L18-L28)). The frontend Settings page exposes theme/profile controls, organization member management, and SLA settings; it does not evidence another organization-settings API.

The SLA routes are authenticated ([sla.routes.ts](backend/routes/sla.routes.ts#L8-L12)). Reads are organization-scoped. The update controller explicitly permits both Admin and Manager ([sla.controller.ts](backend/controllers/sla.controller.ts#L52-L62)), contrary to the supplied Admin-only expectation. The frontend displays the SLA form for all roles and relies on the backend to reject unauthorized writes ([SettingsView.tsx](frontend/src/features/settings/SettingsView.tsx#L463-L517)).

## 12. Project authorization and membership

Project creation is organization-role controlled; the creator is made a project Admin ([project.routes.ts](backend/routes/project.routes.ts#L40-L46), [project.controller.ts](backend/controllers/project.controller.ts#L115-L150)). Subsequent operations use project-role middleware. Project membership mutations are routed through `member:add`, `member:remove`, and `member:role:update` checks ([project.routes.ts](backend/routes/project.routes.ts#L89-L114)).

An organization Manager does not automatically receive project Lead/Admin privileges. The frontend instead shows project member-management controls to any non-Teammate organization role ([ProjectMembersView.tsx](frontend/src/features/project/ProjectMembersView.tsx#L82-L83), [ProjectSettingsView.tsx](frontend/src/features/project/ProjectSettingsView.tsx#L648-L650)). This can show controls that the backend rejects for a Manager with only project `MEMBER`, and can hide controls from an organization Teammate who is project Admin/Lead.

## 13. Work-item permissions and assignment scope

Work-item routes enforce `task:create`, `task:update`, `task:read`, or `task:delete` project permissions ([work.item.routes.ts](backend/routes/work.item.routes.ts#L41-L115)). Every project role has `task:update`; project Members also have `task:assign` ([project.permission.ts](backend/middleware/project.permission.ts#L25-L91)).

The update service verifies organization and project access and validates new assignees as active users who are project members ([work-item.service.ts](backend/services/work-item.service.ts#L690-L750), [work-item.service.ts](backend/services/work-item.service.ts#L983-L1024)). It does not check whether the actor is the current assignee before applying ordinary task-field changes or replacing assignments. Therefore a project Member can edit and reassign any work item in that project. Whether this violates the expected “Update assigned tasks” policy depends on whether “assigned” was intended as a strict ownership restriction.

## 14. Audit activity access

Project audit reads require authentication and `project:view` ([project.routes.ts](backend/routes/project.routes.ts#L165-L169)). The controller verifies the project belongs to the caller's organization, then allows organization Admins, project members, and non-members when the project is public ([auditlog.controller.ts](backend/controllers/auditlog.controller.ts#L308-L334), [auditlog.controller.ts](backend/controllers/auditlog.controller.ts#L943-L982)). Thus Teammates who are project Members can read project activity, and any authenticated user in the organization can read activity for its public projects.

The separate “my audit logs” endpoint filters to the current user's own actions and project memberships ([user.routes.ts](backend/routes/user.routes.ts#L27-L28), [auditlog.controller.ts](backend/controllers/auditlog.controller.ts#L1088-L1154)). Audit undo requires project update permission, so it is limited to project roles with that action or the organization Admin override ([project.routes.ts](backend/routes/project.routes.ts#L171-L184)).

## 15. Frontend and backend consistency

The frontend has its own organization-role matrix ([permissions.ts](frontend/src/domain/permissions.ts#L25-L54)), and maps project `LEAD`/`MEMBER` to organization-style `Manager`/`Teammate` labels ([api.ts](frontend/src/services/api.ts#L1116-L1154)). Project member controls are then gated on the current organization role rather than the current project role.

Some project membership updates also change local state before the backend request completes; failed persistence can leave the UI temporarily showing a change the backend rejected ([AppContext.tsx](frontend/src/state/AppContext.tsx#L2551-L2630)). These frontend discrepancies do not bypass the backend checks, but they can mislead users and cause apparent success followed by stale state.

## 16. Security and policy findings

| ID | Severity | Finding | Evidence | Confidence |
|---|---|---|---|---|
| RBAC-01 | MEDIUM | Organization Managers can modify the organization-wide SLA policy despite the expected Admin-only policy. This is a backend authorization mismatch, not just a frontend visibility issue. | [sla.controller.ts](backend/controllers/sla.controller.ts#L52-L62) | 9/10 |
| RBAC-02 | MEDIUM* | Project Members can update any work item in their project and can change its assignees; update authorization is project-role based, not assignee based. Treat as a policy defect if the intended rule is “users may update only tasks assigned to them.” | [project.permission.ts](backend/middleware/project.permission.ts#L76-L91), [work-item.service.ts](backend/services/work-item.service.ts#L840-L870), [work-item.service.ts](backend/services/work-item.service.ts#L983-L1024) | 9/10 |
| RBAC-03 | LOW | Project-member UI controls are based on organization role, while API authorization uses project role. Users may see denied actions or be denied controls they should have by project role; failed mutations can leave optimistic local UI state. | [ProjectMembersView.tsx](frontend/src/features/project/ProjectMembersView.tsx#L82-L83), [AppContext.tsx](frontend/src/state/AppContext.tsx#L2551-L2630) | 9/10 |
| RBAC-04 | LOW* | Audit history for a public project is readable by any authenticated user in that organization, not only project members. Severity depends on whether public project visibility is intended to include its audit history. | [auditlog.controller.ts](backend/controllers/auditlog.controller.ts#L308-L334), [auditlog.controller.ts](backend/controllers/auditlog.controller.ts#L943-L982) | 8/10 |
| RBAC-05 | LOW | The expected conditional Manager invitation permission is absent; the implementation is Admin-only. The Admin invite role also differs between invitation routes. | [organization.controller.ts](backend/controllers/organization.controller.ts#L190-L232), [member-invitation.controller.ts](backend/controllers/member-invitation.controller.ts#L42-L77) | 9/10 |

`*` Policy-dependent: confirm intended ownership and public-audit visibility semantics before treating these as confirmed policy violations.

No cross-organization access was identified in the inspected member, project, work-item, or audit paths: their queries/checks use the authenticated organization ID. This is a source-level observation, not a penetration test.

## 17. Recommended policy alignment

1. Decide whether Managers should be allowed to invite organization users and whether Admin invitations are supported; make both invitation routes enforce the same policy.
2. If SLA changes are Admin-only, enforce that policy in the SLA controller rather than relying on the frontend.
3. Clarify whether “Update assigned tasks” means any project task or only tasks assigned to the actor. If assignee-only is intended, enforce it server-side for both field updates and reassignment.
4. Decide whether public project visibility includes audit details; if not, require project membership (or a distinct audit permission) for audit reads.
5. Gate project-member controls using the active project membership role and handle rejected mutations without presenting stale optimistic state as a successful change.
6. Define what “Manage organization settings” includes and add a dedicated endpoint only if the expected Admin capability is intended to exist.

## 18. Verification and limitations

- Reviewed source paths listed in this report and compared the implementation with the expected role matrix.
- No application tests, database operations, migrations, live API calls, or configuration changes were performed.
- No RBAC source files were edited. `RBAC_AUDIT.md` is the only file created for this audit.
- Findings about intended policy semantics (assignee-only editing and public audit visibility) remain conditional until the product owner confirms those rules.
