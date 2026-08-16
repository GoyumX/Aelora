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
- Gateway heartbeat freshness and telemetry freshness remain separate, so paused measurements do not falsely mark a running gateway offline.
- An owner/admin can stage a new credential without interrupting the active gateway, promote it on first use, or revoke the gateway immediately.
- Heartbeat and telemetry timestamps are bounded against future skew and stale replay windows.
- Dynamic virtual telemetry uses the unchanged authenticated gateway contract and remains power-balanced before persistence.

## RED/GREEN checkpoints

| Behavior                                                                           | RED checkpoint | GREEN implementation | Focused evidence                                              |
| ---------------------------------------------------------------------------------- | -------------- | -------------------- | ------------------------------------------------------------- |
| Versioned balanced telemetry and freshness thresholds                              | `53eaf76`      | `9bf5dee`            | `npm run test:run -- lib/gateway/contract.test.ts` → 4 passed |
| Hashed credentials and persistence mapping                                         | `6e00d71`      | `f7456dd`            | Two focused files → 4 passed                                  |
| Database-only telemetry mapping                                                    | `a06ef76`      | `7a6110d`            | Persisted snapshot tests → 4 passed after edge-case expansion |
| Gateway/device connectivity in monitoring                                          | `79bffae`      | `7a6110d`            | Live Monitoring suite → 5 passed                              |
| One-time enrollment UI                                                             | `dfd74c9`      | `26f0f7b`            | Gateway setup suite → 1 passed                                |
| Heartbeat, safe rotation/revocation, timing windows, and replay controls           | `b35b054`      | `582890d`            | Four focused files → 17 passed                                |
| Native auth forms never submit credentials through a query string before hydration | `e187f84`      | `0b4f292`            | Two focused files → 8 passed                                  |

Each RED run failed because its intended production module or visible behavior did not yet exist. The checkpoints are reachable from the `dev` branch and were not squashed.

## Integration evidence

The local Python gateway was enrolled through the authenticated Aelora site endpoint without printing secrets. It then published telemetry and independent heartbeats through bearer-authenticated machine endpoints. Browser-to-database verification also staged a rotated credential, promoted it through a real gateway request, and confirmed the credential version advanced without exposing it in the outbound preview. PostgreSQL reported:

- gateway status `ONLINE`;
- accepted heartbeat records and telemetry batches;
- linked gateway telemetry readings and seven discovered virtual devices.

On 2026-08-16, gateway `0.3.0` was restarted against the existing local enrollment and its new dynamic batch was accepted with HTTP `201`. The gateway and computer local timestamps matched to the second, the pending queue remained at zero, the authorization preview remained redacted, and the accepted snapshot had `0.00 W` balance error. Across an adjacent 30-second interval, observed values changed as follows:

| Measurement | First interval | Next interval |
| --- | ---: | ---: |
| Household load | 2774.17 W | 2882.96 W |
| PV output | 3757.45 W | 3437.35 W |
| Grid flow | -983.28 W | -554.39 W |

`npm run test:run -- lib/gateway/contract.test.ts --reporter=verbose` also passed all 7 Next.js gateway contract tests, confirming the simulator enhancement required no ingest-contract change.

## Final gates

| Guarantee                                         | Command                 | Result                                                                                        |
| ------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| Lint, TypeScript, all tests, and production build | `npm run check`         | PASS: 29 files / 91 tests; Next.js 16 production build compiled                               |
| Expanded edge-case suite and coverage             | `npm run test:coverage` | PASS: 29 files / 91 tests; 94.32% statements, 84.10% branches, 96.99% functions, 96.90% lines |
| Production dependency audit                       | `npm audit --omit=dev`  | PASS: 0 vulnerabilities                                                                       |
| PostgreSQL migrations                             | `prisma migrate deploy` | PASS: ingestion and `20260811133000_harden_gateway_lifecycle` migrations applied              |
| Schema validity                                   | `prisma validate`       | PASS                                                                                          |

## Known follow-ups

- The SunSpec and Fronius adapters currently prove normalization with protocol fixtures; live read-only Modbus TCP/vendor HTTP transports and software device emulators are next.
- Production hardening still needs public-edge rate limiting, TLS termination, protected gateway storage, queue bounds/backoff policy, and operational credential-recovery procedures.
- Accelerated-clock/multi-step scenarios, weather provenance, and the ML forecast service remain later roadmap phases.
- The legacy TypeScript simulator remains only for deterministic historical seed/test data and is not called by the live API or pages.
