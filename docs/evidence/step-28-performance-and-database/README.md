# Step 28 — Performance, load, and PostgreSQL evidence

This folder contains reproducible evidence for Chapter 6 (implementation) and Chapter 7 (testing).

## Captured figures

| File | Suggested report caption |
| --- | --- |
| `01-benchmarked-dashboard.png` | Aelora dashboard included in the authenticated navigation benchmark. |
| `02-historical-analytics-under-test.png` | Historical analytics interface after bounded history-cache optimisation. |
| `03-panel-performance-under-test.png` | Solar-array performance view included in the performance test. |
| `04-ai-forecast-under-test.png` | AI forecast interface included in the performance test. |
| `05-performance-baseline-report.png` | Repeatable page and authenticated API benchmark results. |
| `06-postgresql-performance-audit.png` | PostgreSQL table, index, foreign-key, and query-plan audit. |
| `07-responsive-dashboard.png` | Responsive mobile dashboard verification surface. |

## Machine-readable evidence

- `performance-baseline.json` contains page navigation, TTFB, LCP, CLS, transfer size, API P50/P95/P99, HTTP status counts, and error rates.
- `database-performance-audit.json` contains table statistics, index definitions, uncovered foreign-key checks, and read-only `EXPLAIN (ANALYZE, BUFFERS)` results.
- The matching HTML files provide human-readable versions suitable for screenshot capture.

## Reproduce

With PostgreSQL and the Aelora development server running:

```powershell
npm run performance:database
npm run performance:baseline
npm run performance:evidence
```

The benchmark uses the seeded user credentials from `.env`; no password or token is written to the evidence files.
