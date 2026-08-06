# Public Landing and Authentication Visuals — TDD Evidence

Date: 2026-08-06  
Branch: `dev`

## Scope

Step 4 establishes Aelora's public entry point before a visitor signs in. It explains live monitoring, AI forecasting, and hardware-free simulation, then directs visitors to registration or login. The shared authentication layout now carries the same visual identity on both sign-in and registration pages.

## RED evidence

The public-page contract was recorded in commit `089b047`. The initial test run failed because the root route still redirected to sign-in and the authentication layout had no visual artwork.

The tests require:

- A single, descriptive public headline.
- Registration and sign-in calls to action with correct destinations.
- Visible explanations of monitoring, forecasting, and simulation.
- Meaningful alternative text for the public hero.
- Decorative authentication artwork that is ignored by assistive technology.

## GREEN evidence

Commit `e0c4b52` implements the landing experience and shared authentication artwork. The focused verification result was:

```text
Test Files 2 passed (2)
Tests      4 passed (4)
```

The complete application gate then passed:

```text
Lint        passed
Type-check  passed
Test Files  14 passed (14)
Tests       41 passed (41)
Build       passed (21 routes)
Audit       0 vulnerabilities
```

Coverage remained above the project's 80% gate:

```text
Statements 95.83%
Branches   89.70%
Functions  96.15%
Lines      95.77%
```

## Generated visual assets

- `public/images/aelora-solar-home-hero.png` — a Sri Lankan tropical modern home with rooftop solar at sunrise and clear composition space for interface copy.
- `public/images/aelora-auth-energy.png` — a premium solar-array scene with restrained amber and green energy-flow accents for the authentication panel.

Both assets were generated without embedded words, logos, or watermarks. Product copy remains real HTML so it stays readable, responsive, translatable, and accessible.

## Local preview

Public routes can be inspected without a database:

- `/`
- `/sign-in`
- `/sign-up`

Successful login requires PostgreSQL, the committed migration, and the local seed. Credentials remain in the ignored `.env` and are intentionally excluded from this report.

## Environment note

Docker could not download its PostgreSQL image because the host clock was earlier than the container registry certificate's validity date. The already-installed native PostgreSQL 18 service was used instead. The `aelora` role and database were created locally, the migration applied, and the idempotent seed completed.

Real HTTP verification then confirmed:

```text
USER   sign-in 200 -> /dashboard 200 (2 session cookies)
ADMIN  sign-in 200 -> /admin     200 (2 session cookies)
```

The seed initially exposed a standalone-runtime boundary failure caused by importing Next.js's `server-only` entrypoint. Commit `8b8152c` records the failing regression test and commit `e47933e` moves the shared Better Auth instance behind a framework-neutral module. The final committed-state application gate passed after this fix.
