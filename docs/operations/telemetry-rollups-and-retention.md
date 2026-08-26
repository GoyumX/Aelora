# Telemetry roll-ups and retention operations

## Data flow

Accepted `TelemetryReading` rows remain the immutable high-resolution source. The worker integrates only evidenced sample duration into UTC-aligned 15-minute buckets, then rebuilds each affected calendar day from every stored interval using the site's IANA timezone.

Long-range Historical Analytics and report generation use `TelemetryRollupDaily`. Live Monitoring and short ranges continue to read high-resolution telemetry. If no daily summaries exist for a requested long range, the service safely falls back to raw readings.

## Scheduled operation

Schedule `POST /api/internal/telemetry-rollups` after telemetry ingestion, normally every 15 minutes. Send `Authorization: Bearer <WEATHER_SYNC_SECRET>`. The job recalculates a two-hour trailing window, is idempotent, and isolates failures by site so delayed gateway delivery can repair recent summaries.

Local equivalent:

```powershell
npm run db:rollups:run
```

## Backfill and verification

```powershell
npm run db:rollups:backfill
npm run db:rollups:verify
```

Backfill defaults to seven-day input batches and can be changed with `TELEMETRY_ROLLUP_BACKFILL_DAYS` from 1–31. The schema migration and data backfill remain separate. Re-running either command is safe because summary rows are upserted by `siteId + bucketStart` or `siteId + localDate`.

Verification compares a fresh calculation from raw telemetry with stored 15-minute totals, then compares 15-minute totals with daily totals. Generation, consumption, import, export, battery charge/discharge, covered duration and row counts must reconcile.

## Retention safety

```powershell
npm run db:backup:verify
npm run db:retention:readiness
npm run db:retention:dry-run
```

The dry-run is a preview only. It reports the cutoff, eligible raw-row count and missing-summary count. It cannot delete data. A future deletion worker remains out of scope until explicitly reviewed and must require:

1. A checksum-valid restore proof no older than seven days.
2. A restore proof containing the current Prisma migration history.
3. Reconciliation evidence no older than 24 hours.
4. Both roll-up tables.
5. A corresponding 15-minute row for every eligible raw reading.

The proposed development policy keeps raw telemetry for 90 days, but production retention remains configurable through `TELEMETRY_RAW_RETENTION_DAYS`.
