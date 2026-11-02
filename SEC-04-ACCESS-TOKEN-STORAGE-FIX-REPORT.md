# SEC-04 Access Token Storage Fix Report

## Summary

Access tokens were previously persisted in `localStorage`, making them available to injected JavaScript and allowing them to outlive the page session. Access tokens are now held only in the API module's memory. The existing refresh-token cookie and rotating refresh endpoint restore authentication after a page reload.

## Previous and New Token Flows

**Previous flow**

- `getAuthToken()` read from memory and fell back to `localStorage`.
- `setAuthToken()` wrote access tokens to both memory and the `taskflow_auth_token` local-storage key.
- Startup used a persisted token or cached user identity to decide whether to verify the session.

**New flow**

- `getAuthToken()` and `setAuthToken()` use memory only. Access tokens are not written to `localStorage` or `sessionStorage`.
- The legacy `taskflow_auth_token` key is removed during API-service initialization and whenever authentication state is cleared.
- App initialization remains in a loading state while it calls the existing `/api/users/refresh` endpoint with credentials. On success, the new access token is kept in memory and `/api/users/me` verifies the session before protected views are shown.
- Authenticated API calls, including attachment uploads, use the in-memory token. A 401 shares an in-flight refresh operation, reuses a newer token when another request already refreshed it, and retries the original request once.
- A failed refresh clears in-memory and cached authentication state. The existing route guard sends the user to login after initialization has completed.
- Login and registration still accept the backend's access token response and keep it only in memory. Logout still calls the backend with cookies enabled; the backend revokes the refresh session and clears both auth cookies.

## Cookie Security Review

The active `/api/users/*` auth flow uses the shared cookie configuration in `auth.session.service.ts`:

- `httpOnly: true`
- `secure` enabled in production
- `sameSite` controlled by `COOKIE_SAME_SITE` (defaults to `lax`; `none` is permitted only in production)
- Refresh-cookie lifetime of seven days
- `path: "/"` and no explicit domain, making the cookie host-only and available to `/api/users/refresh`

These settings were preserved. Cross-site deployments must configure `COOKIE_SAME_SITE=none` with HTTPS and retain the existing credentialed CORS configuration. Refresh tokens are not returned in API response bodies or JavaScript-readable storage.

## Files Changed

- `frontend/src/services/api.ts` — memory-only access-token handling, shared credentialed refresh/retry logic, legacy-key cleanup.
- `frontend/src/state/AppContext.tsx` — refresh-cookie restoration during initialization and auth-state cleanup on refresh failure.
- `frontend/tests/api_contract.test.ts` — memory-only storage, initialization refresh, request retry/concurrency, failure, login, and logout coverage.
- `frontend/tests/auth_fixes.test.ts` — cached user data no longer treated as proof of authentication; initialization route guard coverage.
- `frontend/tests/phase1_remediation.test.ts` — assertions updated for standard `Headers` objects.
- `backend/tests/auth-session-security.test.ts` — refresh-cookie attributes and logout session revocation coverage.

## Validation

| Area | Command | Result |
|---|---|---|
| Frontend tests | `npm test` (`frontend/`) | Passed: 352 tests, 0 failures |
| Frontend typecheck | `npm run typecheck` (`frontend/`) | Passed |
| Frontend production build | `npm run build` (`frontend/`) | Passed |
| Backend tests | `npm test` (`backend/`) | Passed: 92 tests, 0 failures |
| Backend typecheck | `npm run typecheck` (`backend/`) | Passed |
| Backend build | `npm run build` (`backend/`) | Passed |

## Remaining Limitations

- Access tokens must remain available to application JavaScript to send bearer-authenticated requests, so an active XSS vulnerability could still read a token during that page session. Memory-only storage reduces persistence; it does not replace XSS defenses.
- Refresh rotation is coordinated within one application instance. Concurrent refreshes from separate browser tabs are not cross-tab coordinated.
- A separate legacy `/api/organizations` registration handler sets a refresh cookie path of `/api/auth/refresh`; the current frontend auth flow uses `/api/users/register` and `/api/users/refresh`. That separate legacy route was not changed as part of this fix.
- The frontend auth regression tests exercise API/state behavior under Node; no full browser end-to-end session test was run.
