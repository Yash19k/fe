# Authentication Storage Security Report

## Assessment summary

The targeted review found **no confirmed exploitable authentication-storage vulnerability** in the inspected active login/refresh/logout flow. No authentication code was changed because the review did not establish a code-level defect that could be safely fixed without changing behavior. This report records the verified design and the deployment-dependent items that still need manual verification.

The findings table is intentionally empty: no CRITICAL, HIGH, MEDIUM, or LOW vulnerability was verified.

## Existing authentication architecture

- The frontend API client (`frontend/src/services/api.ts`) keeps the access token in module memory, removes the legacy localStorage token, includes cookies in refresh requests, attaches the in-memory access token to authenticated requests, and retries after a refresh. Login sets the in-memory token; logout clears it.
- The application context (`frontend/src/state/AppContext.tsx`) restores authentication by refreshing and then fetching the current user. Cached identity is not treated as proof of authentication.
- The backend issues HS256 access JWTs with a 15-minute lifetime and creates random refresh tokens. User sessions persist a SHA-256 hash of the refresh token, not its raw value.
- The active user auth endpoints set an HttpOnly access cookie named `token` and refresh cookie named `refreshToken`. Both use `path: "/"`, configured SameSite, production-only Secure, and no Domain attribute (host-only cookies). The access cookie lasts 15 minutes; the refresh cookie lasts 7 days. Cookie clearing uses the shared helper and matching cookie options.
- Refresh runs in a database transaction with a pessimistic write lock, verifies the session, and replaces the stored refresh-token hash on success. Missing, revoked, expired, or non-matching refresh tokens are rejected. Logout revokes the associated session and clears the active-flow cookies.
- Backend CORS uses an exact origin allowlist with credentials enabled. Cookie SameSite defaults to `lax`; production configuration permits `none`.

## Frontend token-storage findings

- No access token is stored in localStorage or sessionStorage by the active API-client flow. It is held in memory and sent as a bearer token when required.
- The backend also returns the access token in JSON, which is consumed by the frontend and retained in memory. It is not the refresh token.
- The refresh token is not returned in JSON by the active user-auth flow; it is set in the HttpOnly cookie.
- The frontend sends cookie credentials for refresh and clears its in-memory access token during logout.
- Full browser behavior (including browser extensions, cross-site deployment behavior, and reload behavior against the deployed services) was not independently exercised.

## Backend cookie, token, and session findings

- Active-flow cookies are HttpOnly. Secure is enabled in production, SameSite is configurable, and no cookie Domain is set.
- The active-flow refresh cookie currently has `path: "/"`; this is broader than an auth-endpoint-only path. The cookie helper clears cookies with matching active-flow options.
- Refresh-token rotation is protected by a pessimistic write lock in a transaction. The newly issued refresh token replaces the stored hash; an old rotated value no longer matches. No explicit refresh-token-family revocation behavior was established.
- Access-token verification accepts bearer tokens or the `token` cookie, checks the JWT signature and expiry, and rejects inactive users.
- A separate legacy organization-registration route sets a `refreshToken` cookie scoped to `/api/auth/refresh` and returns an access token in JSON. Its production use and corresponding cookie-clearing behavior were not established; the shared active-flow clear helper uses `path: "/"`, so this legacy path needs deployment-level verification before relying on it.

## CSRF and CORS findings

- CORS is restricted to configured HTTP(S) origins and enables credentials; wildcard credentialed origins were not found in the inspected configuration.
- No explicit CSRF-token mechanism was identified in the inspected auth surfaces. The active configuration defaults SameSite to `lax`, but permits `SameSite=None` in production.
- The effective CSRF posture therefore depends on deployed cookie settings and whether cross-site cookies are required. CORS origin rejection alone is not a substitute for CSRF protection.

## Issues discovered and changes implemented

| Severity | Status | Summary |
|---|---|---|
| CRITICAL | None verified | No confirmed vulnerability. |
| HIGH | None verified | No confirmed vulnerability. |
| MEDIUM | None verified | Cross-site CSRF behavior with `SameSite=None` is deployment-dependent and was not verified. |
| LOW | None verified | The active refresh cookie uses root path; the legacy registration cookie's clearing behavior is unverified. |

**Changes implemented:** This report only. No auth code was changed because no fix was justified by a confirmed code-level vulnerability; altering cookie paths or CSRF behavior without verifying route/deployment requirements could break existing clients.

## Files modified

- `AUTHENTICATION_STORAGE_SECURITY_REPORT.md` — added this assessment.

No existing authentication source files were changed.

## Tests and validation

Commands were run from their respective package directories:

| Check | Result |
|---|---|
| Backend `pnpm test` | Passed: 113 tests, 0 failures. |
| Backend `pnpm typecheck` | Passed. |
| Backend `pnpm build` | Passed. |
| Frontend `pnpm test` | Passed: 353 tests, 0 failures. |
| Frontend `pnpm typecheck` | Passed. |
| Frontend `pnpm build` | Passed; Vite emitted a chunk-size warning. |
| Frontend `pnpm lint` | Passed with existing lint warnings, including warnings in tests. |
| `git diff --check` | Passed after adding this report. |

The backend auth-session test inspected during review covers cookie attributes and logout revocation/cookie clearing. The frontend API-contract tests include in-memory token handling and refresh/logout error behavior. The full suites passed, but they do not establish real-browser cross-site CSRF behavior or production database concurrency behavior.

## Remaining risks and production configuration requirements

1. Verify deployed `COOKIE_SAME_SITE`, `NODE_ENV`, TLS termination/proxy behavior, and the exact credentialed CORS origin allowlist without disclosing secret values.
2. If cross-site cookies are required and `SameSite=None` is configured, implement and test an appropriate CSRF defense for state-changing endpoints; do not rely on CORS alone.
3. Verify whether the legacy organization-registration route is deployed and ensure its refresh cookie is revoked and cleared with matching path/domain attributes.
4. Consider narrowing the active refresh-cookie path to the refresh endpoint(s) only after confirming all consumers and compatibility requirements.
5. Browser-level CSRF, deployed-origin CORS, and concurrent refresh race behavior were not exercised in this run.

No production database was intentionally queried or modified.
