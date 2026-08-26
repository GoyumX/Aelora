# Simulated verification replay TDD evidence

## Scope and safety boundary

Step 18 proves that the separately running Python gateway can create complete
simulated evidence through Aelora's real authenticated ingestion path. The
development replay does not replace normal computer-clock publishing, does not
alter current plant or battery state, and never relabels simulator data as
measured. Simulated evidence is permanently blocked from model promotion.

## RED evidence

Aelora's focused tests failed because `publishIntervalSec` was stripped from
heartbeats, invalid cadence values were accepted, and cadence was never written
to the gateway record. The gateway focused run then failed with:

```text
TypeError: AeloraPublisher.heartbeat() got an unexpected keyword argument 'publish_interval_sec'
AttributeError: 'GatewayRuntime' object has no attribute 'replay_completed_hour'
POST /api/development/replay-hour -> 404
```

An initial Python attempt failed in Windows' global pytest temp directory; it
was discarded as invalid RED evidence. The valid run used an isolated
workspace-local `--basetemp` and executed the intended failing tests. Git
checkpoints were not created because the user owns commits and pushes.

## GREEN evidence

| Guarantee | Evidence | Result |
| --- | --- | --- |
| Heartbeats validate and synchronize 10–3600 second cadence | `lib/gateway/contract.test.ts`, heartbeat route test | PASS |
| Canonical site/source/timestamp conflicts are safe replay duplicates, not hidden unrelated conflicts | `lib/gateway/ingest-conflicts.test.ts` | PASS |
| Gateway heartbeat payload carries cadence | `tests/test_publisher.py` | PASS |
| One completed hour produces every configured slot with bearer auth and no live-state mutation | `tests/test_publisher.py` | PASS |
| Publishing changes immediately send cadence and console replay is reachable | `tests/test_api.py` | PASS |

Focused GREEN: 12 Aelora tests and 28 gateway tests passed.

## Live integration proof

- Gateway: enrolled virtual gateway, cadence 30 seconds, zero pending batches.
- Interval: `2026-08-21T07:00:00Z` through `08:00:00Z`.
- Ingestion: 120 attempted, 120 accepted, zero buffered.
- PostgreSQL: exactly 120 `SIMULATED` readings from `07:00:00` through
  `07:59:30` UTC.
- Verification refresh: 26 considered point records, four persisted for the
  completed hour, 22 incomplete intervals withheld.
- Evaluation deduplication: one daylight label, MAE 1.352 kWh, RMSE 1.352 kWh,
  wMAPE 29.3%.
- Safety state: `BLOCKED_SIMULATED_EVIDENCE`, automatic activation false,
  empirical calibration still collecting at 1/24 labels.
- Repeat replay: 120/120 accepted, zero buffered, queue depth zero.

## Final gates

- Aelora: 49 files and 160 tests passed; coverage remained above every 80%
  threshold; ESLint, TypeScript, production build, and npm audit passed.
- Gateway: 38 tests passed with 91.34% coverage; Ruff, byte compilation,
  JavaScript syntax, and pip-audit passed.
- Both local services remained running after verification.
