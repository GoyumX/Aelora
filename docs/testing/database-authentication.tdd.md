# Database and Authentication — TDD Evidence

## Scope and journeys

The journeys were derived from `AELORA_IMPLEMENTATION_PLAN.md` and the Step 3 roadmap:

- A user can register and sign in with validated email/password credentials.
- A guest cannot render authenticated application pages.
- A regular user cannot enter the admin area.
- An administrator receives admin navigation and may enter the admin area.
- A user may access an owned site, while cross-owner access is denied unless the actor is an administrator performing an audited operation.
- The authenticated shell displays persisted user and site identity rather than demo labels.

## RED evidence

`npm test -- --run lib/auth/validation.test.ts lib/auth/authorization.test.ts components/auth/sign-in-form.test.tsx lib/navigation.test.ts`

Failed because the validation, authorization, auth client/form, and role-aware navigation modules did not exist. The RED checkpoint is `029a8a7`.

`npm test -- --run components/auth/sign-up-form.test.tsx lib/auth/route-access.test.ts components/shell/app-header.test.tsx components/shell/app-sidebar.test.tsx`

Failed because registration and route-access modules did not exist and the shell ignored supplied identity/role data. The RED checkpoint is `fe817c1`.

`npm test -- --run next.config.test.ts`

Failed because browser security headers were absent. The RED checkpoint is `f82a320`.

## GREEN evidence

- Core identity contract: 4 files passed, 19 tests passed.
- Registration/protected shell contract: 4 files passed, 10 tests passed.
- Security headers: 1 file passed, 1 test passed.
- Complete suite: 11 files passed, 36 tests passed.
- Coverage: 95.83% statements, 89.70% branches, 96.15% functions, and 95.77% lines.

## Guarantees

| Guarantee | Evidence | Type |
| --- | --- | --- |
| Sign-in input is normalized and invalid input is rejected before an API call | `lib/auth/validation.test.ts`, `components/auth/sign-in-form.test.tsx` | Unit/component |
| Callback paths reject external and protocol-relative redirects | `lib/auth/validation.test.ts` | Security unit |
| Registration requires a stronger password and hides provider errors | `components/auth/sign-up-form.test.tsx` | Component |
| USER and ADMIN authorization is fail-closed | `lib/auth/authorization.test.ts` | Unit |
| Cross-owner site access is denied to a USER | `lib/auth/authorization.test.ts` | Security unit |
| Guests and regular users receive the correct protected-route redirect | `lib/auth/route-access.test.ts` | Unit |
| Admin navigation is role-specific | `lib/navigation.test.ts`, `components/shell/app-sidebar.test.tsx` | Unit/component |
| Authenticated name and site are rendered in the shell | `components/shell/app-header.test.tsx` | Component |
| Baseline anti-framing, MIME, referrer, and device headers cover all routes | `next.config.test.ts` | Configuration unit |

## Database and migration evidence

- `npx prisma validate`: schema valid.
- `npm run db:generate`: Prisma Client 6.12.0 generated.
- The checked-in initial migration was generated with `prisma migrate diff --from-empty` and byte-normalized against the current schema during final verification.
- Applying the migration to the local Docker PostgreSQL instance could not be completed because Docker Hub rejected the image download: the machine clock preceded the registry certificate's validity window. This is an environment verification gap, not a schema-generation failure. Run `docker compose up -d postgres`, `npm run db:deploy`, and `npm run db:seed` after the host clock/certificate issue is corrected.

## Deliberate follow-ups

- Transactional email is not connected yet; the password-reset page explicitly communicates this and never logs reset tokens.
- Site configuration beyond the ownership/site foundation belongs to the next data-model and onboarding phase.
- Database-backed end-to-end sign-up/sign-in testing is pending the local PostgreSQL image availability described above.
