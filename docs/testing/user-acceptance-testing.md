# Step 31 — User acceptance testing

## Purpose

This test pack verifies that Aelora supports its main dissertation demonstration journeys from the user's point of view. It complements unit, integration, accessibility, security and performance tests; it does not replace them.

The automated journeys are deliberately read-only. They do not change equipment, disable users, acknowledge incidents, create support tickets or replace immutable reports.

## Prerequisites

1. Start PostgreSQL and apply all Prisma migrations.
2. Ensure the seeded USER and ADMIN accounts are active.
3. Set `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`, `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in the local environment. Do not write their values into evidence files.
4. Ensure the database contains the seeded site, gateway telemetry, weather, forecast and report evidence.
5. Run `npm run test:uat` from the `aelora` repository.

## Acceptance scripts

| Case | Actor | Manual journey | Expected result | Automated evidence |
| --- | --- | --- | --- | --- |
| UAT-01 | USER | Sign in, open Dashboard and inspect the site selector. | Dashboard opens and Colombo Home is assigned to the user. | `01-user-dashboard.png` |
| UAT-02 | USER | Open Live Monitoring, inspect the recent trend, then open Alerts. | Stored power evidence and site-scoped incidents are visible. | `02-live-monitoring.png`, `03-alerts.png` |
| UAT-03 | USER | Open AI Forecast, Historical Analytics, Performance and Reports. | Forecast, reconciled history, panel performance and immutable report history load successfully. | `04-ai-forecast.png`, `05-reports.png` |
| UAT-04 | USER | Open System Configuration, Settings and Help; search Help for “forecast”. | Equipment inventory, profile controls and matching guidance are available. | `06-system-configuration.png`, `07-help-and-support.png` |
| UAT-05 | USER / ADMIN | Attempt `/admin` as USER, then sign in as ADMIN and open Admin Console. | USER is redirected to Dashboard; ADMIN sees health, users, support, gateways, models and audit evidence. | `08-admin-console.png` |

## Human sign-off checklist

- [ ] Text, charts and status labels are understandable without developer explanation.
- [ ] Simulated telemetry is visibly distinguishable from measured evidence.
- [ ] Forecast provenance, age, horizon and limitations are clear.
- [ ] USER cannot reach administrator operations.
- [ ] ADMIN can identify platform health and stored audit evidence.
- [ ] Navigation works at desktop and mobile widths.
- [ ] No unexpected personal data, credentials or telemetry payloads appear in screenshots.
- [ ] The assessor records name, date, result and comments below.

| Assessor | Date | Result | Comments |
| --- | --- | --- | --- |
| _Pending human review_ | _Pending_ | _Pending_ | Automated browser acceptance must be supplemented by a human assessor. |

## Automated result — 27 August 2026

- Acceptance journeys: 5 passed, 0 failed, 0 skipped.
- Acceptance evidence capture: passed, for 6 focused Playwright tests.
- Complete browser regression: 39 passed.
- Unit/integration suite: 332 passed across 87 files.
- Coverage: 92.15% statements, 80.92% branches, 94.87% functions and 95.28% lines.
- TypeScript, ESLint, production build and high-severity dependency audit: passed.

## Evidence boundary

A passing automated UAT run proves the seeded local demonstration journeys at the recorded time. It does not prove compatibility with every physical inverter, production availability, electrical safety or model accuracy on real Sri Lankan hardware. Those claims require measured field evidence and a separate production-readiness review.
