# Step 30 — Telemetry roll-up and retention evidence

This evidence pack proves that Aelora can summarize high-cadence gateway telemetry without changing or deleting the source readings.

## Captured figures

| File | Suggested report caption |
| --- | --- |
| `01-rollup-reconciliation.png` | PostgreSQL raw-to-15-minute and 15-minute-to-daily reconciliation for both configured solar sites. |
| `02-retention-dry-run.png` | Non-destructive 90-day retention preview showing every eligible raw reading has a summary. |
| `03-historical-analytics-rollups.png` | Historical Analytics reading reconciled daily summaries in the configured site timezone. |

## Verified local result

- 16,344 raw telemetry readings remained stored.
- 8,928 unique 15-minute rows and 374 site-local daily rows were created.
- Both sites passed raw → 15-minute and 15-minute → daily energy reconciliation.
- A fresh PostgreSQL backup restored all 16 migrations, 28 public tables, and their row counts/indexes.
- The 90-day preview identified 5,082 eligible raw rows and zero rows without a roll-up.
- Zero raw rows were deleted; no deletion statement exists in the dry-run command.
- The complete browser suite passed all 33 tests, including the three evidence captures in this folder.

## Reproduce

```powershell
npm run db:rollups:backfill
npm run db:rollups:verify
npm run db:backup:verify
npm run db:retention:readiness
npm run db:retention:dry-run
npm run db:rollups:evidence
```
