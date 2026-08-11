# Gateway ingestion TDD evidence

## Source plan

Journeys were derived from the gateway-first revision in `AELORA_IMPLEMENTATION_PLAN.md`.

## User journeys

- A site owner can create a one-time gateway enrollment without storing the plaintext token in Aelora.
- A separately running virtual or hardware gateway can enroll once and send authenticated, versioned telemetry batches.
- Duplicate delivery is idempotent and conflicting sequence reuse is rejected.
- Aelora persists the batch, site reading, device observations, and freshness state before displaying it.
- Dashboard and Live Monitoring never generate a fresh runtime reading when the gateway is absent.
- Communications freshness and device operation are shown as separate states.

## RED/GREEN checkpoints

| Behavior | RED checkpoint | GREEN implementation | Focused evidence |
|---|---|---|---|
| Versioned balanced telemetry and freshness thresholds | `53eaf76` | `9bf5dee` | `npm run test:run -- lib/gateway/contract.test.ts` → 4 passed |
| Hashed credentials and persistence mapping | `6e00d71` | `f7456dd` | Two focused files → 4 passed |
| Database-only telemetry mapping | `a06ef76` | `7a6110d` | Persisted snapshot tests → 4 passed after edge-case expansion |
| Gateway/device connectivity in monitoring | `79bffae` | `7a6110d` | Live Monitoring suite → 5 passed |
| One-time enrollment UI | `dfd74c9` | `26f0f7b` | Gateway setup suite → 1 passed |

Each RED run failed because its intended production module or visible behavior did not yet exist. The checkpoints are reachable from the `dev` branch and were not squashed.

## Integration evidence

The local Python gateway was enrolled through the authenticated Aelora site endpoint without printing secrets. It then published one batch through the bearer-authenticated machine endpoint. PostgreSQL reported:

- gateway status `ONLINE`;
- 7 discovered virtual devices;
- 1 accepted telemetry batch;
- 1 linked gateway telemetry reading.

## Final gates

| Guarantee | Command | Result |
|---|---|---|
| Lint, TypeScript, all tests, and production build | `npm run check` | PASS: 28 files / 80 tests at that checkpoint; Next.js production build compiled |
| Expanded edge-case suite and coverage | `npm run test:coverage` | PASS: 28 files / 84 tests; 94.38% statements, 83.74% branches, 96.85% functions, 96.94% lines |
| PostgreSQL migration | `prisma migrate deploy` | PASS: `20260811023000_add_edge_gateway_ingestion` applied |
| Schema validity | `prisma validate` | PASS |

## Known follow-ups

- Credential rotation/revocation UI and an explicit heartbeat endpoint are not yet implemented.
- The ingest contract validates balance, units, ranges, ownership, credential, gateway identity, sequence, and batch ID. A bounded clock-skew/replay-time window should be added before internet deployment.
- The legacy TypeScript simulator remains only for deterministic historical seed/test data and is not called by the live API or pages.
