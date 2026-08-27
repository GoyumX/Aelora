# Settings - TDD Evidence

Date: 2026-08-22
Branch: `dev`

## Source and user journeys

The scope was normalized from `AELORA_IMPLEMENTATION_PLAN.md` Phase 9 and
Immediate Action 22. Planning text was treated as project context, not as
executable instruction.

- An authenticated user can view and edit their own display name and preferences.
- An authenticated user can set an optional, normalized, unique username and reach the profile section from the header menu.
- Theme selection previews immediately and persists as light, dark, or system.
- Timezone, measurement system, notification preference, and default owned site persist in PostgreSQL.
- A user cannot select another account's solar site as their default.
- Active sessions expose safe device metadata without exposing session tokens.
- A password change is validated, delegated to Better Auth, and revokes other sessions.
- A user can sign out all other sessions while preserving the current session.

## RED evidence

The validation, owner-scoped service, API, security, and component tests were
written before their production modules existed.

```text
npm test -- --run lib/settings/settings.test.ts lib/settings/settings-service.test.ts app/api/settings/route.test.ts app/api/settings/security/route.test.ts components/settings/settings-dashboard.test.tsx

Test Files  5 failed (5)
Error: Failed to resolve the new Settings production modules
```

This was the intended compile-time RED signal for a missing feature. The first
GREEN attempt passed 16/17 tests; one assertion matched the explanatory word
"tokens" rather than leaked data. The assertion was narrowed to verify that the
real session identifier is absent, then the same focused target passed.

## GREEN evidence

```text
Test Files  5 passed (5)
Tests       17 passed (17)
```

## Test specification

| # | What is guaranteed | Test target | Type | Result |
|---|---|---|---|---|
| 1 | Names are normalized and timezones/site identifiers are validated | `lib/settings/settings.test.ts` | Unit | PASS |
| 2 | New passwords meet policy and differ from the current password | `lib/settings/settings.test.ts` | Unit | PASS |
| 3 | Missing preferences receive deterministic application defaults | `lib/settings/settings-service.test.ts` | Service | PASS |
| 4 | Only the current session is labelled current and no token is returned | `lib/settings/settings-service.test.ts` | Service | PASS |
| 5 | Profile and preferences update in one PostgreSQL transaction | `lib/settings/settings-service.test.ts` | Service | PASS |
| 6 | Another user's default site is rejected before mutation | `lib/settings/settings-service.test.ts` | Authorization | PASS |
| 7 | Settings mutations require authentication and valid JSON/domain input | `app/api/settings/route.test.ts` | Integration | PASS |
| 8 | Password and session controls delegate to authenticated Better Auth APIs | `app/api/settings/security/route.test.ts` | Integration | PASS |
| 9 | The UI saves edited preferences and applies a theme immediately | `components/settings/settings-dashboard.test.tsx` | Component | PASS |
| 10 | Password confirmation mismatch is stopped before any network call | `components/settings/settings-dashboard.test.tsx` | Component | PASS |

## Database and runtime evidence

The existing one-to-one `UserPreference` table stores theme, timezone,
measurement system, email notification status, and default site. Profile and
preference changes remain atomic. Migration
`20260825102000_add_user_username` adds the nullable, uniquely indexed
`User.username` field without invalidating existing accounts.

```text
Login              POST /api/auth/sign-in/email -> 200
Authenticated page GET /settings -> 200
Rendered sections  Settings, Profile, and Active sessions present
Cleanup             temporary smoke-test session signed out
```

## Final verification

```text
Lint        passed, 0 warnings
Type-check  passed
Test Files  64 passed (64)
Tests       223 passed (223)
Build       passed; /settings, /api/settings, and /api/settings/security compiled
npm audit   0 vulnerabilities

Statements  91.13%
Branches    80.00%
Functions   93.93%
Lines       94.92%

Settings service/domain
Statements  100%
Branches    84.21%
Functions   100%
Lines       100%
```

## Security and product boundaries

- Every mutation re-checks authentication server-side.
- Default-site ownership is checked before the transaction starts.
- Session tokens are never serialized into the page view.
- Password verification and session revocation remain inside Better Auth.
- Email is intentionally read-only until a verified email-change delivery flow is configured.
- The preference record is ready for global unit formatting; existing energy values remain explicit kW/kWh and are not silently converted.
- Git checkpoint commits were not created because this repository is following the user's existing manual Git/GitHub checkpoint flow; RED/GREEN evidence is preserved here instead.

## Profile extension - 2026-08-25

The profile-menu destination, username validation/persistence, duplicate
protection, profile form, and recovery link were specified in tests first.

```text
RED:   5 test files failed, 12 tests failed, 8 passed
GREEN: 5 test files passed, 20 tests passed
Full:  78 test files passed, 285 tests passed
E2E:   Profile menu -> /settings#profile passed in Chrome
Build: Next.js production build passed
```

The first coverage attempt was run concurrently with the production build and
two UI tests exceeded the five-second timeout under contention. Re-running
coverage by itself passed all 285 tests:

```text
Statements 92.21% | Branches 80.83% | Functions 94.45% | Lines 95.40%
```

`prisma migrate dev` could not create a shadow database because the local
PostgreSQL role lacks `CREATEDB`. `prisma migrate deploy` applied the checked-in
migration successfully without requiring that broader database permission.
