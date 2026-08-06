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
