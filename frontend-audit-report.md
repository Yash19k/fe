# TaskFlow Frontend Audit Report

**Audit date:** 2026-10-27  
**Scope:** Current frontend source and relevant backend routes/controllers for API-contract checks. This is an audit and recommendation report only; no application code or dependencies were changed.

## 1. Executive Summary

The frontend is a React 19, TypeScript, and Vite application with a custom hash-based navigation layer, a centralized API module, domain utility modules, and one large application context. There is useful structure already: feature-oriented page folders, reusable UI components, a small design-token system, and domain modules for scheduling, dependencies, recurrence, permissions, and work-item hierarchy.

The main risk is not a lack of features or algorithms; it is that several important workflows are only partly authoritative. Account signup first creates a local-only user, the server registration result is not used to replace that temporary identity, and registration failures are swallowed while onboarding continues. Requests also omit cross-origin credentials in the general API client even though login/registration establish HttpOnly cookies and refresh relies on a cookie. Several task operations update local state without persisting it, while other mutations report success before a best-effort server request has completed. Those patterns can produce data that appears saved but is lost on reload or differs across users.

There are also specific integration and reliability gaps: escalation uses `POST` in the frontend while the backend exposes `PATCH`; project work-item loading requests only the first 100 records; the audit-log response contract is typed inconsistently with both the backend response and its consumers; and `tsc --noEmit` currently fails. The Vite production build succeeds, but produces a single 668.55 kB minified JavaScript chunk and warns that it exceeds the 500 kB threshold.

**Overall rating: 4/10.** The app has a reasonable feature/domain foundation, but signup/session handling, persistence consistency, API contract typing, and test coverage around rendered workflows need attention before treating the frontend as a reliable foundation for larger project-management features.

No P0 issue was confirmed in the inspected code. Findings marked P1 affect account creation/session continuity or cause user-visible state to diverge from persisted data. P2 findings cover important functional, integration, scalability, and maintainability issues.

## 2. Frontend Architecture Overview

### Stack and rendering flow

- **Framework/language:** React 19 with TypeScript.
- **Build/development:** Vite 8, Tailwind CSS 4 via the Vite plugin.
- **Routing:** Custom hash routing in `AppContext`; there is no routing library in the declared frontend dependencies. `main.tsx` mounts `App` under `StrictMode`.
- **State:** React state and a custom `AppContext`; no Redux, Zustand, or server-state/query library is declared.
- **UI/icons:** Local UI primitives and `lucide-react`.
- **Forms/validation:** Hand-written state and validation in feature components; no schema/form-validation dependency is declared.
- **Tests:** `tsx --test tests/**/*.test.ts`. Tests are Node-run TypeScript tests; the frontend package does not declare React component-testing or browser E2E tooling.

### Application flow

`main.tsx` renders `App`. `App.tsx` composes `ThemeProvider`, `AppProvider`, and `MainAppShell`. `MainAppShell` reads the current hash and context state, applies authentication/onboarding/project checks, and conditionally renders home, project, settings, chat, auth, and not-found views. Project subviews are statically imported and selected by a `projectTab` string.

`AppContext.tsx` owns route synchronization, auth initialization, project loading, work-item state, project/sprint/label/workflow state, notifications, audit records, mutation functions, toasts, modal state, and cross-tab broadcasts. It calls a broad set of functions from `services/api.ts`, maps backend records into frontend records, and publishes one large context value.

### Authentication, requests, and persistence

The API base URL is `VITE_API_URL` or the hard-coded fallback `http://localhost:3000`. Vite separately configures a `/api` development proxy to port 3000, but the API client builds absolute URLs from `API_BASE_URL`, so that proxy is not used by requests with the default base URL.

`services/api.ts` centralizes fetch requests and defines `ApiError`, endpoint helpers, and backend-to-frontend mapping functions. The general request helper sets JSON headers and uses bearer-token storage, but does not set `credentials: 'include'`. The refresh helper does set `credentials: 'include'`. The backend sets HttpOnly access and refresh cookies and exposes a 15-minute access-token TTL.

`state/storage.ts` migrates and reads local storage state. The provider persists the current user and company identity to local storage, while much of the business data is loaded from the backend. `AUTH_TOKEN_KEY` also stores the access token in local storage.

### Routes and protected areas

The app reads and writes `window.location.hash` in `AppContext`. `App.tsx` protects workspace rendering with a client-side user check, an onboarding check, and a client-side project visibility check. This is a navigation/UX layer only; backend routes must remain authoritative for authentication and authorization. The inspected work-item/project routes do use authentication and permission middleware.

### Forms, feedback, and reusable code

Forms are implemented within components such as `AuthView`, `CompanySetupView`, `CreateTaskModal`, and sprint/project dialogs. The app uses shared inputs, buttons, dialogs, badges, empty states, and a toast container. Loading and error handling are implemented ad hoc per feature and are inconsistent: some operations await errors and show a toast, while others swallow or merely log failures after showing success.

Reusable domain logic is in `src/domain/` and covers business days, calendars, concurrency, critical path, dependency graphs, hierarchy, permissions, projects, recurrence, scheduling, SLA, and work items. This is a good starting point for separating pure business rules from UI and API access.

## 3. Overall Frontend Quality Rating

| Category | Score | Evidence |
|---|---:|---|
| Architecture and modularity | 4/10 | Feature and domain folders exist, but routing/rendering orchestration is concentrated in `App.tsx` and major application state/data behavior is concentrated in `AppContext.tsx`. |
| Separation of concerns | 3/10 | The context combines state, API calls, mapping, domain decisions, optimistic updates, notifications, persistence, and routing. Large feature files also combine UI, network lifecycle, and state. |
| TypeScript quality | 3/10 | Strict mode is enabled, but typecheck fails. API responses frequently use `any`; domain interfaces have open `[key: string]: any` fields. |
| State management | 4/10 | Central state and memoized selectors provide a workable prototype, but multiple optimistic/local-only mutation paths and a broad un-memoized context value create divergent sources of truth and render coupling. |
| API integration | 4/10 | There is a central API module and backend mapping layer, but auth credentials, escalation method, pagination, and audit-log response types do not consistently match backend behavior. |
| Security | 5/10 | Backend auth/permission middleware is present in inspected routes. Storing access tokens in local storage increases exposure if a script injection is introduced; client route/role checks cannot enforce access. No unsafe HTML sink was found in the searched frontend source. |
| Performance | 4/10 | The production bundle has a 668.55 kB minified JS chunk, all major views are statically imported, work-item loading caps at 100, and broad context changes can rerender many consumers. |
| Accessibility and UX | 5/10 | Some fields and controls have accessible names and dialogs expose dialog semantics, but the shared dialog has no focus trap/restoration and mutation feedback/persistence behavior is inconsistent. Contrast and screen-reader behavior were not tested in a browser. |
| Testing | 4/10 | The current suite passes 207 tests across 52 suites, but it consists of `.test.ts` Node-run tests; there is no declared component-rendering or browser E2E setup for critical user flows. |
| Maintainability and scalability | 4/10 | Domain modules and feature folders are useful foundations, but large context/page modules, weak API typing, and persistence inconsistency make expansion risky. |

**Overall: 4/10.** The weighted qualitative score reflects that the application builds and has a useful set of domain features, but core operational reliability and contract/type safety are not yet dependable.

Top five improvements that would raise the rating most:

1. Make signup and session renewal use the server's canonical user/organization identity and cookie contract.
2. Make all mutations explicitly server-authoritative or explicitly local-only; remove success-shaped optimistic fallbacks and roll back failed optimistic writes.
3. Repair TypeScript/API response contracts and require a passing typecheck in the normal validation pipeline.
4. Split the provider into bounded session, project/work-item, and UI state/data-access responsibilities without introducing a new state library prematurely.
5. Add component and end-to-end coverage for signup, session expiry, task CRUD, attachments, permissions, and project switching.

## 4. Critical and High-Priority Findings

No confirmed P0 issue was found in the inspected scope.

### F-01 — Signup can report success without creating a valid backend account

- **Finding ID:** F-01
- **Title:** Signup state is local-first, backend registration failures are suppressed, and server identity is discarded
- **Severity:** P1 — High
- **Affected file(s):** [AuthView.tsx](./frontend/src/features/auth/AuthView.tsx), [CompanySetupView.tsx](./frontend/src/features/onboarding/CompanySetupView.tsx), [AppContext.tsx](./frontend/src/state/AppContext.tsx), [api.ts](./frontend/src/services/api.ts), backend `user.controller.ts` and `user.validator.ts`
- **Affected function/component:** `AuthView.handleAuthSubmit`, `CompanySetupView.handleCompanySubmit`, `registerUser`, `completeCompanyOnboarding`, `registerOrganizationApi`
- **Evidence from the code:** Signup accepts passwords of at least six characters. The backend onboarding schema requires at least eight characters. `AuthView` creates a generated local user ID before the backend request. `CompanySetupView` catches/logs the registration error and still calls `completeCompanyOnboarding`, then advances with success feedback. It does not consume the returned server user/organization. The API input interface also describes flat `organizationName`/`adminName` fields, while the component sends nested `user`/`organization` objects.
- **Current behavior:** A 6- or 7-character password passes the frontend check but fails backend validation; the component then continues as if registration succeeded. When registration does succeed, the provider continues using its generated local user and company IDs rather than replacing them with the server IDs.
- **Root cause:** Signup, organization registration, and local onboarding are split across separate components with incompatible types and no single authoritative completion path.
- **Problem caused:** The user may believe the workspace exists when it does not. On successful registration, in-memory user/org identity can disagree with the backend identity associated with the returned token, causing later ownership, membership, filtering, and navigation inconsistencies. A reload before completion also discards the in-memory pending password.
- **Recommended solution:** Make signup submit once to the backend using a contract that matches `onboardingSchema`; enforce the same password rules in the form. Require a successful response before marking onboarding complete. Map the returned user and organization into provider state and persist only the canonical identifiers. Show a blocking actionable error on request failure; remove the default-password fallback.
- **Suggested file separation, if applicable:** Keep form state/validation in `features/auth` and `features/onboarding`, but move the registration workflow orchestration to a typed auth/session service or hook. Keep request/response DTOs in a dedicated API contract module.
- **Implementation steps:** 1) Define `RegisterOrganizationInput` to match the nested backend schema. 2) Align frontend validation with backend password requirements. 3) Return a typed registration result. 4) Adopt returned `user`, `organization`, and token in provider state before navigation. 5) Remove the swallowed catch and success toast on failure.
- **Tests required:** Signup with 6, 7, and 8+ character passwords; backend validation error; server unreachable; duplicate email; successful signup using returned IDs; refresh during onboarding; login after successful signup.
- **Dependencies or risks:** Requires agreement on whether onboarding creates the organization during initial signup or in the company-setup step. Do not retain or log passwords beyond the in-memory form lifecycle.

### F-02 — Session cookies are not included on normal cross-origin API calls

- **Finding ID:** F-02
- **Title:** Login/registration requests omit credentials needed to establish the refresh-cookie session
- **Severity:** P1 — High, conditional on the configured cross-origin deployment
- **Affected file(s):** [api.ts](./frontend/src/services/api.ts), [vite.config.ts](./frontend/vite.config.ts), backend `user.controller.ts`
- **Affected function/component:** `request`, `loginApi`, `registerOrganizationApi`, `executeTokenRefresh`
- **Evidence from the code:** `API_BASE_URL` defaults to `http://localhost:3000`; the Vite app runs on port 5173. The general `request` helper calls `fetch(url, { ...options, headers })` without `credentials: 'include'`. The refresh helper explicitly includes credentials. Backend login/registration create HttpOnly `token` and `refreshToken` cookies; access tokens expire after 15 minutes.
- **Current behavior:** With the default split-origin development configuration, browser fetch does not include credentials by default and does not accept cross-origin `Set-Cookie` credentials unless the request opts into credentials. The frontend stores the returned bearer token in local storage, so initial API calls can appear to work, while refresh depends on the cookie being available.
- **Root cause:** The API client mixes bearer-token storage with a cookie-backed refresh/session design but applies credential mode only to the refresh request.
- **Problem caused:** After access-token expiry, refresh may fail because the browser never stored/sent the refresh cookie; users can be unexpectedly signed out. Behavior can differ between same-origin deployments and the default local development configuration.
- **Recommended solution:** Adopt one explicit session strategy. For the existing HttpOnly-cookie design, include credentials consistently on auth and API requests, configure CORS with a specific allowed origin and credentials, and avoid storing access tokens in local storage where feasible. If bearer-only requests are intentional, redesign refresh around a securely managed cookie and test it end to end.
- **Suggested file separation, if applicable:** Centralize `credentials`, headers, base URL, refresh deduplication, and unauthorized handling in a single typed API client rather than per-function fetch behavior.
- **Implementation steps:** 1) Confirm frontend/backend origin topology in each environment. 2) Set the correct credential mode in the shared client. 3) Ensure Vite proxy or production reverse proxy behavior matches the base URL strategy. 4) Verify `Set-Cookie` and refresh in a real browser. 5) Remove local-storage token use if the cookie strategy is selected.
- **Tests required:** Browser login response cookie storage; `currentUserApi` with cookies; access-token expiry followed by refresh; expired/revoked refresh token; CORS preflight and credential checks for configured origins.
- **Dependencies or risks:** Cookie `SameSite`/`Secure`, domain, TLS, and CORS settings must be coordinated with backend deployment. Do not weaken HttpOnly or expose signing secrets to the frontend.

## 5. Complete Bug and Functional Issue Register

| ID | Severity | Type | Finding |
|---|---|---|---|
| F-01 | P1 | Confirmed frontend defect / backend contract typing | Signup can continue after registration failure and retains temporary IDs. |
| F-02 | P1 | Confirmed integration risk | Cross-origin auth requests omit credentials required for refresh-cookie continuity. |
| F-03 | P2 | Confirmed frontend/backend mismatch | Escalation helper sends `POST`; backend exposes `PATCH`. |
| F-04 | P2 | Confirmed frontend limitation | Project work-item loader requests only page 1 with limit 100. |
| F-05 | P1 | Confirmed frontend defect | Subtask, reschedule, and generated recurrence mutations are local-only. |
| F-06 | P2 | Confirmed reliability defect | Multiple optimistic writes report success before persistence and do not roll back; project loader also caches partial failure as loaded. |
| F-07 | P2 | Confirmed type/contract mismatch | Audit-log API type uses `meta`; backend and view use `pagination`, and the view expects `success` missing from the type. |
| F-08 | P2 | Confirmed quality/build-pipeline defect | Frontend typecheck fails; Vite build does not catch those errors. |
| F-09 | P2 | Confirmed architecture/performance concern | `AppContext` is a broad, un-memoized state and behavior surface. |
| F-10 | P2 | Confirmed scalability concern | Large static application bundle with no route-level lazy loading. |
| F-11 | P2 | Confirmed accessibility gap | Shared dialog does not implement focus containment or focus restoration. |
| F-12 | P2 | Confirmed feature gap | Chat attachment selection is explicitly not persisted or sent. |
| F-13 | P2 | Confirmed deployment risk | Hard-coded localhost API fallback can make a production build target each user's localhost. |
| F-14 | P3 | Recommendation | Reduce `any` and permissive index signatures in core models and API adapters. |

### F-03 — Escalation request method does not match the backend route

- **Finding ID:** F-03
- **Title:** Escalation attempts use `POST` where the backend only registers `PATCH`
- **Severity:** P2 — Medium
- **Affected file(s):** [api.ts](./frontend/src/services/api.ts), backend `routes/work.item.routes.ts`
- **Affected function/component:** `escalateWorkItemApi`, `escalateTask`, task escalation action in `TaskDetailsDrawer`
- **Evidence from the code:** `escalateWorkItemApi` submits `POST /api/work-items/:workItemId/escalate`; the backend route registers `PATCH /:workItemId/escalate`.
- **Current behavior:** The escalation action reaches no matching route and fails with a not-found/method response; the caller catches the error and displays it.
- **Root cause:** HTTP method drift between the frontend service and backend route contract.
- **Problem caused:** Users cannot trigger escalation from the UI through this API.
- **Recommended solution:** Change the client method to match the backend `PATCH` contract, or deliberately change both sides under an API contract/version decision.
- **Suggested file separation, if applicable:** Keep the endpoint in the work-item API module and add a contract test that asserts method, path, and payload.
- **Implementation steps:** 1) Align method and request shape. 2) Verify authorization and response mapping. 3) Add a test against the route contract.
- **Tests required:** Escalation success, permission denial, server validation failure, and persisted SLA state after reload.
- **Dependencies or risks:** Ensure escalation permissions continue to be enforced by backend middleware.

### F-04 — Projects silently omit work items beyond the first page

- **Finding ID:** F-04
- **Title:** Project loading fetches only the first 100 work items
- **Severity:** P2 — Medium
- **Affected file(s):** [AppContext.tsx](./frontend/src/state/AppContext.tsx), [api.ts](./frontend/src/services/api.ts), backend `task.controller.ts`
- **Affected function/component:** `fetchProjectAssets`, `getProjectWorkItemsApi`
- **Evidence from the code:** `fetchProjectAssets` invokes `getProjectWorkItemsApi(projId, 1, 100)` once. The backend accepts pagination and returns pagination metadata.
- **Current behavior:** Projects with more than 100 work items load only the first page into frontend state.
- **Root cause:** The loader treats a paginated endpoint as an unpaginated complete collection.
- **Problem caused:** Older or later-page tasks are absent from lists, task selection, scheduling, dependency calculations, and any view using the loaded collection.
- **Recommended solution:** Implement server-side pagination in the relevant views/data hooks, or fetch pages until complete if the product intentionally requires the entire project dataset in memory. Prefer view-specific pagination for scale.
- **Suggested file separation, if applicable:** Move paged work-item access into a project-work-items data hook and keep page state near list/board views.
- **Implementation steps:** 1) Define a typed paginated response. 2) Decide which views need all records. 3) Implement page loading/cursors and loading/error states. 4) Make counts and mutations invalidate or update the appropriate page.
- **Tests required:** 0, 100, 101, and multi-page records; page transitions; filters across pages; stale project response after switching projects.
- **Dependencies or risks:** Board/timeline calculations that require the complete dependency graph need either a dedicated aggregate endpoint or a documented data-loading strategy.

### F-05 — Several user-visible task mutations are not persisted

- **Finding ID:** F-05
- **Title:** Subtask, reschedule, and recurrence changes can be lost on reload
- **Severity:** P1 — High
- **Affected file(s):** [AppContext.tsx](./frontend/src/state/AppContext.tsx), [TaskDetailsDrawer.tsx](./frontend/src/components/tasks/TaskDetailsDrawer.tsx), [recurrence.ts](./frontend/src/domain/recurrence.ts)
- **Affected function/component:** `addSubtask`, `toggleSubtask`, `deleteSubtask`, `requestReschedule`, `confirmRescheduleImpact`, `changeTaskStatus`
- **Evidence from the code:** The subtask operations update `tasks` directly and do not call the work-item create/update/delete APIs. Rescheduling applies `applyScheduleChanges` to local tasks without sending the affected date changes to the backend. Completing a recurring task creates its next occurrence with `createNextRecurringTask` and inserts it into local state; no backend create request is made for that occurrence.
- **Current behavior:** The UI reflects these operations immediately, but the backend remains unchanged for those local-only records/fields.
- **Root cause:** Domain transformations and UI state updates are implemented in context, while persistence is wired separately and incompletely.
- **Problem caused:** Reloading or opening another session loses changes; other project members do not see them; computed schedules may disagree with persisted task dates.
- **Recommended solution:** Route these operations through explicit server mutations. Persist subtasks as first-class work items, send every affected date for a reschedule, and create recurrence occurrences on the backend (or through a transaction/scheduler). Show pending state and success only after authoritative completion.
- **Suggested file separation, if applicable:** Use typed work-item mutation functions in a feature API module and a `useWorkItemMutations` hook. Keep recurrence/scheduling calculations pure in the existing domain modules.
- **Implementation steps:** 1) Decide canonical API payloads for subtasks and cascade rescheduling. 2) Implement server-backed mutations. 3) Update local normalized state from server results. 4) Keep recurrence rule evaluation in domain code but persist generated instances. 5) Add migration for any persisted embedded subtasks if required.
- **Tests required:** Subtask create/edit/toggle/delete followed by reload; reschedule with dependent tasks followed by reload and a second user; recurring completion creates exactly one persisted occurrence; request failure does not display saved state.
- **Dependencies or risks:** Cascade changes should be atomic or have an explicit partial-failure contract to avoid only some dependent tasks shifting.

### F-06 — Optimistic writes can produce false success and project loads can cache partial failure

- **Finding ID:** F-06
- **Title:** Several mutations update local state before a best-effort API call and do not recover on failure
- **Severity:** P2 — Medium
- **Affected file(s):** [AppContext.tsx](./frontend/src/state/AppContext.tsx), [api.ts](./frontend/src/services/api.ts)
- **Affected function/component:** `changeTaskStatus`, `deleteTask`, `createProject`, `updateProject`, `deleteProject`, `removeProjectMember`, `updateProjectMemberRole`, `markNotificationRead`, `fetchProjectAssets`
- **Evidence from the code:** Some mutation functions update state and show success before calling APIs whose failures are only logged. `fetchProjectAssets` catches each request independently, but then records the project ID as loaded even if one or more requests failed; only the work-item request sets a visible project error.
- **Current behavior:** A failed write can leave the UI showing a change that the server rejected. A partial project load can be treated as complete and skipped on subsequent navigation unless explicitly forced.
- **Root cause:** Optimistic updates are not consistently modeled as pending mutations with rollback/reconciliation, and per-resource load results do not have a unified error state.
- **Problem caused:** Users may trust a change that was not saved; reload later reverses it. Missing project assets can persist for the session and error feedback may be absent.
- **Recommended solution:** For each mutation, either await the server before committing, or implement an explicit optimistic update with rollback on failure and clear pending/error feedback. Track per-resource load success and retry failed resources rather than marking the entire project loaded.
- **Suggested file separation, if applicable:** Centralize mutation lifecycle in typed data-access hooks; keep toast presentation in the UI layer. Model project loading as separate work-item, sprint, member, label, workflow, and audit statuses.
- **Implementation steps:** 1) Inventory every mutation function. 2) Define authoritative success/failure return contracts. 3) Add rollback or invalidate/refetch behavior. 4) Replace `console.warn`-only failures with visible error state where user action matters. 5) Set the loaded marker only for a complete or explicitly partial success.
- **Tests required:** Reject each write and assert rollback/error; retry failed project resource; switch projects during in-flight requests; ensure no stale response overwrites the active project.
- **Dependencies or risks:** Be explicit about operations that remain intentionally optimistic; do not make a rollback overwrite a newer successful update from another tab/user.

### F-07 — Audit-log response typing is inconsistent with backend and consumers

- **Finding ID:** F-07
- **Title:** Audit pagination uses three incompatible response shapes
- **Severity:** P2 — Medium
- **Affected file(s):** [api.ts](./frontend/src/services/api.ts), [ProjectActivityView.tsx](./frontend/src/features/project/ProjectActivityView.tsx), [ProjectSettingsView.tsx](./frontend/src/features/project/ProjectSettingsView.tsx), backend `auditlog.controller.ts`
- **Affected function/component:** `GetProjectAuditLogsResponse`, `getProjectAuditLogsApi`, `fetchAuditRecords`
- **Evidence from the code:** The frontend response type declares `data` and optional `meta`. The backend returns `success`, `data`, and `pagination`. Consumers read `res.success` and `res.pagination`. Current TypeScript errors report missing `success` and `pagination` on `GetProjectAuditLogsResponse`.
- **Current behavior:** Runtime response handling may work with the current backend shape, but the declared contract fails typechecking and does not protect callers from a backend shape change.
- **Root cause:** The response DTO was not updated alongside the backend pagination implementation and component consumers.
- **Problem caused:** Typecheck is blocked and audit pagination code can drift without compiler detection.
- **Recommended solution:** Define one response type that matches the actual backend contract, including `success`, `data`, and `pagination`; use the same type in both activity/settings views.
- **Suggested file separation, if applicable:** Put shared audit DTOs in a typed API contract module and keep display mapping in an audit feature adapter.
- **Implementation steps:** 1) Confirm whether `success` is required. 2) Rename `meta` to `pagination`. 3) Type audit entries. 4) Remove duplicate mapping/contract assumptions and restore a green typecheck.
- **Tests required:** API response mapping; page/limit/totalPages handling; empty result; malformed response; both audit surfaces.
- **Dependencies or risks:** If the backend contract intentionally changes, coordinate the response type and both consumers in the same change.

### F-08 — Frontend typecheck currently fails despite a successful production build

- **Finding ID:** F-08
- **Title:** `tsc --noEmit` reports unresolved imports and type errors
- **Severity:** P2 — Medium
- **Affected file(s):** [CreateTaskDialog.tsx](./frontend/src/components/CreateTaskDialog.tsx), [MyProjects.tsx](./frontend/src/components/MyProjects.tsx), [NeedsAttention.tsx](./frontend/src/components/NeedsAttention.tsx), [CompanySetupView.tsx](./frontend/src/features/onboarding/CompanySetupView.tsx), [ProjectActivityView.tsx](./frontend/src/features/project/ProjectActivityView.tsx), [ProjectSettingsView.tsx](./frontend/src/features/project/ProjectSettingsView.tsx)
- **Affected function/component:** TypeScript compilation of the frontend package
- **Evidence from the code:** `pnpm --dir frontend typecheck` reports missing `../data/mockData` imports in three components; an onboarding object is incompatible with `RegisterOrganizationInput`; and audit consumers access undeclared `success`/`pagination` fields. It also reports implicit `any` and possibly-undefined `currentProject` errors. `pnpm --dir frontend build` succeeds because Vite transpiles without enforcing TypeScript diagnostics.
- **Current behavior:** Production assets can be built while strict typechecking fails.
- **Root cause:** Typecheck is not part of the Vite build and stale/unused legacy components and API DTOs remain included by the TypeScript config.
- **Problem caused:** CI can ship code with unresolved type contracts, and refactors lose the compiler as a reliable safety net. Missing imports also indicate dead or stale components that still affect the project-wide typecheck.
- **Recommended solution:** Establish a required green typecheck. Remove or repair dead components intentionally; do not exclude errors through broad compiler suppression. Fix API DTOs and narrow optional values.
- **Suggested file separation, if applicable:** Keep current strict TypeScript configuration; move the legacy components only if they are still product surfaces, otherwise delete them after confirming they are unused in a separate approved code change.
- **Implementation steps:** 1) Decide whether the mock-data components are obsolete or need real data dependencies. 2) Fix the registration and audit response DTOs. 3) Narrow `currentProject` before use. 4) resolve implicit-any mapping. 5) Add typecheck to CI and preferably the standard build command.
- **Tests required:** Typecheck must pass; retain targeted API contract and component tests after cleanup.
- **Dependencies or risks:** The dead components may be referenced by an external/legacy entry point not present in the inspected `App.tsx`; verify application usage before removing them.

### F-09 — Global context combines unrelated responsibilities and rerenders broadly

- **Finding ID:** F-09
- **Title:** `AppContext` is a large application service and single shared render boundary
- **Severity:** P2 — Medium
- **Affected file(s):** [AppContext.tsx](./frontend/src/state/AppContext.tsx), [AppContextInstance.ts](./frontend/src/context/AppContextInstance.ts), [App.tsx](./frontend/src/App.tsx)
- **Affected function/component:** `AppProvider`, `fetchProjectAssets`, auth initialization, all mutation callbacks, context `value`
- **Evidence from the code:** `AppContext.tsx` is over 2,000 lines and owns route state, authentication, API loading/mapping, business mutations, notifications, toasts, local persistence, and cross-tab events. It constructs a new `value` object directly on each render without memoizing it. Numerous feature components consume this shared provider.
- **Current behavior:** Any provider state update changes the context value identity and can rerender all consumers, even when a consumer uses an unrelated field.
- **Root cause:** Context is being used as both global state store and data-access/service layer.
- **Problem caused:** Increasing render cost, harder testing, tightly coupled features, and greater risk of stale-state or mutation regressions.
- **Recommended solution:** Split by lifetime and domain rather than create a context per tiny value: session/auth; project/work-item server state; and transient UI state. Extract typed API adapters and pure mapping functions. Memoize provider values or use narrower contexts where profiling shows benefit.
- **Suggested file separation, if applicable:** `src/app/` for routing/shell; `src/features/auth/{api,hooks,components}`; `src/features/work-items/{api,hooks,components,types}`; `src/features/projects/{api,hooks,components}`; `src/shared/api/` for the HTTP client; retain pure functions in existing `src/domain/`.
- **Implementation steps:** 1) Add tests around current state transitions. 2) Extract API DTOs/mappers. 3) Move auth lifecycle out of the all-purpose provider. 4) Extract work-item/project mutation hooks. 5) Separate UI-only state. 6) Profile and narrow context subscriptions.
- **Tests required:** Provider behavior for auth, project switching, work-item mutation, and context consumer rerender behavior where measured.
- **Dependencies or risks:** Do not introduce a new global state or query package by default. Preserve current UX and backend cache/invalidation semantics during incremental extraction.

### F-10 — Route-level code splitting is absent and the entry chunk exceeds the warning threshold

- **Finding ID:** F-10
- **Title:** All major views are eagerly imported into a large initial bundle
- **Severity:** P2 — Medium
- **Affected file(s):** [App.tsx](./frontend/src/App.tsx), [vite.config.ts](./frontend/vite.config.ts)
- **Affected function/component:** `MainAppShell` and its feature view imports
- **Evidence from the code:** All views are static imports in `App.tsx`. The production build reports one 668.55 kB minified JS asset and emits the configured Vite/Rolldown warning for chunks over 500 kB.
- **Current behavior:** Users download substantial code for features they may not open, including chat and project views.
- **Root cause:** Feature view boundaries are not used as dynamic-import boundaries.
- **Problem caused:** Slower first load and larger transfer/parse cost, especially on mobile or slower networks.
- **Recommended solution:** Lazy-load substantial route/view modules using `React.lazy` and `Suspense`; measure chunk changes and keep small shared UI in the initial chunk.
- **Suggested file separation, if applicable:** Keep feature folders as current code-splitting boundaries; add a route/view loading fallback in the app shell.
- **Implementation steps:** 1) Identify the largest route chunks. 2) Lazy-load independently navigable views. 3) Add accessible loading fallbacks. 4) Rebuild and compare initial JS and route chunks.
- **Tests required:** Build chunk-size report; route render/loading fallback tests; direct hash navigation to lazy routes.
- **Dependencies or risks:** Avoid splitting tiny components or creating excessive network round-trips; validate deployment base paths and direct route navigation.

### F-11 — Shared dialog does not manage keyboard focus

- **Finding ID:** F-11
- **Title:** Dialogs expose dialog semantics but do not trap or restore focus
- **Severity:** P2 — Medium
- **Affected file(s):** [Dialog.tsx](./frontend/src/components/ui/Dialog.tsx)
- **Affected function/component:** `Dialog`
- **Evidence from the code:** The shared component sets `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`, and handles Escape, but it does not move focus into the dialog, constrain Tab navigation, or restore focus to the opener. It uses a fixed `dialog-title` ID.
- **Current behavior:** Keyboard and assistive-technology users can tab into background content while a modal is open, and closing the modal does not return focus to the triggering control.
- **Root cause:** The component implements visual/modal semantics without complete focus lifecycle behavior.
- **Problem caused:** Users may lose their position, interact with background controls, or have an inaccessible modal experience.
- **Recommended solution:** Implement an accessible focus lifecycle, unique title IDs, focus containment, focus restoration, and preservation of pre-existing body overflow state. Prefer an established accessible dialog primitive if the project later adopts one.
- **Suggested file separation, if applicable:** Keep modal behavior centralized in `components/ui/Dialog.tsx` so all dialogs inherit the fix.
- **Implementation steps:** 1) Capture opener and prior body overflow. 2) Focus the dialog or first eligible control. 3) Trap Tab/Shift+Tab. 4) Restore focus and prior overflow on close/unmount. 5) Ensure unique accessible naming.
- **Tests required:** Keyboard-only open/tab/escape/close; focus restoration; nested or sequential dialogs; screen-reader name association.
- **Dependencies or risks:** Confirm every existing dialog use remains compatible and does not create competing global focus handlers.

### F-12 — Chat attachments are accepted in the composer but never sent

- **Finding ID:** F-12
- **Title:** Chat attachment selection is a UI-only placeholder
- **Severity:** P2 — Medium
- **Affected file(s):** [ChatView.tsx](./frontend/src/features/chat/ChatView.tsx), [api.ts](./frontend/src/services/api.ts)
- **Affected function/component:** `handleFileSelect`, `handleMediaSelect`, `handleSendMessage`
- **Evidence from the code:** `handleSendMessage` sends only `{ event, conversationId, content }` over the WebSocket. When an attachment is queued, it explicitly warns that the attachment was not sent and clears the pending attachment. No chat attachment upload API is declared in the frontend service.
- **Current behavior:** A user can select a file and compose a message, but only the text is persisted; the file is discarded after send.
- **Root cause:** Attachment picker UI was added without an upload/storage/message contract.
- **Problem caused:** Chat attachment actions do not deliver their intended content and can surprise users despite the toast.
- **Recommended solution:** Either disable/hide attachment actions until supported or implement a backend upload and message-attachment contract with progress, retry, and persisted metadata.
- **Suggested file separation, if applicable:** Extract chat attachment selection/upload/preview lifecycle into a chat-specific hook or service once the server contract exists.
- **Implementation steps:** 1) Define backend storage and authorization contract. 2) Upload file and receive persisted attachment metadata. 3) Send message with metadata. 4) Render/download with authorization and safe content handling. 5) Remove placeholder success wording.
- **Tests required:** File and media upload, rejected/oversized file, failed upload retry, text-only compatibility, persisted attachment retrieval and permission denial.
- **Dependencies or risks:** Backend attachment API is a dependency; no frontend-only solution can persist a chat file for other users.

### F-13 — Localhost API fallback is unsafe as a production default

- **Finding ID:** F-13
- **Title:** Missing API environment configuration sends production traffic to the user's localhost
- **Severity:** P1 — High if deployed without `VITE_API_URL`; otherwise P2 operational risk
- **Affected file(s):** [api.ts](./frontend/src/services/api.ts), [vite.config.ts](./frontend/vite.config.ts)
- **Affected function/component:** `API_BASE_URL`
- **Evidence from the code:** The fallback is `http://localhost:3000`. Vite's `/api` proxy does not affect the service because the client constructs absolute URLs using this base.
- **Current behavior:** A built frontend without `VITE_API_URL` tries to call a backend on the end user's own machine rather than the deployed backend.
- **Root cause:** Development fallback is treated as a general runtime default, while the service bypasses the relative-path proxy.
- **Problem caused:** Production API operations fail unless deployment injects the variable correctly; HTTPS deployments may also encounter mixed-content restrictions.
- **Recommended solution:** Use a same-origin relative API base by default with a reverse proxy, or fail fast with a clear configuration error in production. Keep the localhost fallback development-only.
- **Suggested file separation, if applicable:** Put environment resolution in a small shared configuration module and validate required production settings at startup/build time.
- **Implementation steps:** 1) Choose same-origin proxy versus explicit service origin. 2) Add typed environment validation. 3) restrict localhost fallback to development. 4) verify production build output and browser network destination.
- **Tests required:** Build with/without env values; same-origin and configured cross-origin API requests; no production request to localhost.
- **Dependencies or risks:** Coordinate reverse-proxy, CORS, cookies, and `VITE_API_URL` in deployment configuration.

### F-14 — Core types and API adapters are excessively permissive

- **Finding ID:** F-14
- **Title:** `any` and open-ended entity fields weaken API and domain guarantees
- **Severity:** P3 — Low individually; compounding maintainability risk
- **Affected file(s):** [types/index.ts](./frontend/src/types/index.ts), [api.ts](./frontend/src/services/api.ts), [AppContext.tsx](./frontend/src/state/AppContext.tsx)
- **Affected function/component:** `Task`, `Project`, `Sprint`, `Notification`, `AuditLogEntry`, `AppContextValue`, backend mapping functions
- **Evidence from the code:** Multiple domain interfaces contain `[key: string]: any`; API helpers return `Promise<any>`; task mutation and mapping logic accepts `any`.
- **Current behavior:** Backend and frontend property drift is not caught at compile time, and callers must infer response shape.
- **Root cause:** DTOs, frontend view models, and legacy fields have accumulated in shared interfaces without a clear boundary.
- **Problem caused:** Invalid fields, nullable values, status enums, and payload shapes can pass unchecked and create runtime-only failures.
- **Recommended solution:** Define backend DTOs separately from normalized frontend domain types. Use runtime guards for untrusted JSON at the API boundary, then typed mapping functions. Narrow unions and nullability before removing legacy properties.
- **Suggested file separation, if applicable:** `features/*/api-contracts.ts` for endpoint DTOs, `types/` for shared domain models, and `services/mappers/` for conversion.
- **Implementation steps:** 1) Fix current typecheck errors. 2) Prioritize auth, work-item, project, and audit contracts. 3) Replace `any` at request boundaries with `unknown` plus validation. 4) Remove open index signatures after migration.
- **Tests required:** Mapper tests for nullable/legacy backend values; API response validation; compile-time checks for payload construction.
- **Dependencies or risks:** Requires staged migration because UI code currently uses flexible legacy fields; do not replace them with inaccurate narrow types.

## 6. Separation-of-Concerns Recommendations

### Application shell and routing

- **Existing:** [App.tsx](./frontend/src/App.tsx) combines route selection, auth/onboarding checks, project-access rendering, modal composition, and shell state. Route parsing is also in `AppContext`.
- **Extract:** A route parser/normalizer and a small shell component. Keep hash navigation if desired; a routing-library migration is not required for the fixes identified.
- **Suggested destination:** `src/app/navigation/hashRoutes.ts` and `src/app/AppShell.tsx`.
- **New responsibilities:** Parse/normalize routes in one place; shell composes global navigation, route outlet, and overlays.
- **Original use:** `App` provides contexts and renders the shell; the shell uses a typed route result rather than parsing arbitrary strings in multiple places.
- **Data/dependencies:** Current hash, navigation callback, authenticated session, and project access result.
- **Benefits/risks/migration:** Centralizes route semantics and makes deep links testable. Preserve legacy `/dashboard`, `/workflow`, and `/dependencies` normalization covered by current tests.

### Auth/session

- **Existing:** [AuthView.tsx](./frontend/src/features/auth/AuthView.tsx), [CompanySetupView.tsx](./frontend/src/features/onboarding/CompanySetupView.tsx), and the main context jointly own signup, login, registration, token handling, identity mapping, onboarding, and logout.
- **Extract:** A typed auth API contract/client wrapper and a `useSession`/session provider responsible only for canonical session identity and initialization.
- **Suggested destination:** `src/features/auth/api.ts`, `src/features/auth/session.ts` or `useSession.ts`, with onboarding UI remaining feature-local.
- **New responsibilities:** Typed signup/login/refresh/logout; initialize, update, and clear the canonical user/org; expose explicit loading/error state.
- **Original use:** Forms call typed auth operations and display returned errors. They do not generate or substitute authoritative user IDs.
- **Data/dependencies:** Signup credentials and organization name; backend user/org response; cookie/session state.
- **Benefits/risks/migration:** Removes identity ambiguity and enables isolated auth testing. Coordinate the cookie strategy with backend deployment.

### Project/work-item data access

- **Existing:** [api.ts](./frontend/src/services/api.ts) includes all endpoint families; [AppContext.tsx](./frontend/src/state/AppContext.tsx) loads six project resources and owns all mutations and mapping.
- **Extract:** Feature-level API modules, typed DTOs, pure mappers, and focused hooks for project work items, sprints, labels/workflows, and audit data.
- **Suggested destination:** `src/features/work-items/api.ts`, `src/features/work-items/mappers.ts`, `src/features/work-items/hooks/`; analogous `projects`, `sprints`, and `audit` modules; retain `src/domain/` for pure business logic.
- **New responsibilities:** API functions perform transport; mappers normalize responses; hooks track loading/error/pending/invalidation; components render data and call mutations.
- **Original use:** Pages request only the state they need, rather than consuming the entire global entity graph.
- **Data/dependencies:** Project ID, pagination/filter state, authenticated API client, typed server responses.
- **Benefits/risks/migration:** Better test isolation and smaller rerender boundaries. Avoid changing persistence semantics and pagination behavior during extraction.

### Form and validation boundaries

- **Existing:** Auth, onboarding, task, and settings forms keep validation inline.
- **Extract:** Only shared domain schemas/validators where the same rule is used by multiple forms or must mirror an API contract. Keep field presentation in the component.
- **Suggested destination:** `src/features/auth/validation.ts`, `src/features/work-items/validation.ts`, plus API contract types.
- **New responsibilities:** Normalize input, return typed field errors, and align client constraints with backend rules.
- **Original use:** Components call validation before submit and still treat backend validation as authoritative.
- **Data/dependencies:** Form values and backend constraints.
- **Benefits/risks/migration:** Reduces mismatch such as 6-character client password vs 8-character backend minimum. Do not create a generalized form abstraction for one-off fields.

### Chat collaboration and attachments

- **Existing:** [ChatView.tsx](./frontend/src/features/chat/ChatView.tsx) owns conversation fetching, WebSocket setup, message parsing, composer, emoji picker, and attachment preview state.
- **Extract:** A chat connection hook/service and attachment hook once the backend file contract exists.
- **Suggested destination:** `src/features/chat/useChatConnection.ts`, `chat/api.ts`, and `chat/attachments.ts`.
- **New responsibilities:** Connection lifecycle/auth/error handling; message transport; attachment upload and URL cleanup.
- **Original use:** The view renders conversation selection, message history, and composer based on typed hook state.
- **Data/dependencies:** User identity, selected conversation, API client/WebSocket endpoint, attachment metadata.
- **Benefits/risks/migration:** Makes socket lifecycle independently testable and keeps the view manageable. Preserve the existing cleanup behavior and verify reconnect semantics before adding reconnection logic.

## 7. State Management Audit

- **Excessive centralization:** `AppContext` is the de facto store for server entities and transient UI state. This is not automatically wrong for a small app, but its current size and responsibilities make updates difficult to reason about.
- **Multiple sources of truth:** Backend entities, local `tasks/projects` arrays, generated IDs, local storage identity, and broadcast messages can all represent related state. A subset of changes are persisted, while others are only local.
- **Derived state:** Current project, workflow, project tasks, personal tasks, sprints, and labels are derived with memoized selectors, which is preferable to duplicating those values in state.
- **Cache/invalidation:** `fetchProjectAssets` has a per-project loaded marker but no resource-level cache invalidation or pagination loop. A failed resource can be left stale until forced reload.
- **Optimistic updates:** Some writes wait for the backend and return explicit errors; others update first, show success, and only log the backend failure. There is no common rollback policy.
- **Cross-tab state:** Broadcast events update local work-item arrays; the server remains the true shared source only for mutations successfully persisted.
- **Unmount/race behavior:** Project fetches use a sequence ref to ignore stale responses, which is a positive safeguard. The implementation should be tested for cleanup and retry behavior after project switch/unmount.
- **Recommendation:** Keep pure derived data computed, avoid introducing a new store solely to split files, and separate remote-data lifecycle from transient UI state. Use an explicit mutation contract for pending/success/error and invalidate/refetch after writes where reconciliation is required.

## 8. Frontend–Backend Contract Audit

| Area | Frontend | Backend evidence | Assessment |
|---|---|---|---|
| Login/register | `POST /api/users/login`, `POST /api/users/register` | Routes exist; login and register return tokens/user/org and set HttpOnly cookies | Endpoint paths align. Credential mode and onboarding response adoption do not. |
| Current user/refresh | `GET /api/users/me`, `POST /api/users/refresh` | `me` is protected; refresh reads `refreshToken` cookie and rotates session | Refresh function opts into credentials, but normal auth requests do not. |
| Project CRUD | `/api/projects` and `/api/projects/:id` with GET/POST/PATCH/DELETE | Matching project routes and permission middleware exist | Broad path/method alignment; persistence behavior in context is inconsistent. |
| Work-item list | `/api/work-items/project/:id?page=...&limit=...` | Backend validates pagination and returns pagination metadata | Path aligns; frontend loads only page 1/100. |
| Work-item create/update/delete | POST collection, PATCH/DELETE item | Matching routes exist with auth and project permission middleware | Basic contract aligns; some other local mutations bypass these APIs. |
| Attachments | POST `/:workItemId/attachments`, multipart `attachments` | Backend route uses upload middleware and controller | Work-item upload path and field name align. Chat attachments have no API. |
| Escalation | `POST /:workItemId/escalate` | Backend route is `PATCH /:workItemId/escalate` | **Confirmed mismatch; frontend action fails.** |
| Sprints | `/api/projects/:projectId/sprints` GET/POST | Backend exposes matching GET/POST routes | Basic path/method alignment. |
| Comments/time/dependencies | Work-item subresource paths and JSON payloads | Matching routes/controllers exist | Paths align; UI local optimistic status and broader mutation/error handling need consistency. |
| Project workflow | Frontend GET/PUT | Backend GET plus POST and PUT | PUT is supported. |
| Audit logs | Frontend type declares `meta`; consumers use `success`/`pagination` | Backend returns `success`, `data`, `pagination` | Runtime shape and frontend type disagree; typecheck fails. |
| Authorization | Client route/role guards | Inspected project/work-item routes apply authentication and permission middleware | Client checks are UX only; server enforcement must remain the security boundary. |
| Date/nullable/enum mapping | Frontend mapper functions and string unions | Backend uses its own entity enums and nullable values | Mappers exist, but broad `any` and duplicate optional fields make drift difficult to detect. Add contract tests for nulls, dates, status/type/priority mappings. |

### Finding classification

1. **Confirmed frontend defects:** Signup success/persistence handling (F-01), local-only work-item operations (F-05), false-success optimistic paths and partial-load caching (F-06), first-page-only work-item loading (F-04), chat attachment placeholder (F-12).
2. **Frontend/backend contract mismatches:** Cookie credential mode (F-02), escalation HTTP method (F-03), audit response shape/type (F-07), signup DTO type versus nested payload (F-01).
3. **Backend defects affecting frontend behavior:** No backend-only defect was confirmed in the scoped contract review. The backend supports the inspected task/project/sprint/audit routes and applies permission middleware; the frontend must still use the correct method and response contract.
4. **Unverified assumptions requiring further investigation:** Production proxy/origin configuration and whether a deployment always sets `VITE_API_URL`; whether chat attachment support is intentionally deferred; actual browser cookie behavior in each deployment; server-side recurrence/cascade semantics outside the inspected API paths.

## 9. Authentication, Authorization, and Security Audit

- **Signup:** See F-01. The UI accepts a weaker password than backend validation and treats a failed server registration as local success.
- **Token handling:** The access token is stored in local storage (`taskflow_auth_token`). This is accessible to any script executing in the origin, unlike the backend's HttpOnly cookies. No direct XSS sink was found in the searched frontend source, so this is a risk exposure, not evidence of an exploitable XSS.
- **Cookie handling:** See F-02. Browser credential behavior must be verified with actual configured origins.
- **Protected routes:** `App.tsx` routes unauthenticated users to login and blocks incomplete onboarding. These guards can be bypassed in the browser and do not replace backend authorization.
- **Backend authorization:** The inspected project and work-item routes apply `isLoggedIn`, permission checks, and/or project-permission middleware. Continue validating authorization on every read/write endpoint, including WebSocket upgrades and file downloads.
- **Project access UI:** Frontend project checks improve UX but must not be used to protect data. The backend must enforce organization membership, project visibility, and role permissions on every request.
- **Input validation:** Client validation is for usability only. Backend Joi/route validation remains mandatory; keep rules aligned, particularly signup password constraints.
- **Rich text and HTML:** No `dangerouslySetInnerHTML` usage was found in the searched frontend source. Comments and chat messages should continue to render as text unless a sanitized rich-text pipeline is introduced. There was no frontend wiki/Yjs editor observed in the inspected tree.
- **Attachments:** Work-item file validation in the client is not a security boundary. Backend must enforce actual MIME/content checks, size limits, access control, storage isolation, and safe download headers.
- **Secrets/configuration:** No JWT signing/database/SMTP secret was found in the frontend source examined. Keep those values server-only. Public API origin configuration is not a secret.
- **Recommended priority:** Resolve the session-cookie strategy and token storage before expanding auth features. Add server authorization tests for project boundaries; client role visibility is not security enforcement.

## 10. Performance and Scalability Audit

- **Initial bundle:** Build output is 668.55 kB minified JS and triggers the >500 kB chunk warning. Split substantial top-level views by route.
- **Rendering:** The provider builds a new value object each render and exposes unrelated state together. Profile before adding `memo` broadly; a smaller set of domain providers/hooks is the structural fix.
- **Collection size:** Project load is limited to 100 work items. Add pagination or view-specific loading before project data grows.
- **Fetching:** Project assets are requested in parallel, which is beneficial. However, each error is caught independently and the project can still be marked loaded, preventing an automatic retry.
- **Chat:** WebSocket lifecycle is cleaned up when the selected conversation changes, which is positive. Message JSON is parsed without a local parse guard; malformed server payloads could throw in the socket handler. Add defensive validation and a user-visible connection state if reconnect behavior is introduced.
- **Large components:** `AppContext.tsx`, `TaskDetailsDrawer.tsx`, `ChatView.tsx`, and `ProjectSettingsView.tsx` are large feature modules. Their complexity creates maintenance and testing cost; split by cohesive responsibility rather than applying memoization to every child.
- **List virtualization:** Not recommended as an immediate change without evidence of rendered list sizes or frame drops. First paginate and measure real project datasets.
- **Yjs/editor lifecycle:** No Yjs package or frontend document/editor lifecycle was found in the inspected source/dependencies. Not assessed as an existing feature.

## 11. UI/UX and Accessibility Audit

- **Positive evidence:** Shared inputs expose labels; several controls provide `aria-label`; auth errors use `role="alert"`; the dialog uses `role="dialog"` and `aria-modal`.
- **Dialog focus:** See F-11. Escape handling is present, but focus containment and restoration are absent.
- **Mutation feedback:** Success messages are not uniformly tied to server confirmation. F-01, F-05, and F-06 make the displayed success unreliable in key workflows.
- **Loading/error/empty states:** Some feature views have custom loading and error state; project asset errors are not comprehensive, and API helpers for notifications return empty-looking fallback data after failure.
- **Responsive behavior and contrast:** Utility classes and responsive layouts are present in inspected components, but no browser/viewport or automated contrast test was run. Do not claim full WCAG conformance without those checks.
- **Destructive actions:** A complete confirmation audit across all screens was outside the focused code review. Verify delete/role removal confirmation and keyboard behavior in dedicated component tests.
- **Recommendations:** Use shared pending/disabled/error states for mutations; ensure form errors are associated with fields; preserve focus through modal lifecycle; test keyboard navigation and narrow-screen layouts for create/edit drawers and project navigation.

## 12. TypeScript and Code Quality Audit

- TypeScript `strict` is enabled in `frontend/tsconfig.json`, which is a good foundation. The current typecheck fails, so strictness is not presently a reliable guard.
- Core interfaces in `types/index.ts` include open-ended `any` index signatures and duplicate/legacy fields such as `estimatedHours`/`estimateHours`, `assigneeId`/`assigneeIds`, comment `text`/`body`, and multiple date/priority variants. These make the normalized model unclear.
- `services/api.ts` exposes many `Promise<any>` functions and accepts `any` payloads; backend-to-frontend mappers also accept `any`.
- Error handling uses `any` catches and several broad catch/default paths. Preserve visible error behavior for user-triggered operations; reserve safe defaults for genuinely non-blocking features and expose degraded state.
- `App.tsx` implements custom route matching and a large conditional route tree. `AppContext.tsx` contains broad orchestration and data mutation logic.
- `ProjectActivityView` imports actor/entity/action formatting helpers from `ProjectSettingsView`, coupling separate screens to a large page module. Move shared audit presentation/mapping utilities into an audit feature module.
- Three legacy components import missing `../data/mockData` paths and are not imported by the inspected main app shell. Confirm whether they are dead before removal; their presence currently blocks typecheck.
- There is no evidence from the reviewed scope that unused imports or unreachable branches are a widespread issue; lint was not run as a separate audit check.

## 13. Testing Gaps and Test Plan

### Existing test evidence

`pnpm --dir frontend test` completed with **207 passing tests, 0 failures, across 52 suites**. The tests use Node's test runner through `tsx` and are stored as `.test.ts`. The frontend package does not declare React Testing Library, a DOM environment, or Playwright/Cypress.

`pnpm --dir frontend typecheck` failed with the diagnostics described in F-08. `pnpm --dir frontend build` succeeded and emitted the large-chunk warning in F-10.

### Recommended tests by level

| Level | Scope and high-value cases |
|---|---|
| Unit | Backend-to-frontend mappers; status/type/priority conversions; date/null handling; hierarchy/dependency/scheduling/recurrence invariants; input validation; API error parsing. |
| API contract | Auth cookies and payloads; escalation method; audit pagination shape; work-item pagination; attachment multipart field; sprint/work-item DTOs. Mock fetch for transport tests and run integration tests against backend routes for critical contracts. |
| Component | Signup and onboarding validation/error states; task create/edit form submission; duplicate submission lock; attachment upload failure/retry; empty/loading/error views; dialog keyboard/focus behavior; disabled/pending states. |
| Integration | Login, session initialization, project switch, task create/update/delete/assignment, sprint membership, comments/time entries/dependencies, notification read state, workflow save, and audit pagination with provider/API boundaries. |
| End-to-end | Signup and reload; login and refresh after access-token expiry; project access boundary; create task with attachments; edit and reload; recurrence; cross-project navigation; chat text and attachment behavior. |
| Accessibility | Keyboard-only dialog flow, accessible names/field errors, focus restoration, screen-reader announcements for async mutations, contrast checks, and responsive viewport smoke tests. |

Do not add a test dependency until the team selects the desired component/E2E runner. Existing `tsx --test` remains appropriate for pure TypeScript unit and API-client tests but cannot validate browser focus, rendering, cookies, or layout.

## 14. Readiness for Future Features

| Feature | Reusable foundation | Missing capability / likely change | Recommended sequence |
|---|---|---|---|
| Gantt / critical path | `domain/criticalPath.ts`, `domain/scheduling.ts`, dependencies, timeline view | Complete paginated data, persisted schedule mutations, scalable timeline rendering | Fix persistence and pagination; add schedule API contract; add integration tests; then implement chart. |
| Task dependencies | `domain/dependencyGraph.ts`, `DependenciesView`, work-item dependency endpoints | Consistent server-authoritative mutation/rollback and complete project graph | Fix mutation lifecycle and pagination; validate cycle rules on backend; then expand dependency UX. |
| Team workload/capacity | Assignees, time entries, project members, scheduling helpers | Reliable persisted time entries and a workload aggregation endpoint; filters across projects | Normalize task/time-entry contracts; implement aggregation; add tests; build visualization. |
| Analytics/sprint reports | Dashboard and audit API helpers, sprint model/views | Typed aggregate contracts, pagination/time-window semantics, caching | Define report DTOs and backend query boundaries; add API/integration tests; then dashboards. |
| Workflow automation | Workflow builder, status mapping, workflow endpoints, role permission utility | Backend-authoritative custom transitions and rules; current client role checks are not sufficient | Contract tests; persist workflow transitions/rules; build automation execution/observability. |
| Custom statuses/approval | Workflow types and settings UI | Typed statuses and server-enforced transition authorization | Make transition contract authoritative; test role boundaries; then add approval states. |
| Time tracking | Drawer, time-entry API, local duration calculation | Failed writes currently leave optimistic values; no reliable server reconciliation in all views | Fix time-entry mutation lifecycle and date handling; add reporting endpoint; then expand timers. |
| Milestones/release planning | Projects, sprint dates, hierarchy and scheduling domain helpers | No identified milestone/release entity or API contract in inspected source | Define domain/API model first; reuse project and timeline surface after persistence design. |
| AI-assisted task creation/summaries | Task create form, work-item types, API client | No AI service or permission/consent boundary observed | Define data handling, backend proxy, and review/approval UX before frontend integration. |
| Cross-project reporting | Projects, personal dashboard API, audit records | Current project loader is scoped to one project and returns only first page; no confirmed aggregate contract | Add typed cross-project backend aggregation with organization access boundaries, then filters and reporting UI. |
| Advanced search/templates | Global search modal and project creation UI | Search scope/index and template persistence contract not established in inspected code | Define server query/template DTOs, then build paginated results and reusable project templates. |
| Wiki / Yjs collaboration | No matching frontend package, editor, or Yjs lifecycle observed | No frontend wiki/Yjs surface identified; cannot assess its synchronization readiness | Treat as a separate future feature: define document persistence, authorization, collaboration service, and editor lifecycle before UI implementation. |

The existing domain modules are useful feature accelerators, but future work depends on first making the server contract, paging, and mutation semantics authoritative. Otherwise advanced views would amplify stale or incomplete state.

## 15. Recommended Refactoring Plan

1. **Restore correctness gates:** Make frontend typecheck pass and keep it required alongside tests/build. Resolve the legacy missing imports and API DTO mismatches.
2. **Stabilize auth:** Define one signup request/response contract, align validation, use backend IDs immediately, and test cookie-based session refresh in a browser.
3. **Create API contracts:** Replace the most consequential `any` types first: auth, project list/detail, work item, pagination, audit, attachment, and sprint.
4. **Make writes reliable:** Document which operations are optimistic. Implement server-confirmed updates or rollback/refetch on failure. Persist subtask, reschedule, and recurrence operations.
5. **Fix feature integration:** Align escalation method; implement work-item pagination; add explicit chat attachment capability state or the full backend contract.
6. **Extract by domain:** Move API contracts/mappers and data hooks from the large context into feature modules. Split transient UI from server entities. Keep domain algorithms pure.
7. **Improve accessibility:** Update shared dialog focus lifecycle and test forms, drawers, notifications, keyboard behavior, and responsive layouts.
8. **Optimize measured hotspots:** Lazy-load substantial views, then profile provider rerenders and large project lists. Add virtualization only if measurement justifies it.

## 16. Prioritized Implementation Roadmap

### Phase 0 — Release blockers / high risk

- Fix signup validation, registration error handling, and authoritative user/organization adoption (F-01).
- Align credential/cookie behavior with deployment origin and verify session refresh (F-02).
- Ensure production API base cannot silently default to end-user localhost (F-13).
- Persist local-only subtask, recurrence, and scheduling mutations or remove misleading success behavior (F-05).

### Phase 1 — Integration and data reliability

- Correct escalation method (F-03).
- Implement full work-item pagination (F-04).
- Define uniform mutation success/rollback/reload behavior and recover partial project loads (F-06).
- Correct audit response types and consumers (F-07).

### Phase 2 — Engineering quality and usability

- Restore passing typecheck (F-08) and reduce broad `any` at API/domain boundaries (F-14).
- Add component and browser-level tests for signup, session refresh, mutations, permissions, and attachments.
- Complete dialog keyboard focus lifecycle (F-11).
- Make chat attachment status explicit and implement only when backend support is available (F-12).

### Phase 3 — Scalability and future features

- Extract API/data-access responsibilities from `AppContext` (F-09).
- Lazy-load substantial views and validate bundle improvement (F-10).
- Build feature work on typed paginated data and reliable mutation APIs.
- Add future analytics/workload/wiki capabilities only after defining backend contracts and access rules.

## 17. Final Assessment and Recommendations

The frontend has a usable foundation: React/Vite, strict TypeScript intent, a central API layer, domain algorithms, feature-oriented folders, a design system, and a passing 207-test Node suite. The production build also succeeds.

The most important issue is the gap between what the interface displays and what the backend has actually accepted or persisted. Signup can advance after registration failure, some task operations are local-only, several API failures only produce a console warning, and project loading can cache incomplete results. These behaviors undermine trust and become more costly as project collaboration, reporting, and automation expand.

Prioritize auth correctness, persistence consistency, pagination, and contract/typecheck repair before adding new capabilities. Then extract the existing state/data responsibilities incrementally, add browser-level coverage for the workflows that cannot be validated by pure Node tests, and optimize the bundle using route boundaries. Preserve backend authorization as the security boundary; frontend route and role checks are not sufficient access controls.

### Inspection scope and limitations

The source tree and package configuration were mapped, and the audit directly reviewed app entry/routing, the shared context, API service, types, auth/onboarding, task creation/attachments/details, chat lifecycle, project activity/settings, shared dialog/theme/storage, the relevant backend user/project/work-item/sprint/chat/audit routes/controllers, and the backend WebSocket gateway. The frontend source tree contains numerous additional feature and component files; not every render branch or every CSS token was manually reviewed line by line.

Automated validation performed:

- `pnpm --dir frontend test`: 207 passed, 0 failed, 52 suites.
- `pnpm --dir frontend typecheck`: failed with the diagnostics summarized in F-08.
- `pnpm --dir frontend build`: succeeded; one 668.55 kB minified JavaScript chunk warning.

No browser session, visual regression run, accessibility scanner, production environment configuration, or live backend session was available for this audit. Therefore, exact browser cookie behavior, contrast compliance, all responsive breakpoints, and deferred chat attachment behavior require verification in their target environments. No source files or dependencies were modified.
