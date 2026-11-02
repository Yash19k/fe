# SEC-06 — Frontend Dependency Fix Report

## Result

**Fixed:** the final `pnpm audit --prod` reports **No known vulnerabilities found**.
All 12 findings from the initial production audit are resolved in the pnpm
dependency tree.

## Original findings

All findings were transitive dependencies introduced by the direct production
dependency `@excalidraw/excalidraw@0.18.1`.

| # | Severity | Package / installed version | Advisory | Introducing dependency path | Patched version |
|---|---|---|---|---|---|
| 1 | High | `lodash-es@4.17.21` | [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) | Excalidraw → mermaid-to-excalidraw → Mermaid parser → Langium/Chevrotain | `>=4.18.1` |
| 2 | High | `nanoid@4.0.2` | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | Excalidraw → mermaid-to-excalidraw → nanoid | `>=5.1.16` |
| 3 | High | `nanoid@3.3.3` | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | Excalidraw → nanoid | `>=3.3.16` |
| 4 | High | `nanoid@3.3.3` | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | Excalidraw → nanoid | `>=3.3.18` |
| 5 | High | `nanoid@4.0.2` | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | Excalidraw → mermaid-to-excalidraw → nanoid | `>=5.1.6` |
| 6 | High | `nanoid@4.0.2` | [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | Excalidraw → mermaid-to-excalidraw → nanoid | `>=5.1.11` |
| 7 | High | `nanoid@3.3.3` | [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | Excalidraw → nanoid | `>=3.3.12` |
| 8 | Moderate | `nanoid@3.3.3` | [GHSA-mwcw-c2x4-8c55](https://github.com/advisories/GHSA-mwcw-c2x4-8c55) | Excalidraw → nanoid | `>=3.3.8` |
| 9 | Moderate | `nanoid@4.0.2` | [GHSA-mwcw-c2x4-8c55](https://github.com/advisories/GHSA-mwcw-c2x4-8c55) | Excalidraw → mermaid-to-excalidraw → nanoid | `>=5.0.9` |
| 10 | Moderate | `lodash-es@4.17.21` | [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh) | Excalidraw → mermaid-to-excalidraw → Mermaid parser → Langium/Chevrotain | `>=4.18.1` |
| 11 | Moderate | `lodash-es@4.17.21` | [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) | Excalidraw → mermaid-to-excalidraw → Mermaid parser → Langium/Chevrotain | `>=4.17.23` |
| 12 | Low | `katex@0.16.47` | [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7) | Excalidraw → mermaid-to-excalidraw → Mermaid → KaTeX | `>=0.18.2` |

These are 7 high, 4 moderate, and 1 low advisory records. `lodash-es` and
`nanoid` each had multiple locked versions/paths; the table lists the vulnerable
version and path for each advisory.

## Remediation

The vulnerable versions were pinned by upstream Excalidraw dependencies, so
compatible updates could not be obtained by refreshing the lockfile alone.
Added version-scoped pnpm workspace overrides in `frontend/pnpm-workspace.yaml`
and regenerated `frontend/pnpm-lock.yaml`:

| Vulnerable locked version | Resolved version |
|---|---|
| `lodash-es@4.17.21` | `4.18.1` |
| `nanoid@3.3.3` | `3.3.20` |
| `nanoid@4.0.2` | `5.1.16` |
| `katex@0.16.47` | `0.18.2` |

No direct dependency or frontend source versions were changed. The current
Excalidraw, Mermaid, and parser parent versions remain unchanged; the resolutions
are scoped to the exact vulnerable versions rather than applying broad package
overrides.

## Verification

| Check | Result |
|---|---|
| `pnpm audit --prod` | Passed — no known vulnerabilities found; all 12 findings resolved |
| `pnpm run typecheck` | Passed |
| `pnpm test` | Passed — 344 tests, 0 failures |
| `pnpm run build` | Passed — production build completed |
| `pnpm peers check` | Reports existing Radix UI peer mismatches: installed React/ReactDOM 19.3.0 versus the packages' declared React 16–18 ranges. Those package versions were already present before remediation and were not changed. |
| NanoID ESM API smoke test | Passed — patched `nanoid@5.1.16` named export generated a 21-character ID |

The production dependency tree preserves the original parent packages. Its
vulnerable resolutions changed from `lodash-es@4.17.21` to `4.18.1`,
`nanoid@3.3.3` to `3.3.20`, `nanoid@4.0.2` to `5.1.16`, and `katex@0.16.47`
to `0.18.2`. The audit confirms no remaining production advisories.

The NanoID 4-to-5 resolution is a major-version change because no patched 4.x
version is available. The dependency is ESM and the patched named-export API
smoke test, frontend tests, typecheck, and production build all pass. The
frontend suite does not specifically exercise Mermaid math rendering; verify
that integration in staging before release.

## Files changed

- `frontend/pnpm-workspace.yaml` — added exact-version patched dependency resolutions.
- `frontend/pnpm-lock.yaml` — regenerated with patched package versions.
- `SEC-06-FRONTEND-DEPENDENCY-FIX-REPORT.md` — this report.

`frontend/package.json` and source files were not changed. The npm lockfile was
not modified; pnpm is the package manager declared by the frontend project.
