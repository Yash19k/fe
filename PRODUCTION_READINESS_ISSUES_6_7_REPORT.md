# Production Readiness Issues 6 and 7

## Summary

Implemented tighter route/request validation, removed unused direct dependencies, resolved the reported `minimatch` advisory, and coordinated graceful shutdown across schedulers, network servers, and the database. Changes are backend-only; existing route aliases and their authorization behavior are preserved.

## Issue 6: Route, request, and dependency readiness

- Added shared UUID route-parameter validation and applied it to UUID-based route parameters across the affected route modules. Request validation now rejects malformed pagination values and invalid request bodies on the covered endpoints with `VALIDATION_ERROR` responses.
- Tightened the related project, work-item, whiteboard, chat, and sprint validation paths. The current route-table test detects duplicate method/path registrations; none were found.
- Confirmed `/api/organizations` and `/api/organization` share the organization router, and `/api/sla` and `/api/organization/sla` share the SLA router. These aliases remain intentional.
- Removed unused direct dependencies (`express-session`, `ioredis`, `ts-node-dev`, and the direct `pnpm` dependency). `ioredis` remains in the pnpm resolution graph only as a TypeORM optional peer; it is not an application-level direct dependency. No Redis service or other infrastructure was added.
- Added a `nodemon`-scoped `minimatch` override to `11.0.1` and synchronized both lockfiles. The `nodemon` matching code was exercised against the resolved minimatch API.
- Dependency audits reported no known vulnerabilities. The frontend audit also reported no known vulnerabilities.

### Dependency version notices

The version check found these newer releases; they were not broadly upgraded as part of this focused remediation:

- Backend: `@types/node` 26.6.5 → 26.6.6; `dotenv` 18.0.7 → 18.0.9; `ws` 8.22.0 → 8.22.1; `croner` 10.0.1 → 11.0.0; TypeScript 5.9.3 → 7.0.2.
- Frontend: `react` and `react-dom` 19.3.0 → 19.3.1; Vite 8.3.4 → 8.3.5; `lucide-react` 1.55.0 → 1.66.0; Oxlint 1.87.0 → 1.90.0.

These are version notices, not findings from the vulnerability audits. The `croner` and TypeScript updates are major-version changes and were left for a separately scoped upgrade.

## Issue 7: Coordinated graceful shutdown

- SIGINT and SIGTERM share a one-shot shutdown operation, so duplicate signals do not start concurrent cleanup.
- Shutdown stops new scheduler work, stops both Croner jobs, and waits for active scheduler tasks. It closes Socket.IO and chat WebSocket connections and waits for HTTP shutdown before destroying the initialized TypeORM data source.
- Cleanup failures are reported and surfaced. A 15-second default timeout invokes the forced-close path rather than allowing cleanup to wait indefinitely.
- Startup and HTTP-server errors now attempt orderly scheduler/database cleanup.

## Verification

| Check | Result |
|---|---|
| Focused route-validation and graceful-shutdown tests | 12 passed |
| Full backend test suite | 132 passed, 0 failed |
| Backend typecheck | Passed |
| Backend build | Passed |
| Backend `pnpm audit` | No known vulnerabilities |
| Backend `npm audit` | 0 vulnerabilities |
| Frontend `pnpm audit` | No known vulnerabilities |
| Frozen pnpm lockfile install | Passed; lockfile up to date |
| npm lockfile dry-run (`npm ci --ignore-scripts --dry-run`) | Passed |
| Nodemon/minimatch compatibility check | Passed |
| CRLF-aware `git diff --check` | Passed |

The standard Windows `git diff --check` flags additions in `dashboard.route.ts` and `sprint.routes.ts` as trailing whitespace because of CRLF handling; the CRLF-aware check passes. No broad line-ending normalization was applied. The build emitted tracked `backend/dist` output during validation; generated output was restored/removed afterward and is not part of the changes.

## Files changed for this work

- Dependency manifests and locks: [backend/package.json](./backend/package.json), [backend/package-lock.json](./backend/package-lock.json), [backend/pnpm-lock.yaml](./backend/pnpm-lock.yaml), [backend/pnpm-workspace.yaml](./backend/pnpm-workspace.yaml).
- Shutdown lifecycle: [backend/server.ts](./backend/server.ts), [backend/services/shutdown.service.ts](./backend/services/shutdown.service.ts), [backend/services/scheduler.service.ts](./backend/services/scheduler.service.ts).
- Shared validation: [backend/validations/route-params.ts](./backend/validations/route-params.ts), [backend/validations/request.validation.ts](./backend/validations/request.validation.ts), [backend/validations/project.validations.ts](./backend/validations/project.validations.ts), [backend/validations/work.item.validations.ts](./backend/validations/work.item.validations.ts), [backend/validations/whiteboard.validation.ts](./backend/validations/whiteboard.validation.ts).
- Route wiring: [backend/routes/chat.routes.ts](./backend/routes/chat.routes.ts), [backend/routes/dashboard.route.ts](./backend/routes/dashboard.route.ts), [backend/routes/notification.routes.ts](./backend/routes/notification.routes.ts), [backend/routes/organization.routes.ts](./backend/routes/organization.routes.ts), [backend/routes/project.routes.ts](./backend/routes/project.routes.ts), [backend/routes/sprint.routes.ts](./backend/routes/sprint.routes.ts), [backend/routes/user.routes.ts](./backend/routes/user.routes.ts), [backend/routes/whiteboard.routes.ts](./backend/routes/whiteboard.routes.ts), [backend/routes/work.item.routes.ts](./backend/routes/work.item.routes.ts).
- Related controller validation: [backend/controllers/chat.controller.ts](./backend/controllers/chat.controller.ts), [backend/controllers/sprint.controller.ts](./backend/controllers/sprint.controller.ts).
- Tests: [backend/tests/route-validation.test.ts](./backend/tests/route-validation.test.ts), [backend/tests/request-validation.test.ts](./backend/tests/request-validation.test.ts), [backend/tests/scheduler-shutdown.test.ts](./backend/tests/scheduler-shutdown.test.ts), [backend/tests/shutdown.test.ts](./backend/tests/shutdown.test.ts).

## Remaining verification gaps

- The route HTTP probes were unauthenticated and did not use a dedicated test database. In routers with global authentication middleware, unauthenticated requests can receive `401` before route-parameter validation runs; authenticated validation behavior was not integration-tested against a database.
- No live production database or deployment environment was used to verify process termination under real connection/load conditions.
