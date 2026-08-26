# Help & Support - TDD Evidence

Date: 2026-08-22
Branch: `dev`

## Source and user journeys

The scope was normalized from `AELORA_IMPLEMENTATION_PLAN.md` section 5.10,
Phase 9, and Immediate Action 23. Planning text was treated as project context,
not executable instruction.

- An authenticated user can search practical guides and frequently asked questions.
- Guidance explains setup, simulation, forecasting, equipment, alerts, reports, and evidence limitations.
- A user can create a validated local support ticket for their account and optionally an owned site.
- Another user's site cannot be attached to the ticket.
- A user can review their latest tickets, statuses, priority, site, and administrator response.
- Ticket data remains local to PostgreSQL; email delivery is explicitly not implied.

## RED evidence

Content, validation, service, route, and component tests were written before the
production modules existed.

```text
npm test -- --run lib/support/support.test.ts lib/support/support-service.test.ts app/api/support-tickets/route.test.ts components/support/help-support-dashboard.test.tsx

Test Files  4 failed (4)
Error: Failed to resolve the new Help & Support production modules
```

This was the intended compile-time RED state. The initial full suite then passed
all 237 functional tests but correctly failed the branch threshold at 79.16%.
Additional user-behaviour tests covered empty results, empty tickets, ticket API
errors, site-free tickets, high priority, lifecycle states, and administrator
responses. The final coverage gate passed without lowering the threshold.

## GREEN evidence

```text
Focused Test Files  4 passed (4)
Focused Tests       18 passed (18)
```

## Test specification

| # | What is guaranteed | Test target | Type | Result |
|---|---|---|---|---|
| 1 | Search matches guide titles, summaries, steps, questions, and answers | `lib/support/support.test.ts` | Unit | PASS |
| 2 | Empty search returns all curated guidance | `lib/support/support.test.ts` | Unit | PASS |
| 3 | Ticket fields are trimmed, bounded, and restricted to known categories/priorities | `lib/support/support.test.ts` | Unit | PASS |
| 4 | Ticket history queries only the authenticated user's records | `lib/support/support-service.test.ts` | Authorization | PASS |
| 5 | A linked site must belong to the ticket owner | `lib/support/support-service.test.ts` | Authorization | PASS |
| 6 | The route requires authentication and rejects malformed data before persistence | `app/api/support-tickets/route.test.ts` | Integration | PASS |
| 7 | Guide/FAQ search visibly filters unrelated results | `components/support/help-support-dashboard.test.tsx` | Component | PASS |
| 8 | A successful ticket is sent to the API and added to local history | `components/support/help-support-dashboard.test.tsx` | Component | PASS |
| 9 | Server and undecodable error responses produce safe user feedback | `components/support/help-support-dashboard.test.tsx` | Component | PASS |
| 10 | Empty, high-priority, lifecycle, no-site, and admin-response states render honestly | `components/support/help-support-dashboard.test.tsx` | Component | PASS |

## Database and runtime evidence

Migration `20260822194000_add_support_tickets` adds typed category, priority,
and lifecycle enums plus the owner/site-scoped `SupportTicket` table. A nullable
site relationship uses `SET NULL`, while deleting an account cascades its
tickets. Owner, status/priority, and site/status query paths are indexed.

```text
Migration status  12 migrations; database schema up to date
Login             POST /api/auth/sign-in/email -> 200
Help page         GET /help -> 200
Ticket creation   POST /api/support-tickets -> 201
Persistence       returned ticket ID and ticket rendered on refreshed /help
Content smoke     getting-started guide and FAQ rendered
Cleanup           temporary authentication session signed out
```

One clearly labelled sample ticket, `Demo: virtual gateway connection help`,
was intentionally retained for manual review with the seeded user account.

## Final verification

```text
Lint        passed, 0 warnings
Type-check  passed
Test Files  68 passed (68)
Tests       241 passed (241)
Build       passed; /help and /api/support-tickets compiled
npm audit   0 vulnerabilities

Statements  91.61%
Branches    80.46%
Functions   94.26%
Lines       95.16%

Help component
Statements  100%
Branches    94.11%
Functions   100%
Lines       100%

Support domain/service
Statements  100%
Branches    87.50%
Functions   100%
Lines       100%
```

## Product and security boundaries

- Authentication is checked inside the Route Handler, not only in the page.
- Site ownership is checked before ticket persistence.
- The browser never supplies or selects a user ID; the server derives it from the session.
- The page explicitly distinguishes simulation, model, and operational-safety boundaries.
- Tickets are local records. Email, attachments, public comments, service-level guarantees, and real-time chat are deferred.
- Administrator response fields are modeled and visible to the owner, but the admin ticket-management workflow belongs to the next milestone.
- Git checkpoint commits were not created because this repository follows the user's existing manual Git/GitHub checkpoint flow; RED/GREEN evidence is preserved here instead.
