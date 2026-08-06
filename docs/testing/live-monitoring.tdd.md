# Live Monitoring — TDD Evidence

Date: 2026-08-07  
Branch: `dev`

## Scope

Step 6 replaces the Live Monitoring placeholder with detailed, periodically refreshed telemetry. Journeys come from `AELORA_IMPLEMENTATION_PLAN.md` sections 5.2 and 8.

## User journeys

- A signed-in owner can distinguish simulated data from measured hardware data.
- The owner can inspect solar, load, battery, grid, inverter, thermal, irradiance, and per-array values with units.
- The owner can see freshness, quality, source, scenario, and device status as text rather than color alone.
- The UI refreshes from an ownership-scoped endpoint every 15 seconds and retains the last good snapshot after a refresh failure.
- Normal and fault scenarios produce reproducible telemetry for demonstrations and tests.

## RED evidence

Commit `adead8e` records the missing canonical simulator and Live Monitoring component.

```text
Test Files 2 failed (2)
Tests      no tests executed because the required modules did not exist
```

## GREEN evidence

Commit `638b244` adds the canonical telemetry types, deterministic simulator, authorized latest-snapshot endpoint, server-scoped page, and polling client interface.

Focused result:

```text
Test Files 2 passed (2)
Tests      11 passed (11) after branch expansion
```

## Security and integration verification

Real local sessions produced:

```text
Anonymous latest telemetry     401
Owner latest telemetry         200
Returned site matches owner    true
Cross-owner latest telemetry   404
Quality                        SIMULATED
Refresh interval               15 seconds
```

## Final verification

```text
Lint        passed
Type-check  passed
Test Files  19 passed (19)
Tests       59 passed (59)
Build       passed (21 routes)
```

Coverage includes the simulator and monitoring component:

```text
Statements 96.50%
Branches   86.66%
Functions  98.57%
Lines      97.28%
```

## Known boundary

The latest endpoint generates an on-demand canonical snapshot. Minute-level persistence, aggregation, admin scenario activation, and historical range APIs remain future steps; the current endpoint does not mutate data during a `GET` request.
