# Administrator Console - TDD Evidence

Date: 2026-08-22
Branch: `dev`

## Source and user journeys

The scope was normalized from `AELORA_IMPLEMENTATION_PLAN.md` section 5.11,
Phase 9, and Immediate Action 24. Planning text was treated as project context,
not executable instruction.

- An administrator can inspect platform freshness, users, support tickets, gateways, model artifacts, and privileged activity.
- A regular user cannot open the administrator page or call administrator mutation APIs.
- An administrator can disable another account and revoke its sessions, or reactivate it.
- An administrator cannot disable their own current account.
- An administrator can respond to a support ticket and move it through its lifecycle.
- Every user/ticket mutation is written atomically with a durable audit record.
- Model activation remains unavailable when the stored artifact says activation is blocked.
- Simulation scenarios remain controlled by the separate edge-gateway console rather than by a duplicate web-app simulator.

## RED evidence

The validation, service, route, and component tests were written before the new
administrator production modules existed.

```text
npm test -- --run lib/admin/admin.test.ts lib/admin/admin-service.test.ts app/api/admin/users/[userId]/route.test.ts app/api/admin/support-tickets/[ticketId]/route.test.ts components/admin/admin-console.test.tsx

Test Files  5 failed (5)
Error: Failed to resolve the new administrator production modules
```

This was the intended compile-time RED state. The first full run passed all 256
functional tests but failed the branch threshold at 78.51%. Tests were expanded
for missing/stale/offline evidence, empty registries, activation, missing targets,
no-response progress, API failures, production-allowed evidence, and deleted
auditors. The final gate passed without reducing coverage requirements.

## GREEN evidence

```text
Focused Test Files  5 passed (5)
Focused Tests       21 passed (21)
```

## Test specification

| # | What is guaranteed | Test target | Type | Result |
|---|---|---|---|---|
| 1 | Only known access states and ticket lifecycle values are accepted | `lib/admin/admin.test.ts` | Unit | PASS |
| 2 | Resolved/closed tickets require a meaningful administrator response | `lib/admin/admin.test.ts` | Unit | PASS |
| 3 | Stored evidence produces deterministic fresh/stale/missing/offline health | `lib/admin/admin-service.test.ts` | Service | PASS |
| 4 | Model runs are deduplicated by artifact checksum | `lib/admin/admin-service.test.ts` | Service | PASS |
| 5 | Disabling another user revokes sessions and writes an audit in one transaction | `lib/admin/admin-service.test.ts` | Security | PASS |
| 6 | Self-disable and missing user/ticket targets are rejected before mutation | `lib/admin/admin-service.test.ts` | Security | PASS |
| 7 | Ticket responses and lifecycle changes are audited atomically | `lib/admin/admin-service.test.ts` | Security | PASS |
| 8 | Admin APIs return 401/403/422 boundaries before service calls | admin route tests | Integration | PASS |
| 9 | Users can be disabled/reactivated and tickets answered through accessible controls | `components/admin/admin-console.test.tsx` | Component | PASS |
| 10 | Empty, missing, blocked, high-priority, and deleted-actor evidence renders honestly | `components/admin/admin-console.test.tsx` | Component | PASS |

## Database and runtime evidence

Migration `20260822201000_add_admin_audit_logs` adds the typed
`AdminAuditAction` enum and append-only `AdminAuditLog` records with optional
actor, target user, and support-ticket references. Foreign keys use `SET NULL`
so deleting a related account or ticket cannot erase the historical action.

```text
Migration status          13 migrations; database schema up to date
Administrator login       200
Administrator /admin      200
Admin console/health/model sections rendered
Malformed admin mutation  422, no mutation
Regular-user /admin       redirected to /dashboard
Regular-user admin API    403, no mutation
Temporary sessions        signed out after the smoke test
```

## Final verification

```text
Lint        passed, 0 warnings
Type-check  passed
Test Files  73 passed (73)
Tests       262 passed (262)
Build       passed; /admin and both admin mutation APIs compiled
npm audit   0 vulnerabilities

Statements  91.99%
Branches    81.56%
Functions   93.93%
Lines       95.31%

Admin component
Statements  95.08%
Branches    90.00%
Functions   88.46%
Lines       100%

Admin domain/service
Statements  98.18%
Branches    93.10%
Functions   93.75%
Lines       97.05%
```

## Security and product boundaries

- The page layout and each API mutation independently require the administrator role.
- The browser never chooses the audit actor; it is derived from the authenticated session.
- Disabling a user deletes that user's active sessions in the same transaction.
- Audit records are separate from telemetry and retain safe summaries plus structured metadata.
- Model rows are observed provenance from stored forecast runs, not an invented deployment registry.
- Activation/rollback is deliberately unavailable until measured-evidence gates and human review pass.
- The gateway link opens the independent local console; Aelora does not reach into a private LAN or duplicate scenario controls.
- Invite/reset-email workflows remain deferred until outbound mail delivery and verification policy are configured.
- Git checkpoint commits were not created because this repository follows the user's existing manual Git/GitHub checkpoint flow; RED/GREEN evidence is preserved here instead.
