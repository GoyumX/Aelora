# Forecast integration TDD evidence

## Source and journeys

Journeys were derived from `AELORA_IMPLEMENTATION_PLAN.md` Phase 6 and the
implemented FastAPI contract:

1. An authenticated owner generates a site forecast without exposing the
   server-to-server token.
2. A complete stored weather issue and effective active-array capacity become
   the exact inference input.
3. A validated result is stored atomically as one run and its hourly points.
4. Missing/inaccessible sites and incomplete prerequisites fail safely.
5. The AI Forecast page renders stored 48-hour/seven-day evidence and clearly
   labels the inactive challenger and next-month limitation.

## RED evidence

Before application or schema implementation, the focused client test failed at
compile/import time with:

```text
Failed to resolve import "@/lib/forecast/ml-client"
Test Files 1 failed
```

This was the expected missing-feature RED state. Git checkpoints were not
created because the user retains responsibility for commits and pushes; the
evidence is preserved here instead.

## GREEN evidence

The same focused target passed after implementation:

```powershell
npm run test:run -- lib/forecast/ml-client.test.ts lib/forecast/forecast-service.test.ts app/api/sites/[siteId]/forecast/route.test.ts components/forecast/ai-forecast-dashboard.test.tsx --reporter=verbose
```

Result at GREEN: four files and 13 tests passed. The final focused regression
target included the owner-scoped latest-read route: five files and 16 tests
passed.

## Test specification

| Guarantee | Evidence | Type |
| --- | --- | --- |
| Bearer token is used only by the server client; responses are schema validated | `lib/forecast/ml-client.test.ts` | Unit/integration boundary |
| Non-2xx and malformed model results fail with safe typed errors | `lib/forecast/ml-client.test.ts` | Error-path unit |
| Owner scope, active capacity, stored weather mapping, and atomic nested persistence are enforced | `lib/forecast/forecast-service.test.ts` | Service integration |
| Missing weather and cross-owner sites never invoke inference | `lib/forecast/forecast-service.test.ts` | Authorization/error path |
| Generate/read routes require a session and disable caching | `app/api/sites/[siteId]/forecast/**/*.test.ts` | Route integration |
| UI shows 48-hour/seven-day evidence, inactive status, provenance, and first-run state | `components/forecast/ai-forecast-dashboard.test.tsx` | Component |

## Final delivery gate

- Additive migration `20260821105000_add_solar_forecast_runs` applied; Prisma
  reports all seven migrations up to date.
- Full Vitest coverage: 41 files and 132 tests passed.
- Coverage: 92.25% statements, 80.32% branches, 96.25% functions, and 95.77%
  lines; all configured 80% thresholds passed.
- ESLint and `tsc --noEmit` passed.
- Next.js 16.3 Turbopack production build passed and emitted both forecast
  routes plus the dynamic `/ai-forecast` page.
- `npm audit --audit-level=high` reported zero vulnerabilities.
- Real local smoke: Open-Meteo synced two active sites with zero failures;
  FastAPI readiness returned the checksum-matched inactive Random Forest; one
  `Colombo Home` forecast persisted 162 future hourly points and 278.761544 kWh
  total while `productionActivationAllowed` remained `false`.

Known follow-ups are a browser-level authenticated E2E test, joins to later
telemetry actuals, horizon-calibrated uncertainty, and a separately validated
monthly range. None is represented as complete in the UI.
