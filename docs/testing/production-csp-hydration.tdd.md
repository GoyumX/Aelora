# Production CSP hydration regression evidence

**Execution date:** 2026-08-30
**Branch:** `dev`

## User journey

As a deployed Aelora user, I need the sign-in controls to render and accept
input under the production Content Security Policy so that I can authenticate
without weakening the application's script security.

## Root cause

Railway returned the sign-in page with a fresh nonce-based Content Security
Policy, while Next.js had statically generated the route at build time. The
static HTML contained 19 framework and page scripts without a nonce. The
browser rejected those scripts, React did not hydrate, and the sign-in
`Suspense` fallback remained visible as an empty rectangle.

This behavior matches the Next.js nonce-CSP contract: nonce-protected pages
must render after an incoming request is available so Next.js can copy the
request nonce onto its generated scripts.

## RED evidence

Command:

```text
$env:AELORA_E2E_TARGET='https://aelora-web-production.up.railway.app/sign-in'
npx playwright test e2e/csp-hydration.spec.ts
```

Result: the page returned HTTP 200, but Playwright could not find the
`Email address` control because the client application never hydrated.

Checkpoint: `1a7bbb5 test: reproduce production CSP hydration failure`.

## GREEN implementation

- The root layout now waits for `connection()` before rendering. This makes
  every page request-time rendered, as required by the nonce CSP applied to
  every rendered route.
- The root layout reads `x-nonce` from the incoming request and passes it to
  `next-themes`, covering its inline theme bootstrap script in addition to the
  scripts automatically handled by Next.js.
- The CSP remains strict; no `unsafe-inline` script exception was introduced.

Checkpoint: `5499351 fix: hydrate nonce-protected production pages`.

## GREEN evidence

The optimized production build classified `/`, `/sign-in`, `/sign-up`, and all
other page routes as dynamic (`ƒ`). The built application was then started on
port 3100 and tested with the same browser specification.

```text
$env:AELORA_E2E_TARGET='http://localhost:3100/sign-in'
npx playwright test e2e/csp-hydration.spec.ts

1 passed
```

The browser test verified that:

- the response is HTTP 200;
- email, password, and sign-in controls are visible;
- the loading fallback is gone;
- every server-rendered script tag contains a nonce; and
- the browser reports no CSP script violation.

## Verification summary

| Gate | Result |
| --- | --- |
| Production build | PASS; every rendered page is dynamic |
| TypeScript | PASS |
| ESLint | PASS |
| Unit/integration tests | PASS; 90 files and 338 tests |
| Coverage | PASS; 91.98% statements, 80.78% branches, 94.28% functions, 95.28% lines |
| Production-mode browser regression | PASS; 1 test |
| Dependency advisory command | BLOCKED by the pre-existing invalid npm package-tree/lock state; no dependency was changed by this fix |

## Deployment acceptance

After these commits are merged into the Railway deployment branch, the live
sign-in page must be checked once more. Successful acceptance means the form is
visible, credentials can be entered, authentication redirects to the dashboard,
and the browser console contains no CSP violation.
