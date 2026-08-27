# Forecast and dashboard realism — TDD evidence

Date: 2026-08-21
Branch: `dev`

## Scope

- Compare Random Forest solar generation with a separately identified household
  load profile across selectable 24-hour, 48-hour, and 7-day charts.
- Label forecast time and power axes.
- Persist household estimates and their method with every forecast run/point;
  do not invent a usage line when no telemetry history exists.
- Render dashboard weather from the site coordinates and timezone configured in
  System Configuration, including irradiance, cloud/rain, humidity, and wind.
- Show only actual stored telemetry times, remove the duplicated live-energy
  block, and summarize the latest persisted AI run without fabricated confidence.
- Reveal historical generation and consumption values on pointer hover and
  keyboard focus, while explicitly identifying historical analytics as
  deterministic rather than AI-generated.

## RED evidence

The focused tests were written before implementation. Five suites failed with
nine behavior failures: the load-profile module did not exist, forecast horizon
controls and axes were absent, the dashboard still duplicated metrics and drew
fixed future time labels, weather lacked configured-location context, and the
historical chart exposed no interactive past-bucket target.

## GREEN evidence

The focused forecast, service, dashboard, snapshot, and historical suites passed
after implementation. The final full result is:

```text
Test Files  44 passed (44)
Tests       142 passed (142)
```

Coverage passed all configured gates:

```text
Statements  92.30%
Branches    80.30%
Functions   95.40%
Lines       95.62%
```

TypeScript, ESLint, the Next.js 16.3 Turbopack production build, Prisma migration
`20260821113000_add_household_load_forecast`, and `npm audit --audit-level=high`
all passed. The user owns Git commits and pushes, so no commit was created.

Saving site coordinates/timezone also calls the owner-scoped weather refresh
route. A provider failure does not roll back valid site settings: the form says
that refresh is pending and the dashboard keeps the explicitly dated last stored
observation until the next successful sync.
