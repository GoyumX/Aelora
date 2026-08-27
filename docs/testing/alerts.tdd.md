# Alerts and incident lifecycle verification

## Scope

The Alerts milestone converts persisted gateway evidence into durable,
owner-scoped incidents. It is deterministic and does not use or claim an AI
diagnosis.

## Rule boundaries

- Grid outage: three or more consecutive readings, a span of at least 60
  seconds (and at least two expected gateway intervals), and grid voltage at or
  below 10 V. Zero PV output alone never creates a power-cut incident.
- Gateway/device offline: no last-seen update for more than ten expected
  reporting intervals. A gateway outage suppresses downstream device and
  performance conclusions until fresh evidence returns.
- Inverter fault: a communicating inverter explicitly reports `FAULT`.
- Battery low: three sustained readings at or below the configured reserve.
- PV underperformance: three sustained daylight readings at or above 200 W/m²
  irradiance and actual output below 50% of the transparent capacity/
  irradiance estimate. Grid outages and inverter faults suppress this signal.

## Lifecycle contract

The stable open key deduplicates repeated detections. Further evidence updates
the last-detected time, occurrence counter, and evidence while preserving an
acknowledgement. When an evaluated rule clears, the open key is released and
the incident moves to `RESOLVED` with `EVIDENCE_CLEARED`; a later recurrence
therefore creates a new historical incident. Manual resolution is recorded
separately.

## TDD and verification evidence

- RED: focused imports for detection, lifecycle, route, and UI contracts failed
  because the alert modules and page did not exist.
- GREEN: 21 focused domain/route/UI/shell tests passed before the full suite.
- Full suite: 54 files and 183 tests passed.
- Coverage: 92.40% statements, 80.42% branches, 95.96% functions, and 96.07%
  lines; every configured threshold passed.
- Static gates: ESLint, TypeScript, and the Next.js 16.3 production build passed.
- Live simulator proof: a temporary virtual `GRID_OUTAGE` produced sustained
  30-second telemetry through the authenticated ingest route. Aelora created
  one critical simulated incident, updated it without duplication, and
  automatically resolved it with `EVIDENCE_CLEARED` after the gateway restored
  grid voltage. The scenario was explicitly cleared; publishing remained on,
  the retry queue returned to zero, and the last delivery was HTTP 201.
