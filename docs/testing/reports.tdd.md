# Reports - TDD Evidence

Date: 2026-08-22
Branch: `dev`

## Source and user journeys

The scope was normalized from `AELORA_IMPLEMENTATION_PLAN.md` sections 5.7,
Phase 9, and Immediate Action 21. Text in the planning document was treated as
project context rather than executable instruction.

- An authenticated site owner can generate the last completed weekly or monthly report.
- The report reconciles energy, performance, forecast-verification, alert, downtime, and provenance evidence.
- Repeating a request against unchanged evidence reuses the same content-addressed immutable snapshot.
- An owner or administrator can download the stored snapshot as CSV or PDF; another user cannot access it.
- The Reports page distinguishes simulated and measured sources and withholds unavailable forecast metrics.

## RED evidence

The domain contract, persistence service, route, PDF, and dashboard tests were
written before their production modules existed.

```text
npm test -- --run lib/reports/report.test.ts --reporter=verbose

Test Files  1 failed (1)
Error: Failed to resolve import "@/lib/reports/report"
```

This was the intended missing-feature failure rather than a syntax or test-harness failure.

## GREEN evidence

```text
npm test -- --run lib/reports/report.test.ts lib/reports/report-service.test.ts components/reports/reports-dashboard.test.tsx app/api/sites/[siteId]/reports/route.test.ts app/api/sites/[siteId]/reports/[reportId]/[format]/route.test.ts

Test Files  5 passed (5)
Tests       23 passed (23)
```

## Test specification

| # | What is guaranteed | Test target | Type | Result |
|---|---|---|---|---|
| 1 | Weekly and calendar-month ranges are validated | `lib/reports/report.test.ts` | Unit | PASS |
| 2 | Energy, self-sufficiency, battery, performance and environment totals reconcile | `lib/reports/report.test.ts` | Unit | PASS |
| 3 | Forecast MAE/RMSE/bias/wMAPE and measured/simulated/mixed evidence are honest | `lib/reports/report.test.ts` | Unit | PASS |
| 4 | Incidents and clipped grid-outage duration are included | `lib/reports/report.test.ts` | Unit | PASS |
| 5 | CSV escapes metadata and preserves detailed daily rows | `lib/reports/report.test.ts` | Unit | PASS |
| 6 | PDF output has a valid document header and useful content | `lib/reports/report.test.ts` | Unit | PASS |
| 7 | Site ownership is enforced while admins retain access | `lib/reports/report-service.test.ts` | Service | PASS |
| 8 | Snapshot upsert uses a SHA-256 content key and no mutation update | `lib/reports/report-service.test.ts` | Service | PASS |
| 9 | Corrupt or missing stored snapshots are rejected | `lib/reports/report-service.test.ts` | Service | PASS |
| 10 | Generation and downloads require authentication and validated input | report route tests | Integration | PASS |
| 11 | The page exposes generation, provenance, empty/error states and CSV/PDF links | `components/reports/reports-dashboard.test.tsx` | Component | PASS |

## Database and runtime evidence

```text
Migration  20260822143000_add_report_snapshots applied
Database   PostgreSQL aelora at 127.0.0.1:5432
Route      anonymous /reports -> 307 /sign-in?callbackUrl=%2Freports
Auth page  seeded user /reports -> 200, ready snapshot and download actions rendered
Generate   POST weekly snapshot -> 201
CSV        authenticated download -> 200 text/csv (906 bytes)
PDF        authenticated download -> 200 application/pdf (2,303 bytes)
Build      /reports and /api/sites/[siteId]/reports/[reportId]/[format] compiled
```

The `ReportSnapshot` table stores the report type, exact period, generator,
schema version, generated time, SHA-256 data hash, and immutable JSON payload.
The unique site/type/period/hash key makes repeated generation idempotent while
allowing a new version when the underlying evidence changes.

## Final verification

```text
Lint        passed, 0 warnings
Type-check  passed
Test Files  59 passed (59)
Tests       206 passed (206)
Build       passed
npm audit   0 vulnerabilities

Statements  93.46%
Branches    81.67%
Functions   96.26%
Lines       96.63%

Reports domain/service/PDF
Statements  99.39%
Branches    95.52%
Functions   100%
Lines       100%
```

## Security and reliability notes

- Browser requests never contain database or ML-service credentials.
- Both generation and downloads call the authenticated server boundary.
- Site access is owner-scoped, with explicit administrator access.
- CSV uses attachment and `nosniff` headers; dynamic report responses are private and not cached.
- PDF and CSV are derived from the stored snapshot, so a later download cannot silently change past totals.
- Environmental impact uses a disclosed illustrative 0.7 kg CO2e/kWh factor rather than presenting a regulatory value.

## Known boundaries

- Scheduled generation remains deferred until the on-demand workflow has operational history.
- The PDF is a concise presentation summary; CSV is the authoritative full daily export.
- Financial savings are not included because tariff assumptions are not yet configured and versioned.
- The page currently opens the authenticated user's first active site, consistent with the other implemented pages; multi-site selection remains later shell work.
