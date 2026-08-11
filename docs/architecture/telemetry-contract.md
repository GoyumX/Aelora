# Canonical Telemetry and Gateway Lifecycle Contract

Aelora's monitoring UI consumes one telemetry shape regardless of whether data comes from the separately running virtual gateway or a future inverter/IoT adapter. The browser never opens a connection to private-LAN equipment; an enrolled edge gateway polls equipment locally, normalizes it, and sends outbound HTTPS requests to Aelora.

## Sign conventions

- `gridPowerW > 0`: importing power from the grid.
- `gridPowerW < 0`: exporting power to the grid.
- `batteryPowerW > 0`: battery discharging into the site.
- `batteryPowerW < 0`: battery charging from available energy.
- In normal operation: `pvPowerW + batteryPowerW + gridPowerW = loadPowerW`.

## Source and quality

`source` identifies the adapter (`SIMULATOR` or `HARDWARE`). `quality` identifies how the value should be interpreted (`SIMULATED`, `MEASURED`, `ESTIMATED`, `STALE`, or `MISSING`). Virtual-gateway readings use `SIMULATOR`/`SIMULATED`; fixture-backed and future physical adapters use `HARDWARE`/`MEASURED`. The interface must never present simulated data as a physical reading.

## Machine endpoints

```text
POST /api/v1/gateway-enrollments
POST /api/v1/gateways/:gatewayId/telemetry-batches
POST /api/v1/gateways/:gatewayId/heartbeats
```

Enrollment exchanges a short-lived, single-use claim token for a gateway identity, credential, telemetry path, and heartbeat path. The two gateway endpoints require `Authorization: Bearer <gateway credential>`; site scope is derived from the authenticated gateway and is never accepted from a browser or payload as authority.

New telemetry is accepted with `201`; an identical idempotent replay returns `200`. Conflicting sequence reuse returns `409`, authentication failures return `401`, and invalid contracts or timing windows return `422`. Accepted telemetry is written transactionally before any page can display it.

Heartbeats and telemetry answer different questions:

- `lastHeartbeatAt` says the gateway process and its Aelora connection are alive.
- `lastTelemetryAt` says the site has delivered a fresh measurement batch.
- Pausing telemetry does not pause heartbeat delivery, so the UI can show an online gateway with stale measurements instead of incorrectly calling the gateway offline.

Telemetry and heartbeat IDs are idempotent. Payload timestamps have bounded future skew, and telemetry older than the replay window is rejected. Each device observation is checked against the same timing and range contract.

## Credential lifecycle

Browser-session routes let an authorized site owner or admin request a rotation or revoke a gateway. A rotation creates a pending credential without immediately breaking the running gateway. The gateway operator places that value into the local console; the first authenticated machine request using it atomically promotes it and invalidates the former credential. Revocation immediately rejects both current and pending credentials.

Plaintext enrollment and rotated credentials are shown only at issuance, while Aelora stores non-reversible hashes. The gateway stores its active credential in its local SQLite state. Production deployment requires TLS and an operating-system-protected gateway data directory.

## Southbound adapter boundary

The virtual plant, SunSpec fixture adapter, and Fronius JSON fixture adapter all normalize into the same `SimulationTick`/gateway envelope units and sign conventions. The fixtures prove mapping, scale factors, source, quality, and balance without a physical device. Live rollout adds read-only LAN transports in front of those normalizers; it does not change Aelora's public ingest or page contracts.

## Latest snapshot endpoint

```text
GET /api/sites/:siteId/telemetry/latest
```

The endpoint requires a valid session and scopes regular users to sites they own. A missing or cross-owner site returns `404` to avoid disclosing site existence. Responses use a `{ data, meta }` envelope, disable caching, and currently advertise a 15-second polling interval.

## Virtual gateway scenarios

- Cloud ramp
- Rain day
- Dirty array
- Partial shade
- Inverter fault
- Battery low
- Grid outage

The separately running gateway applies scenarios for a caller-selected duration and restores the previous plant state automatically. Scenario expiry is also checked by the heartbeat loop, so restoration still happens when telemetry publishing is paused.

## Historical storage and query

Canonical readings are stored in PostgreSQL with UTC timestamps and a unique `(siteId, source, observedAt)` key. The development seed creates 180 days of deterministic hourly readings for each demo site. This cadence keeps the local dataset compact while providing a full 90-day comparison period; the aggregation layer infers cadence and also supports future one-minute hardware readings.

```text
GET /api/sites/:siteId/telemetry?from=YYYY-MM-DD&to=YYYY-MM-DD&grain=day|week|month
```

The endpoint requires a valid owner/admin session, limits ranges to 366 days, renders buckets in the site timezone, and returns energy totals in integer watt-hours. Grid import/export and battery charge/discharge are separated according to the canonical sign convention. Completeness is the ratio of stored samples to expected samples at the inferred cadence.
