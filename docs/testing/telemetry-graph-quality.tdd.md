# Telemetry graph quality - TDD evidence

Date: 2026-08-25
Branch: `dev`

## User journey

As a simulator user, I want realistic but still imperfect power curves so that
Dashboard and Live Monitoring remain readable and honestly show missing gateway
periods.

## Design boundary

- The virtual gateway continues publishing raw readings at the configured
  cadence through the unchanged authenticated telemetry contract.
- Seeded values are interpolated between time anchors, so replays remain
  deterministic while adjacent samples retain temporal correlation.
- Aelora averages only the display series into five-minute buckets. Raw
  PostgreSQL telemetry remains available to analytics, alerts, reports, and ML.
- Missing five-minute windows start a new SVG line segment. The UI does not
  invent values across gateway downtime.

## RED evidence

```text
Gateway: continuity test failed; maximum adjacent household jump was 3288.73 W.
Web: 3 tests failed; 20 raw points were returned, gap flags were absent, and
     the chart rendered 2 connected polylines instead of 4 separated segments.
```

## GREEN evidence

```text
Gateway focused engine suite: 9 passed
Web focused telemetry/chart/dashboard/monitoring suite: 32 passed
```

## Final verification gates

```text
Virtual gateway: 39 passed; 91.38% statement coverage
Virtual gateway: Ruff passed; Python compile check passed
Aelora web app: 288 passed
Aelora web app: lint passed; typecheck passed; production build passed
Aelora web app: 92.47% statements, 81.04% branches,
                95.14% functions, 95.45% lines
```

The web coverage suite was run by itself for the recorded result. An earlier
concurrent build-and-coverage attempt caused an unrelated Help & Support UI
test to exceed its five-second timeout; that same test passed in the isolated
full-suite rerun.

## Test specification

| Guarantee | Test | Type | Result |
|---|---|---|---|
| Adjacent 30-second load and irradiance changes are bounded but non-static | `tests/test_engine.py` | Unit | PASS |
| Dense raw data is averaged into five-minute display buckets | `lib/telemetry/persisted-snapshot.test.ts` | Unit | PASS |
| Missing windows are marked without invented readings | `lib/telemetry/persisted-snapshot.test.ts` | Unit | PASS |
| SVG series render separate segments across a marked gap | `components/charts/interactive-power-chart.test.tsx` | Component | PASS |

Git checkpoint commits were not created because the user owns the existing
manual Git/GitHub flow. RED/GREEN evidence is preserved here.
