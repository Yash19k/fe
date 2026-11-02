# DEP-01 Production Configuration Fix Report

## Summary

Production configuration now fails fast instead of silently directing users to a local backend or binding the backend only to loopback. Development retains its existing local defaults. No live deployment was available for verification.

## Original problems and root cause

- The frontend API client fell back to `http://localhost:3000` for every build, including production.
- The backend listener defaulted to `127.0.0.1`, which is not externally reachable unless the deployment's networking is deliberately local/proxied.
- CORS defaulted to local development origins. HTTP, Socket.IO, and raw chat WebSocket origin checks were separate call sites.
- Production did not require explicit `HOST`, `PORT`, `CORS_ORIGINS`, or `FRONTEND_URL` values.
- The retry after a successful access-token refresh did not explicitly retain `credentials: "include"`.

## Files changed

- `frontend/src/services/api.ts`
- `frontend/.env.example`
- `frontend/tests/api_config.test.ts`
- `frontend/tests/api_contract.test.ts`
- `backend/config/config.ts`
- `backend/.env.example`
- `backend/app.ts`
- `backend/websocket/whiteboard.gateway.ts`
- `backend/websocket/chat.gateway.ts`
- `backend/services/auth.session.service.ts`
- `backend/controllers/auth.controller.ts`
- `backend/controllers/organization.controller.ts`
- `backend/tests/deployment-config.test.ts`

The worktree already contained unrelated uncommitted edits in `backend/config/config.ts` and `backend/controllers/organization.controller.ts`; those edits were preserved.

## Configuration changes

### Frontend

- The centralized API client continues to serve all HTTP requests.
- `VITE_API_URL` is used when configured.
- Development defaults to `http://localhost:3000`.
- A production build requires an explicit HTTPS URL, or `/` when a same-origin reverse proxy has deliberately been configured. Missing or invalid settings raise a clear configuration error when the frontend initializes.
- The API retry after token refresh now retains credentialed fetch behavior.
- A production build with `VITE_API_URL=https://api.example.invalid` succeeded, and the URL was found in the generated bundle.

### Backend listener and origins

- Development retains `HOST=127.0.0.1`, `PORT=3000`, and the three existing local frontend origins.
- Production requires an explicit valid `HOST`, integer `PORT` from 1–65535, HTTPS `FRONTEND_URL`, and one or more exact HTTPS origins in `CORS_ORIGINS`.
- `HOST` is not defaulted to `0.0.0.0`: set it to the interface required by the actual platform or reverse-proxy topology. The configured frontend origin must be included in `CORS_ORIGINS`.
- `CORS_ORIGINS` accepts a comma-separated list. Wildcards, paths, credentials, query strings, fragments, and non-HTTPS production origins are rejected.
- A shared exact-origin check is used by Express CORS, whiteboard Socket.IO, and the chat WebSocket upgrade. Unapproved browser origins are rejected. Requests without an `Origin` header remain permitted for non-browser clients and health checks.
- Credentialed HTTP and Socket.IO CORS remain enabled; wildcard origins are not used.

### Authentication cookies

- The existing token and refresh-token lifecycle is unchanged.
- Existing `httpOnly` cookie behavior remains. Cookies are `Secure` in production.
- `COOKIE_SAME_SITE` optionally selects `lax`, `strict`, or `none`; it defaults to `lax`. Use `none` only when the frontend and API are cross-site; production mode makes those cookies Secure. The setting is shared by login/session, refresh, logout, reset-password, and organization-registration cookie operations.
- Frontend API calls and refresh calls include credentials, including the retry after refresh.

## Required production environment variables

Set these for the frontend:

```dotenv
VITE_API_URL=https://<your-api-host>
```

Alternatively, set `VITE_API_URL=/` only if a same-origin proxy is configured to route API requests and the required WebSocket paths.

Set these for the backend:

```dotenv
HOST=<interface-required-by-your-platform-or-proxy>
PORT=<platform-assigned-or-configured-port>
CORS_ORIGINS=https://<your-frontend-host>[,https://<another-approved-frontend-host>]
FRONTEND_URL=https://<your-frontend-host>
```

The application also retains its existing production requirements, including `ACCESS_TOKEN_SECRET` and `DB_PASSWORD`. `COOKIE_SAME_SITE` is optional and should be set to `none` only for cross-site cookie deployments. Example files use local development values and reserved `.invalid` placeholders, not actual production domains or credentials.

## Verification results

- Frontend TypeScript typecheck: **passed**
- Backend TypeScript typecheck: **passed**
- Frontend tests: **348 passed, 0 failed**
- Backend tests: **89 passed, 0 failed**
- Frontend production build: **passed** with the default environment and with an explicit HTTPS placeholder URL; missing/invalid production URL behavior was verified by frontend unit tests
- Backend production build: **passed**
- Backend configuration tests verified local defaults, valid explicit listener values, missing production host failure at startup, HTTPS frontend URL validation, multiple configured origins, duplicate removal, wildcard/path rejection, and rejection of an unapproved origin.
- Frontend tests verified the development URL default, configured production URL, explicit same-origin proxy path, missing production URL error, invalid URL error, and credential inclusion for refresh and retry requests.
- `git diff --check`: **passed**

## CORS, cookies, and Socket.IO results

- CORS policy behavior was verified through the shared origin validator used by all three server paths; multiple allowed origins succeed and an unapproved origin does not.
- Credentialed frontend refresh/retry requests are covered by automated frontend tests. Cookie attributes and call sites were inspected: `httpOnly` remains enabled, `Secure` follows production mode, and the same configured SameSite policy is used when setting and clearing cookies.
- Whiteboard Socket.IO keeps `credentials: true` and uses the shared allowlist. Chat WebSocket uses the same allowlist on its upgrade path.
- No live browser cookie exchange, database-backed login/logout flow, HTTP CORS preflight, or Socket.IO/WebSocket handshake was run. These remain deployment/integration checks, not proven by a successful build or the unit-level origin tests.

## Remaining deployment requirements and unverified assumptions

- Configure the production environment values above in the actual deployment environment; select `HOST` and `PORT` for its networking model rather than copying development values.
- Configure TLS and any reverse proxy to route `/api`, Socket.IO traffic, and `/ws/chat` as applicable. A same-origin `VITE_API_URL=/` setting requires those routes to be proxied.
- Ensure the deployed frontend's exact HTTPS origin appears in `CORS_ORIGINS` and matches the origin used by the browser. Use `COOKIE_SAME_SITE=none` only if the frontend/API are truly cross-site; otherwise retain `lax`.
- Confirm platform port exposure, DNS, TLS termination, proxy headers/routing, and browser cookie behavior in the selected hosting environment.
- No hosting provider, public domain, reverse-proxy architecture, production database, or live deployment was assumed or tested. DEP-01 code changes are implemented and automated checks pass, but production deployment verification remains pending.
