# System Configuration - TDD Evidence

Date: 2026-08-10
Branch: `dev`

## Scope

Step 7 replaces the System Configuration placeholders with owner-scoped, PostgreSQL-backed configuration for site details, solar arrays, a primary inverter, and an optional battery.

## User journeys

- A signed-in owner can review installed capacity and open each equipment area.
- The owner can update site location and timezone for simulation and future weather services.
- The owner can add a uniquely named solar array with panel, orientation, installation, and temperature-coefficient data.
- The owner can create or update the primary inverter without storing hardware credentials.
- The owner can enable or disable an optional battery and configure safe state-of-charge limits.
- Saved active solar-array capacity changes Dashboard and Live Monitoring simulator output.
- Anonymous requests receive `401`; a regular user receives `404` for another owner's site.

## RED evidence

Commit `9b57045` captured the missing configuration schemas and add-array form.

```text
Test Files 2 failed (2)
Reason     required configuration modules did not exist
```

## GREEN evidence

Focused configuration result:

```text
Test Files 2 passed (2)
Tests      5 passed (5)
```

The coverage scope explicitly includes configuration validation and the add-array workflow.

```text
Statements 95.76%
Branches   87.34%
Functions  95.00%
Lines      97.23%
```

## Database and security verification

The forward-only migration `20260810010000_add_equipment_configuration` adds `SolarArray`, `Inverter`, and `Battery`, indexes every site foreign key, and applies cascade behavior only to equipment owned by a deleted site. The development seed is idempotent.

```text
Prisma migration status      up to date (2 migrations)
Seeded arrays                2
Installed capacity           6160 W
Seeded primary inverters     1
Seeded battery               enabled

Authenticated config pages  200 (all 4)
Owner site PATCH             200
Cross-owner site PATCH       404
Inverter PUT                 200
Battery PUT                  200
Anonymous battery PUT        401
```

## Final verification

```text
Lint        passed
Type-check  passed
Test Files  21 passed (21)
Tests       64 passed (64)
Build       passed (25 routes including 4 configuration APIs)
```

## Known boundary

This increment supports adding arrays and updating the primary inverter and battery. Array edit, duplicate, archive/history controls, multiple-inverter management, a connection test, and first-site creation remain later configuration increments. Hardware credentials must eventually use a secret manager and must never be returned to the browser.
