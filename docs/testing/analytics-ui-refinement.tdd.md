# Analytics UI Refinement — TDD Evidence

Date: 2026-08-25
Branch: `dev`

## Scope and user journeys

Journeys were derived directly from the requested Performance, Historical Analytics, and Dashboard refinements.

- An owner can compare actual and predicted daily production using visually distinct series and inspect exact values by mouse or keyboard.
- Array-health evidence appears below the primary Performance chart rather than reducing chart width.
- An owner can select one site-local calendar date and load only that day of historical telemetry.
- Historical Analytics omits the weather-correlation and calculation-explanation cards.
- The Dashboard observed-power chart is constrained to a readable width and omits the requested description.

## RED evidence

Command:

```text
npm test -- --run components/performance/performance-dashboard.test.tsx components/analytics/historical-analytics.test.tsx components/dashboard/dashboard-overview.test.tsx lib/time/zoned.test.ts --reporter=dot --maxWorkers=2
```

Result:

```text
Test Files  4 failed (4)
Tests       5 failed | 10 passed (15)
```

The failures demonstrated the missing interactive predicted-production chart, calendar-date control, timezone-aware local-day range, removed sections, and constrained Dashboard chart.

## GREEN evidence

The same focused command passed after implementation:

```text
Test Files  4 passed (4)
Tests       15 passed (15)
```

## Test specification

| Guarantee | Evidence | Type | Result |
|---|---|---|---|
| Performance shows distinct actual and predicted values with an interactive tooltip | `components/performance/performance-dashboard.test.tsx` | Component integration | PASS |
| Array health follows the full-width production chart | `components/performance/performance-dashboard.test.tsx` | Component integration | PASS |
| Historical Analytics exposes a labeled native date control and omits both requested cards | `components/analytics/historical-analytics.test.tsx` | Component integration | PASS |
| A selected Colombo date maps to the correct site-local midnight-to-midnight UTC interval | `lib/time/zoned.test.ts` | Unit | PASS |
| Dashboard removes the requested copy and constrains the observed chart to the design width | `components/dashboard/dashboard-overview.test.tsx` | Component integration | PASS |
| All three affected pages satisfy automated WCAG and mobile-reflow checks | targeted Playwright run | Browser E2E | PASS |

## Final verification

```text
Full suite          78 test files; 279 tests passed
ESLint              passed
TypeScript          passed
Production build    passed
Targeted browser    3 Playwright tests passed
```

Coverage was not rerun for this presentation-focused increment. The new behavior is covered at component, utility, full-suite, production-build, and browser-accessibility levels. No checkpoint commits were created because repository publishing and Git history remain user-controlled.
