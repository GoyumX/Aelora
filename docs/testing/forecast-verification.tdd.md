# Forecast verification TDD evidence

## User journeys and safety boundary

This iteration implements the verification contract in
`docs/architecture/forecast-verification.md`:

1. A site owner can refresh labels only for forecast hours that ended at least
   one hour ago.
2. A label is persisted only when at least 95% of the site's expected telemetry
   samples exist inside that exact hour.
3. The owner can inspect daylight-only MAE, RMSE, signed bias, wMAPE, and the
   1–24, 25–48, and 49–168-hour slices.
4. A 90% retrospective error envelope appears only after 24 labels exist in a
   horizon slice.
5. Simulated, estimated, or mixed evidence cannot promote a production model;
   measured evidence that passes every gate still requires human review.
6. Cross-owner reads and refreshes remain hidden, and verification failures do
   not block the stored forecast.

## RED evidence

The pure-domain suite was written before its implementation and failed with:

```text
Failed to resolve import "@/lib/forecast/verification"
Test Files 1 failed
```

After the domain/service/API work, the component journey was still red with:

```text
Unable to find an accessible element with the role "heading" and name
"Prediction vs actual"
Tests 1 failed | 6 skipped
```

These were the expected missing-feature failures. Git checkpoints were not
created because the user retains responsibility for commits and pushes.

## GREEN evidence

The focused regression target passed after implementation:

```powershell
npm run test:run -- components/forecast/ai-forecast-dashboard.test.tsx lib/forecast/verification.test.ts lib/forecast/verification-service.test.ts app/api/sites/[siteId]/forecast/evaluation/route.test.ts --reporter=dot
```

Result: four files and 18 tests passed.

| Guarantee | Evidence |
| --- | --- |
| Complete interval integration, quality filtering, and incomplete-hour withholding | `lib/forecast/verification.test.ts` |
| Issue/artifact/valid-time deduplication and night-zero exclusion | `lib/forecast/verification.test.ts` |
| Horizon metrics, empirical q90 envelopes, and promotion gates | `lib/forecast/verification.test.ts` |
| Owner-scoped queries, idempotent persistence, and safe aggregate DTOs | `lib/forecast/verification-service.test.ts` |
| Authenticated no-store GET/POST evaluation contract | `app/api/sites/[siteId]/forecast/evaluation/route.test.ts` |
| Evidence, uncertainty, blocked-promotion, and refresh UI | `components/forecast/ai-forecast-dashboard.test.tsx` |

## Database and real-data evidence

- Additive migration `20260821183000_add_forecast_verification` applied to the
  local PostgreSQL `aelora` database.
- Before the gateway proof, `npm run forecast:verify` considered 26 completed
  forecast hours and withheld all 26 because their telemetry did not satisfy
  the 95% completeness rule.
- The separately running gateway then replayed one empty completed hour through
  120 authenticated 30-second HTTP batches. Aelora accepted all samples, stored
  four point verifications, and deduplicated them to one daylight evaluation
  label. The observed MAE was 1.352 kWh and wMAPE was 29.3%.
- Evidence quality is now `SIMULATED`, calibration remains `COLLECTING` at 1/24
  first-horizon labels, and promotion is `BLOCKED_SIMULATED_EVIDENCE`.
- Repeating the same replay accepted 120/120 idempotently with zero gateway
  queue depth; it did not duplicate canonical telemetry or poison retries.

## Final delivery gate

- Focused verification tests: four files and 18 tests passed.
- Full suite: 47 files and 155 tests passed.
- Coverage: 91.62% statements, 80.39% branches, 95.42% functions, and 95.46%
  lines; all configured 80% thresholds passed.
- ESLint and `tsc --noEmit` passed.
- Next.js 16.3 Turbopack production build passed and emitted the dynamic
  `/ai-forecast` page and `/api/sites/[siteId]/forecast/evaluation` route.
- `npm audit --audit-level=high` reported zero vulnerabilities.
- The local `/sign-in` HTTP smoke check returned 200. Browser visual regression
  is inconclusive because the configured Playwright extension is not installed;
  component accessibility queries remain the automated UI evidence for this
  iteration.

The next evidence task is to keep the gateway publishing continuously (or use
real devices), accumulate complete labels, and then assess local Sri Lankan
calibration. The inactive challenger remains blocked until those data exist.
