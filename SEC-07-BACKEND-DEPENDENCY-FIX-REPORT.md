# SEC-07 Backend Dependency Fix Report

## Summary

All seven original backend production advisories are resolved. Both the pnpm
production audit and the npm production audit report zero vulnerabilities after
the dependency and lockfile updates. No source-code or API changes were needed.

## Original findings

The original audit was run against the backend pnpm production dependency tree.
It reported three high and four moderate advisories:

| Vulnerable package | Original version | Advisory | Severity | Dependency type and parent | Production use |
|---|---:|---|---|---|---|
| `body-parser` | 2.3.0 | GHSA-27r3-jxmh-p828 | High | Transitive via `express@5.3.0` | Yes. Express JSON and URL-encoded parsing are enabled in `backend/app.ts`. |
| `multer` | 2.4.0 | GHSA-q7qp-rjg7-q26m | High | Direct backend dependency | Yes. Used by the work-item attachment upload middleware. |
| `joi` | 18.2.9 | GHSA-4528-x5fx-h6hg | High | Direct backend dependency | Yes. Used by request validation, including email schemas. |
| `nodemailer` | 10.1.1 | GHSA-8c8m-p3m8-cjg8 | Moderate | Direct backend dependency | Yes. Used by the mail service for invitation and other email messages. |
| `nodemailer` | 10.1.1 | GHSA-m943-m63m-w62w | Moderate | Direct backend dependency | Yes. Same production mail paths. |
| `nodemailer` | 10.1.1 | GHSA-85x2-q946-cp5h | Moderate | Direct backend dependency | Yes. Same production mail paths. |
| `qs` | 6.16.0 | GHSA-6pq8-jhm2-2vcw | Moderate | Transitive via `express@5.3.0` and `body-parser` | Included in the production parser dependency tree. The app uses Express query parsing and URL-encoded parsing with `extended: false`; the advisory's vulnerable stringify operation was not observed in application code. |

### Advisory descriptions

- **GHSA-27r3-jxmh-p828**: denial of service from trailing bytes after a
  compressed request body; patched in `body-parser` 2.4.0 and later.
- **GHSA-q7qp-rjg7-q26m**: denial of service from a pending asynchronous
  Multer `fileFilter` after request teardown; patched in Multer 2.5.0 and
  later.
- **GHSA-4528-x5fx-h6hg**: quadratic-time processing of multiple Joi email
  values; patched in Joi 18.3.1 and later.
- **GHSA-8c8m-p3m8-cjg8**, **GHSA-m943-m63m-w62w**, and
  **GHSA-85x2-q946-cp5h**: Nodemailer address-parser recipient parsing issues;
  patched in Nodemailer 10.1.4 and later.
- **GHSA-6pq8-jhm2-2vcw**: uncaught TypeError in `qs.stringify` with comma
  array format; patched in `qs` 6.16.1 and later.

## Dependency changes

| Dependency | Previous manifest / resolved version | Updated manifest / resolved version |
|---|---|---|
| `joi` | `^18.2.9` / 18.2.9 | `^18.3.1` / 18.3.1 |
| `multer` | `^2.4.0` / 2.4.0 | `^2.5.0` / 2.5.0 |
| `nodemailer` | `^10.1.1` / 10.1.1 | `^10.3.1` / 10.3.1 |
| `body-parser` | Transitive / 2.3.0 | Transitive / 2.4.0 |
| `qs` | Transitive / 6.16.0 | Transitive / 6.17.1 |

Express remains at 5.3.0. Its declared ranges admit the patched `body-parser`
and `qs` resolutions, so changing Express or adding package overrides was not
necessary. The transitive updates were performed through package-manager
resolution, not overrides. Joi and Nodemailer continue to support Node.js 20
and later; the checked runtime was Node.js 24.21.0. Node.js and TypeScript
versions were not changed.

Both backend lockfiles are tracked in this repository. The pnpm lockfile is
the project's package-manager lockfile; the npm lockfile was also synchronized
so npm production installs do not retain vulnerable resolutions.

## Audit results

| Audit | Result |
|---|---|
| Baseline `pnpm --dir backend audit --prod` | 7 findings: 3 high, 4 moderate |
| Final `pnpm --dir backend audit --prod` | 0 vulnerabilities (0 high, 0 moderate, 0 low, 0 critical) |
| Final `npm --prefix backend audit --omit=dev` | 0 vulnerabilities |
| Original advisories resolved | 7 of 7 |
| Newly introduced production vulnerabilities | None reported |

## Verification

- `pnpm --dir backend install --frozen-lockfile`: passed.
- `pnpm --dir backend install --frozen-lockfile --strict-peer-dependencies`:
  passed; no peer-dependency incompatibilities reported.
- `pnpm --dir backend typecheck`: passed.
- `pnpm --dir backend test`: passed, 84 tests; 0 failures.
- `pnpm --dir backend build`: passed.
- Local behavior smoke test: passed for Express JSON and URL-encoded body
  parsing, duplicate query parameter handling, valid/invalid Joi email
  validation, and an actual multipart request through the Multer upload
  middleware with a file written and then cleaned up.

### Integration coverage and limitations

- The existing attachment tests verify accepted/rejected file types and file
  signatures. The additional smoke test exercised real Multer multipart
  parsing and the upload middleware; it did not test a browser, cloud storage,
  or a production upload service.
- Existing invitation tests mock Nodemailer's transport and check the message
  and recipient construction. No connection to a live SMTP server or external
  email provider was made, so real email delivery is not claimed as verified.
- Existing tests cover API contracts, validation, permissions, and
  authorization behavior. The full suite passed, but no external production
  database or deployed HTTP/authentication service was exercised.
- The Express parsing smoke test checked body and query parsing behavior. The
  app's current `extended: false` URL-encoded setting and default query parser
  were preserved.

## Compatibility warnings

The strict frozen pnpm install succeeded without peer-dependency warnings.
pnpm reported existing deprecated transitive packages (`glob@7.2.3`,
`inflight@1.0.6`, and `rimraf@2.7.1`) during dependency resolution; these were
not among the seven production advisories and were not changed as part of this
targeted fix.

## Files changed

- `backend/package.json`
- `backend/pnpm-lock.yaml`
- `backend/package-lock.json`
- `SEC-07-BACKEND-DEPENDENCY-FIX-REPORT.md`

No backend source files, frontend files, database entities, migrations, Node.js
version, or TypeScript version were changed.

## Remaining risks

The final production audits report no known vulnerabilities in the backend
production dependency tree. Audit results only reflect advisories available to
the package registries at verification time. Live SMTP delivery, deployed
authentication, and production upload/storage integrations were not exercised.
