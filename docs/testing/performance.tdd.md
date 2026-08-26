# Performance Dashboard - TDD Evidence

Date: 2026-08-17
Branch: `dev`

## Scope and journeys

This increment implements the user-facing solar Performance page from the Aelora roadmap.

- An authenticated owner can compare actual production with a transparent modeled estimate over 7, 30, or 90 days.
- The model uses configured DC capacity, stored irradiance, inverter efficiency, and the inverter AC limit.
- The page reports performance ratio, estimated losses, and telemetry availability without presenting the estimate as AI.
- Array cards distinguish healthy, underperforming, and insufficient-evidence states.
- Simulated and measured sources are labelled explicitly.
- All database evidence is scoped through the authenticated owner's site.

## RED evidence

The domain, service, and component tests were written before the implementation. The first focused run failed because the Performance modules did not exist.

```text
Test Files 3 failed (3)
Required performance domain, service, and dashboard modules were missing
```

## GREEN evidence

```text
Focused Test Files 3 passed (3)
Focused Tests      9 passed (9)
```

The focused suite covers inverter clipping, nighttime behavior, expected-versus-actual energy, measured/simulated provenance, numeric metric validation, per-array evidence thresholds, owner scoping, no-site behavior, operator-facing KPIs, and empty/healthy/underperforming/insufficient-data UI states.

## Compatibility evidence

The separate Python virtual gateway remained contract-compatible with Aelora after its control-console repair.

```text
Gateway tests                         35 passed
Aelora gateway/telemetry/history      18 passed
Live enrollment                       succeeded
Live telemetry publish                HTTP 201
Published arrays/devices              2 / 7
Telemetry schema                      1.0
Power-balance residual                0 W
```

## Security review

- The page calls `requireUser()` before querying data.
- The service selects the site by `ownerId` and scopes telemetry by the selected `siteId`.
- The range query is a strict 7/30/90-day allowlist, so database reads are bounded.
- Prisma parameterizes the queries; no raw SQL or string-built queries are used.
- Device JSON is treated as unknown data and only the known finite numeric `powerW` metric is accepted.
- React text rendering is used; no raw HTML is injected.
- No credentials, secrets, state-changing endpoints, or browser token storage were added.
- `npm audit` reported zero vulnerabilities.

## Final verification

```text
Lint        passed
Type-check  passed
Test Files  32 passed (32)
Tests       100 passed (100)
Build       passed
npm audit   0 vulnerabilities
```

The Performance files are included in the repository coverage allowlist. Final coverage remained above all configured thresholds:

```text
Statements 95.02%
Branches   85.62%
Functions  96.49%
Lines      97.44%

Performance dashboard
Statements 100%
Branches   96.66%
Functions  100%
Lines      100%

Performance domain/service
Statements 96.10%
Branches   88.33%
Functions  91.30%
Lines      100%
```

The in-app browser confirmed the authenticated route redirects an anonymous session to `/sign-in?callbackUrl=%2Fperformance`. Entering a seeded password was deliberately not automated without immediate user confirmation; the authenticated dashboard rendering is covered by the component suite.

## Known boundaries

- Expected output is a diagnostic estimate, not the AI forecast. It does not yet account for tilt, panel temperature, horizon shading, soiling, or degradation.
- Array observations currently match configured arrays by normalized display name. A later hardware-adapter increment should persist an explicit configuration-to-device mapping.
- The page reads raw bounded telemetry for up to 90 days. Materialized aggregates remain a later scale optimization.
- An underperformance signal is an investigation candidate, not proof of a physical fault.
