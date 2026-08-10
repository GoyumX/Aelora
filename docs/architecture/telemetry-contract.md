# Canonical Telemetry Contract

Aelora's monitoring UI consumes one telemetry shape regardless of whether data comes from the deterministic simulator or a future inverter/IoT adapter.

## Sign conventions

- `gridPowerW > 0`: importing power from the grid.
- `gridPowerW < 0`: exporting power to the grid.
- `batteryPowerW > 0`: battery discharging into the site.
- `batteryPowerW < 0`: battery charging from available energy.
- In normal operation: `pvPowerW + batteryPowerW + gridPowerW = loadPowerW`.

## Source and quality

`source` identifies the adapter (`SIMULATOR` or `HARDWARE`). `quality` identifies how the value should be interpreted (`SIMULATED`, `MEASURED`, `ESTIMATED`, `STALE`, or `MISSING`). The current seeded site always shows `SIMULATED`; the interface does not present it as a physical reading.

## Latest snapshot endpoint

```text
GET /api/sites/:siteId/telemetry/latest
```

The endpoint requires a valid session and scopes regular users to sites they own. A missing or cross-owner site returns `404` to avoid disclosing site existence. Responses use a `{ data, meta }` envelope, disable caching, and currently advertise a 15-second polling interval.

## Current simulator scenarios

- Normal operation
- Sudden cloud ramp
- Partial shading / underperforming array
- Grid outage
- Inverter fault
- Battery unavailable

Scenario state is currently deterministic and in-process. A later admin simulator control will persist the active scenario and audit every privileged change.

## Historical storage and query

Canonical readings are stored in PostgreSQL with UTC timestamps and a unique `(siteId, source, observedAt)` key. The development seed creates 180 days of deterministic hourly readings for each demo site. This cadence keeps the local dataset compact while providing a full 90-day comparison period; the aggregation layer infers cadence and also supports future one-minute hardware readings.

```text
GET /api/sites/:siteId/telemetry?from=YYYY-MM-DD&to=YYYY-MM-DD&grain=day|week|month
```

The endpoint requires a valid owner/admin session, limits ranges to 366 days, renders buckets in the site timezone, and returns energy totals in integer watt-hours. Grid import/export and battery charge/discharge are separated according to the canonical sign convention. Completeness is the ratio of stored samples to expected samples at the inferred cadence.
