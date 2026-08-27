# Step 29 — Backup, restore, and retention TDD evidence

## User journeys

- As an operator, I want a PostgreSQL backup to be restored and compared so that recovery is proven rather than assumed.
- As a system owner, I want raw telemetry deletion to fail closed until recent backup evidence and roll-ups exist.
- As a developer, I want the verification database isolated so that the application role keeps least privilege.

## RED evidence

`npm test -- --run lib/operations/backup-policy.test.ts` failed because `lib/operations/backup-policy.ts` did not exist. Commit `c6305b3` preserves the RED contract.

## GREEN evidence

The same focused command passed 7/7 tests after adding manifest comparison, disposable-database naming, and retention-readiness guards. Commit `017306d` preserves the GREEN implementation.

The first live restore attempt produced `permission denied to create database`. This was valid operational evidence that the application role correctly lacks `CREATEDB`; no privilege was added. Verification was changed to use an isolated loopback-only PostgreSQL cluster instead.

The final `npm run db:backup:verify` run passed after restoring a custom archive and matching all source/restored table counts, 15 completed migrations, and 98 indexes. The temporary database and isolated cluster were removed. `npm run db:retention:readiness` then confirmed the archive and checksum but safely blocked deletion because both roll-up tables are not implemented yet.

## Test specification

| Guarantee | Evidence | Result |
| --- | --- | --- |
| Restore comparison detects migration, table-count, and index differences | `lib/operations/backup-policy.test.ts` | PASS |
| Only strictly named temporary databases can be treated as disposable | `lib/operations/backup-policy.test.ts` | PASS |
| Missing, failed, or older-than-seven-day recovery evidence blocks retention | `lib/operations/backup-policy.test.ts` | PASS |
| Missing 15-minute or daily roll-ups block retention | `lib/operations/backup-policy.test.ts` | PASS |
| A real custom archive restores with manifest parity | `backup-restore-verification.json` | PASS |
| Backup archive presence and checksum are rechecked | `retention-readiness.json` | PASS |
| Raw telemetry deletion remains disabled | `retention-readiness.json` | SAFELY BLOCKED |

## Known boundary

This milestone does not create roll-up tables or delete telemetry. Those changes require separate forward-only migrations, energy-total reconciliation, historical-query cutover, and another restore proof.
