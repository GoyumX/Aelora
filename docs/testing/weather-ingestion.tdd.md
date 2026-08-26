# Weather ingestion - TDD evidence

Date: 2026-08-19
Branch: `dev`

## Scope

- Build a canonical seven-day Open-Meteo request in UTC.
- Validate and normalize current plus hourly weather and solar features.
- Persist current observations and immutable forecast runs atomically.
- Protect the owner-scoped read route and scheduler sync route.
- Show provider, timestamp, freshness, attribution, and honest gateway fallback on Dashboard.

## RED evidence

The provider contract tests were run before implementation. Four tests failed because the request did not default to UTC or record `best_match`, summaries lacked provenance and UTC `Date` values, misaligned arrays were accepted, and provider errors exposed an inconsistent internal message.

```text
Test Files 1 failed (1)
Tests      4 failed (4)
```

## Focused GREEN evidence

```text
Test Files 6 passed (6)
Tests      23 passed (23)
```

The focused suite covers request variables, UTC conversion, provider/model provenance, bounded array alignment, safe provider errors, azimuth conversion, capacity weighting, transactional persistence, retry keys, missing/inactive sites, bounded latest reads, batch throttling/failure isolation, exact bearer authorization, dashboard freshness, stale state, fallback labels, and attribution.

## Security and reliability checks

- External response bodies are not included in errors.
- Weather refresh is not exposed as a session-cookie browser mutation; owners read stored data while the bearer-protected scheduler performs refreshes.
- Scheduler sync uses an exact timing-safe bearer-secret comparison and is disabled when the secret is absent.
- Database writes occur in one transaction after the external request has completed and validated.
- Dashboard reads PostgreSQL only, so an Open-Meteo outage cannot break page rendering.
- UTC is used end to end for persistence; the site timezone is only a presentation concern.
- All queries use Prisma and bounded projections; raw provider metadata is not returned by the read service.

## Live integration evidence

The PostgreSQL migration was applied successfully and Prisma reported all six migrations current. A real Open-Meteo sync then completed for both configured sites:

```text
Attempted  2
Synced     2
Failed     0
```

An immediate second run verified the database-backed refresh floor:

```text
Attempted  2
Synced     0
Skipped    2
Failed     0
```

## Final repository verification

```text
Prisma schema/migration  valid and applied
Lint                     passed
Type-check               passed
Test Files               36 passed (36)
Tests                    116 passed (116)
Build                    passed
npm audit                0 vulnerabilities

Statements  93.25%
Branches    82.21%
Functions   97.00%
Lines       96.61%
```
