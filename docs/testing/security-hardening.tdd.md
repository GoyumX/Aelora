# Step 27 security hardening - TDD and verification evidence

**Execution dates:** 2026-08-25 to 2026-08-26
**Source plan:** `AELORA_IMPLEMENTATION_PLAN.md`, Phase 10 / action 27
**Branch:** `dev`

## User journeys

- As an authenticated user, I want browser mutations accepted only from the
  Aelora origin so that another website cannot silently change my settings.
- As an operator, I want oversized or abusive request bursts stopped before
  they reach database and inference work.
- As a visitor, I want public authentication pages to remain reachable while
  protected pages continue redirecting guests to sign in.
- As a deployer, I want explicit browser security headers and dependency scans
  so that the deployed boundary has reproducible evidence.

## Implementation summary

- Added a shared mutation policy for custom browser APIs, authenticated gateway
  delivery, and protected internal jobs.
- Added same-origin browser checks, declared request-body limits, fixed-window
  throttling, `429` responses, retry metadata, and rate-limit response headers.
- Kept `/api/auth/*` under Better Auth's built-in origin and rate-limit controls.
- Added a per-request nonce Content Security Policy for rendered pages. Script
  execution uses a nonce and `strict-dynamic`; development alone permits
  `unsafe-eval` for Next.js hot reload. Inline styles remain permitted because
  Recharts and accessible React controls use style attributes.
- Added HSTS in production, framing, MIME-sniffing, referrer, permission,
  opener, resource, and DNS-prefetch protections.
- Expanded the proxy across rendered pages while retaining an explicit public
  route boundary. A browser-discovered sign-in redirect loop was reproduced by
  a failing test and fixed.
- Updated the ML development toolchain from vulnerable `pytest 8.4.2` to
  `pytest 9.0.3`, upgraded the local installer, and pinned `pip-audit 2.10.1`.

## RED evidence

```text
Initial security tests: 2 suites failed because request-security.ts and
headers.ts did not exist.

Live browser integration: /sign-in redirected to
/sign-in?callbackUrl=%2Fsign-in after the proxy matcher expanded.

Route regression test: expected getRouteRedirect("/", null) to be null, but
received /sign-in?callbackUrl=%2F.

Initial ML dependency advisory scan: eight findings in the development
environment, associated with pip 25.0.1 and pytest 8.4.2.
```

## GREEN evidence

```text
Focused security/auth/config tests: 15 passed
Complete Vitest suite with coverage: 80 files, 298 tests passed
Web coverage: 92.50% statements, 81.12% branches,
              95.16% functions, 95.46% lines
Playwright browser suite: 25 passed
ESLint: passed
TypeScript: passed
Next.js production build: passed
npm audit (runtime + development): 0 vulnerabilities
Virtual gateway: 39 passed, 91% application coverage, Ruff passed
ML service: 58 passed, 87.25% coverage, Ruff passed
Python pip check: no broken requirements in either service
Final pip-audit: no known vulnerabilities in either Python environment
```

## Live HTTP boundary evidence

| Check | Observed result | Meaning |
|---|---:|---|
| `GET /sign-in` | `200` | Public authentication boundary remains reachable. |
| Sign-in response CSP | Unique `nonce-*` | Rendered scripts are authorized per request. |
| Cross-site `PUT /api/settings` | `403 cross_site_request` | Cross-site browser mutation is rejected before route logic. |
| Same-origin settings mutation without session | `401 unauthorized` | Legitimate origin passes the boundary and still requires authentication. |
| Internal job request 1-12 with invalid token | `401` | Authentication remains the first application-level control. |
| Internal job request 13 in the same minute | `429` | Shared mutation throttling is active. |

## Test specification

| Guarantee | Evidence | Type | Result |
|---|---|---|---|
| Cross-site custom browser mutations are rejected | `lib/security/request-security.test.ts` | Unit | PASS |
| Gateway requests retain their server-to-server origin boundary | `lib/security/request-security.test.ts` | Unit | PASS |
| Endpoint-specific declared body limits are enforced | `lib/security/request-security.test.ts` | Unit | PASS |
| Rate windows block excess requests and reset predictably | `lib/security/request-security.test.ts` | Unit | PASS |
| CSP, isolation headers, and production-only HSTS are configured | `lib/security/headers.test.ts`, `next.config.test.ts` | Unit/config | PASS |
| Guests can access public pages without a redirect loop | `lib/auth/route-access.test.ts` | Regression | PASS |
| Every public/user/admin page still renders and reflows | `e2e/accessibility.spec.ts` | Browser E2E | PASS |
| Documentation screenshots come from successful browser journeys | `e2e/documentation-evidence.spec.ts` | Browser E2E | PASS |

## Documentation evidence

See `docs/evidence/step-27-security-hardening/README.md` for reusable figure
captions and four full-resolution PNG files.

## Known production follow-ups

- The fixed-window limiter is intentionally a local-process defense for this
  academic deployment. A horizontally scaled production deployment should use
  a shared Redis/database limiter or the hosting provider's edge/WAF limiter.
- CSP still permits inline styles for chart/component compatibility. Script
  execution does not use `unsafe-inline`; replacing remaining style attributes
  with nonce-compatible styles can tighten this later.
- Automated axe checks cover only part of WCAG. A manual keyboard and screen-
  reader acceptance pass remains required before claiming full accessibility.

Git checkpoint commits were not created because the user owns the manual
Git/GitHub flow. RED/GREEN evidence is preserved in this document.
