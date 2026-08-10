# Historical Analytics - TDD Evidence

Date: 2026-08-11
Branch: `dev`

## Scope and journeys

This increment implements the telemetry persistence and Historical Analytics foundation described in `AELORA_IMPLEMENTATION_PLAN.md` sections 5.5, 8, 9, 10, and Phase 7.

- An authenticated owner can inspect 7-, 30-, or 90-day telemetry history.
- The owner can switch between daily, weekly, and monthly buckets.
- Power samples integrate into generation, consumption, import, export, battery charge, and battery discharge energy.
- Historical charts identify the simulated source and show data completeness.
- The selected aggregate can be exported as CSV.
- Current-period generation and consumption are compared with the preceding equal-length period.
- Another user's site is hidden and invalid ranges fail validation.

## RED evidence

Commit `b5e53e6` defines the missing aggregation and Historical Analytics contracts.

```text
Test Files 2 failed (2)
Tests      no tests executed because both required modules did not exist
```

## GREEN evidence

Commit `f82958b` adds PostgreSQL persistence, the aggregation service, owner-scoped history API, seeded history, CSV conversion, and the Historical Analytics experience.

```text
Focused Test Files 2 passed (2)
Focused Tests      5 passed (5)
```

## Database and runtime evidence

```text
Migration                    20260811010000_add_telemetry_history applied
Prisma migration status      up to date (3 migrations)
Stored readings per site     4,320
Stored history per site      180 days, hourly cadence
Authenticated page           200
Authorized history API       200
Invalid query                422
Cross-owner query            404
Anonymous query              401
```

The unique source key prevents duplicate seed records, and the site/time descending index supports authorized range scans. The seed inserts in batches and is idempotent.

## Final verification

```text
Lint        passed
Type-check  passed
Test Files  23 passed (23)
Tests       69 passed (69)
Build       passed
```

Final coverage remained above all project thresholds:

```text
Statements 93.85%
Branches   84.81%
Functions  96.33%
Lines      96.29%
```

## Known boundaries

- Demo history is hourly to keep local data compact; the domain infers sample cadence and can integrate future one-minute samples correctly.
- A production scheduler, raw hardware ingest authentication, materialized aggregate table, alert overlays, and predicted-vs-actual evaluation remain later increments.
- CSV export is generated from the filtered aggregate in the browser and contains no hidden credentials or cross-site data.
