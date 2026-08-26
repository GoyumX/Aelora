# Dynamic dashboard and forecast experience — TDD record

## Behavior contract

- Query telemetry from the configured site's local midnight through the latest
  stored observation and plot generation versus household consumption on a
  midnight-to-now time scale.
- Treat Open-Meteo data as fresh for 30 minutes, expose a manual owner refresh,
  and display stored current, hourly, and seven-day weather from site settings.
- Roll the dashboard's 48-hour window forward as time passes and rerun the full
  seven-day model only after 12 hours, always after weather synchronization.
- Remove elapsed forecast points from upcoming totals/cards, make the seven-day
  view the primary AI-page section, and retain prediction-versus-actual as
  accuracy, uncertainty-calibration, and drift evidence.
- Remove the research-limitations and next-month cards requested by the user,
  and use neutral charcoal surfaces in dark mode.

## RED evidence

The first focused run failed because the timezone/freshness modules and internal
refresh endpoint did not exist, the telemetry service queried only 121 recent
rows, and the old component hierarchy lacked refresh controls and the requested
ordering.

## Implemented tests

| Boundary | Evidence |
| --- | --- |
| Half-hour and negative-offset local midnight | `lib/time/zoned.test.ts` |
| 30-minute weather / 12-hour ML freshness | `lib/refresh/freshness.test.ts` |
| Local-day database query | `lib/telemetry/latest-service.test.ts` |
| Rolling 48-hour and stored weather aggregation | `lib/dashboard/snapshot.test.ts` |
| Weather-first scheduled refresh and authorization | `app/api/internal/intelligence-refresh/route.test.ts` |
| Stale-site-only model generation | `lib/forecast/forecast-service.test.ts` |
| Dashboard and AI-page controls, hierarchy, and removed cards | component suites |

## Operational truth

Browser timers improve an open session but cannot run after a tab or computer is
closed. Reliable automation therefore uses the protected internal endpoint (or
the equivalent local script) every 30 minutes. Its persisted freshness gates
make repeated scheduler calls safe and inexpensive.
