# Telemetry retention and scaling policy

## Current implementation boundary

Aelora stores every accepted gateway sample in PostgreSQL and keeps the original measurement time, source, quality, gateway, and device observations. The current development database does not automatically delete raw readings. This is intentional while the simulator, forecast verification, and dissertation evidence are still being developed.

At the default 30-second gateway interval, one site can produce 2,880 site-level readings per day plus per-device observations. Dashboard queries are bounded to the current day, and the latest-reading paths use composite `siteId + observedAt` indexes. Long historical ranges currently load raw readings and aggregate them in the application service, so they must not be treated as an unlimited production design.

## Production target policy

| Data class | High-resolution retention | Long-term retention | Reason |
| --- | ---: | ---: | --- |
| Site telemetry | 90 days at original cadence | 15-minute roll-ups for 24 months; daily summaries after that | Live troubleshooting needs detail; historical trends do not need every 30-second sample. |
| Device observations | 30 days at original cadence | Hourly device-health summaries for 12 months | Device diagnosis is recent-data focused. |
| Weather observations | 24 months | Daily summaries afterward | Needed for forecast evaluation and weather correlation. |
| Forecast runs and verification | Full project lifetime | Full project lifetime | Required for prediction-versus-actual evidence and model traceability. |
| Alerts, reports, and audit logs | Full project lifetime | Archive according to institutional policy | These are user-facing and governance records. |

## Safe implementation sequence

1. Add 15-minute and daily roll-up tables keyed by site and period start.
2. Backfill roll-ups from raw telemetry and verify energy totals against the original readings.
3. Change long-range analytics to read roll-ups while recent views continue to read raw telemetry.
4. Take and restore-test a PostgreSQL backup.
5. Only after steps 1–4 pass, schedule small batched deletions of raw rows older than 90 days.
6. Record every retention job run, deleted row count, and failure without logging credentials or telemetry payloads.

Raw telemetry must never be deleted before its roll-up exists and a restorable backup has been proven. The Step 28 database audit therefore remains read-only.
