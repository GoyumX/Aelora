# Dashboard Overview — TDD Evidence

Date: 2026-08-07  
Branch: `dev`

## Source and scope

The journeys were derived from `AELORA_IMPLEMENTATION_PLAN.md` section 5.1 and the user's instruction to proceed to the next implementation step. Step 5 replaces the Dashboard placeholder with a concise, authenticated operational summary. Detailed electrical telemetry and active polling remain scoped to the next Live Monitoring step.

## User journeys

- As a site owner, I can immediately tell whether my solar site is healthy and whether data is simulated.
- As a site owner, I can see current production, today's energy, consumption, battery state, and grid direction with units.
- As a site owner, I can understand today's generation trend, weather context, and current energy flow.
- As a site owner, I can review the next 48 hours, the highest-priority system message, and one useful action.
- As a new user without a site, I receive a configuration call to action instead of a broken dashboard.

## RED evidence

Commit `ebe6b60` records the missing dashboard simulation and overview modules.

```text
Test Files 2 failed (2)
Tests      no tests executed because the required modules did not exist
```

This compile-time RED state was caused by the intended missing Step 5 implementation.

## GREEN evidence

Commit `555a864` implements the deterministic snapshot generator, the responsive operational dashboard, and the database-scoped server page.

```text
Test Files 2 passed (2)
Tests      5 passed (5)
Type-check passed
```

## Test specification

| Guarantee | Evidence | Type |
|---|---|---|
| The simulator is deterministic for the same site and timestamp | `lib/dashboard/snapshot.test.ts` | Unit |
| Solar + battery + grid equals household load under the documented sign convention | `lib/dashboard/snapshot.test.ts` | Unit |
| Battery state remains bounded and two forecast days are produced | `lib/dashboard/snapshot.test.ts` | Unit |
| Health, source, units, flow direction, alert, and recommendation are visible | `components/dashboard/dashboard-overview.test.tsx` | Component |
| The trend has an accessible image name and detailed-page links have correct destinations | `components/dashboard/dashboard-overview.test.tsx` | Accessibility/component |
| A real seeded USER session reaches the dashboard and receives the Step 5 content | HTTP smoke test | Integration |

## Final verification

```text
Lint        passed
Type-check  passed
Test Files  17 passed (17)
Tests       48 passed (48)
Build       passed (21 routes)
HTTP        sign-in 200 -> dashboard 200
```

Coverage includes the new dashboard files:

```text
Statements 94.21%
Branches   80.00%
Functions  97.87%
Lines      95.61%
```

## Known boundary

This step produces reproducible in-process synthetic readings for the overview. It does not claim hardware measurement, persist minute-level telemetry, or poll every 10–30 seconds. Those responsibilities belong to the canonical telemetry/API and Live Monitoring step.
