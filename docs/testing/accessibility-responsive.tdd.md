# Accessibility and responsive browser QA evidence

Date: 2026-08-24
Branch: `dev`

## Scope and journeys

This milestone implements the first part of Phase 10 hardening. The journeys
were derived from `AELORA_IMPLEMENTATION_PLAN.md`:

1. A public visitor can use the landing and authentication pages without an
   automated WCAG A/AA violation.
2. A user can navigate every workspace route at 375 px without page-level
   horizontal overflow and with a single, named page heading.
3. A keyboard user can skip repeated navigation and reach main content.
4. A user who submits invalid authentication data is moved to the invalid field,
   and the field identifies its error text programmatically.
5. Wide data tables remain keyboard reachable when they scroll horizontally.
6. Historical chart points remain pointer-hoverable and keyboard focusable
   without nesting interactive controls inside an image role.
7. Light and dark themes preserve the automated WCAG A/AA checks.
8. The administrator console receives the same accessibility and mobile-reflow
   gate as the user workspace.

## RED evidence

The initial real-browser audit found:

- Five landing-page contrast failures.
- Two dashboard weather-card contrast failures.
- Six Live Monitoring critical-status contrast failures.
- AI Forecast contrast plus `scrollable-region-focusable` failures.
- A `nested-interactive` failure in the Historical Analytics SVG.
- Additional alert/report/configuration status contrast failures.
- Authentication validation did not focus the invalid field or associate it
  with the rendered error.
- Protected routes inherited only the generic `Aelora` document title.

The focused Playwright RED run reproduced the dashboard, forecast, historical
chart, landing, and form failures. The first harness run also exposed two test
infrastructure issues (missing optional ffmpeg and an origin mismatch); those
were corrected before accepting RED evidence.

## Implementation

- Added Playwright and axe-core as development-only dependencies and isolated
  Playwright specs from Vitest discovery.
- Added automated public, authenticated-user, and authenticated-admin browser
  checks using seeded local-only accounts without embedding credentials.
- Strengthened light-theme destructive/critical contrast and specific landing,
  dashboard, forecast, and report foreground pairs.
- Made generic and forecast-specific horizontally scrollable tables labelled,
  focusable regions.
- Changed the interactive historical SVG from an image container to a named
  group so its focusable chart points are valid descendants.
- Added field-level `aria-invalid`, `aria-describedby`, error IDs, and focus
  movement to sign-in/sign-up validation.
- Added descriptive Next.js metadata to authentication, user, equipment, and
  admin pages.
- Added mobile/tablet/desktop dashboard captures as Playwright attachments and
  verified dark mode through the real theme menu.
- Ignored generated Playwright reports and results so they do not appear in Git.

## Test specification

| # | Guarantee | Evidence | Result |
|---|---|---|---|
| 1 | Four public routes have no automated WCAG A/AA violation | `e2e/accessibility.spec.ts` | PASS |
| 2 | Thirteen user routes pass axe, mobile reflow, heading, and title checks | `npm run test:e2e` | PASS |
| 3 | Admin console passes axe and 375 px reflow | `npm run test:e2e` | PASS |
| 4 | Invalid sign-in focuses and identifies the email error | Playwright validation journey | PASS |
| 5 | Skip link transfers focus to `#main-content` | Playwright keyboard journey | PASS |
| 6 | Dashboard does not overflow at 375, 768, or 1440 px | Three-breakpoint Playwright journey | PASS |
| 7 | Dashboard remains axe-clean after selecting Dark through the UI | Dark-mode Playwright journey | PASS |
| 8 | Existing component/domain/API behavior remains intact | `npm run test:run` | 262/262 PASS |

## Final verification

```text
npm run test:e2e
21 passed (53.2s)

npm run test:run
73 files passed
262 tests passed

npm run test:coverage
Statements 92.32%
Branches   81.63%
Functions  94.60%
Lines      95.39%

npm run lint       PASS (0 errors, 0 warnings)
npm run typecheck  PASS
npm run build      PASS
npm audit          0 vulnerabilities
```

## QA verdict and known gaps

Verdict: **SHIP WITH FOLLOW-UP** for this local accessibility/responsive gate.
There are no blockers from the automated checks or the keyboard journeys run.

Axe covers only part of WCAG. A manual screen-reader pass, 400% zoom/text-only
reflow inspection, and production-browser/device sampling are still required.
The three viewport screenshots are run attachments rather than committed visual
baselines, so visual regression comparison is **INCONCLUSIVE**, not a claimed
pass. Security hardening is the next Phase 10 milestone.
