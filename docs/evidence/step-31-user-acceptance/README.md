# Step 31 — User acceptance evidence

This folder contains the role-based browser acceptance evidence for Chapter 7.

## Expected captures

| File | Suggested report caption |
| --- | --- |
| `01-user-dashboard.png` | Seeded USER successfully authenticated and viewing the assigned solar site. |
| `02-live-monitoring.png` | USER inspecting stored live-monitoring evidence. |
| `03-alerts.png` | USER inspecting durable, site-scoped operational incidents. |
| `04-ai-forecast.png` | USER reviewing the primary seven-day AI forecast experience. |
| `05-reports.png` | USER reviewing immutable weekly and monthly report history. |
| `06-system-configuration.png` | USER reviewing enrolled gateways and equipment configuration. |
| `07-help-and-support.png` | USER searching product guidance and support content. |
| `08-admin-console.png` | ADMIN viewing platform health and audited operational evidence. |
| `09-uat-summary.png` | Passing summary of all five automated acceptance journeys. |

`uat-results.json` is the machine-readable result, and `uat-results.html` is the credential-free report used to create the summary screenshot. Reproduce the pack with `npm run test:uat`.

## Verified local result

- Five of five role-based journeys passed.
- Zero journeys failed or were skipped.
- The separate report-capture check passed, producing six passing Playwright tests in total.
- The expanded complete browser suite passed 39 of 39 tests.
- The USER was redirected away from `/admin`; the ADMIN reached the protected console.
- The automated result does not replace the pending human assessor sign-off in the manual UAT document.
