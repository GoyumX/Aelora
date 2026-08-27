# Step 30 — Telemetry roll-up TDD evidence

## User journeys

- As a user, I need historical totals to remain accurate while the telemetry database grows.
- As an operator, I need delayed gateway data and repeated scheduler runs to update summaries without duplicates or partial-day overwrites.
- As an administrator, I need retention to remain fail-closed until current-schema recovery, reconciliation and bucket coverage are proven.

## RED/GREEN checkpoints

| Guarantee | RED commit | GREEN commit |
| --- | --- | --- |
| Energy integration, gaps, UTC buckets, local days, evidence labels and dry-run rules | `dec9c9a` | `130fa32` |
| Transactional idempotent 15-minute/daily persistence and reconciliation | `d2ff21f` | `a19450f` |
| Failure-isolated scheduling and long-range analytics cutover | `fa6cc38` | `8a4ba4c` |
| Incremental runs cannot overwrite a complete local day with a partial window | `4ae8b01` | `2ae3012` |
| Private bearer-protected scheduler boundary | `19cffdb` | `fa0eb51` |
| Retention requires roll-up reconciliation | `865827b` | `fa0eb51` |
| A backup from an older migration history cannot authorize retention | `cc7a958` | `5187938` |
| Verification excludes the open bucket and incremental windows preserve cross-boundary energy | `c5c5735`, `6c5b1c4` | `cd73944` |

## Focused evidence

The focused Step 30 suite passed 25 tests covering scheduler authorization, retention guards, roll-up mathematics, persistence, reconciliation and analytics cutover.

`npm run db:rollups:verify` passed both reconciliation layers for two sites. `npm run db:retention:dry-run` found 5,082 eligible rows, zero missing summaries and deleted zero rows. `npm run db:rollups:evidence` passed three browser evidence checks.

## Final verification

- `npm run test:coverage`: 332 tests passed across 87 files; 92.15% statements, 80.92% branches, 94.87% functions and 95.28% lines.
- `npm run typecheck`, `npm run lint` and `npm run build`: passed.
- `npm audit`: zero vulnerabilities.
- `npm run test:e2e`: 33 tests passed, including all WCAG, responsive-layout, backup, retention and Step 30 evidence checks.
- The final browser gate exposed low-contrast dark-sidebar labels; increasing their foreground opacity produced a passing targeted dark-mode check and passing full-suite rerun.
