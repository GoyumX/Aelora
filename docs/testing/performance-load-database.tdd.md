# Step 28 — Performance, load, and database verification

## Scope

The milestone measures authenticated page navigation, read-only API load, PostgreSQL query plans, index coverage, and the scaling boundary of high-frequency telemetry. It also creates durable visual evidence for Chapters 6 and 7.

## Test-driven changes

### RED

- `lib/benchmark/statistics.test.ts` failed because the deterministic percentile/statistics module did not exist.
- `lib/cache/ttl-promise-cache.test.ts` failed because the bounded asynchronous cache did not exist.
- The first real benchmark completed with **REVIEW**: the 30-day history endpoint measured 2,680.68 ms at P95 against a 1,500 ms budget.
- The first PostgreSQL audit found the `ReportSnapshot.generatedById` foreign key without a supporting index.

### GREEN

- Added nearest-rank P50/P95/P99 summaries with input validation and deterministic rounding.
- Added a bounded 60-second promise cache that deduplicates concurrent reads, expires values, evicts rejections, and limits memory growth.
- Applied the cache only to historical analytics and performance reports; live telemetry remains uncached.
- Added and migrated `ReportSnapshot_generatedById_idx`.
- Repeated the load benchmark and database audit until both gates passed.

## Performance budgets

| Surface | Budget |
| --- | ---: |
| Page navigation P95 | ≤ 2,500 ms |
| Page TTFB P95 | ≤ 800 ms |
| Largest Contentful Paint P95 | ≤ 2,500 ms |
| Cumulative Layout Shift P95 | ≤ 0.10 |
| Latest telemetry, forecast, weather API P95 | ≤ 750 ms |
| 30-day history API P95 | ≤ 1,500 ms |
| API HTTP error rate | 0% |
| Representative PostgreSQL read execution | ≤ 100 ms |

## Result

The final local development run passed all defined budgets. The 30-day history endpoint improved from 2,680.68 ms P95 to 116.85 ms P95 under five concurrent authenticated clients, with a 0% HTTP error rate. Database reads completed in under 4 ms in the audited dataset, and the repeated foreign-key inspection reported no uncovered relations.

These values are a repeatable local baseline, not a claim about internet latency or production capacity. A production deployment must rerun the same scripts against its deployed database and application environment.
