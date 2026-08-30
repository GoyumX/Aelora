# Railway Prisma image-build regression evidence

## Source and user journey

This regression was derived from Railway deployment logs rather than a source
plan. As the deployment operator, I need a clean Docker build to make the Prisma
schema available when `npm ci` runs the package `postinstall`, so that Railway
can generate Prisma Client and continue building Aelora.

## RED evidence

Command:

```text
npm run test:run -- dockerfile.test.ts
```

Result: one test failed because the dependency stage did not contain
`COPY prisma/schema.prisma ./prisma/schema.prisma`. This reproduced Railway's
clean-build failure, where `npm ci` invoked `prisma generate` before the schema
existed in `/app`.

Checkpoint: `6ded62f test: reproduce missing Prisma schema in image build`.

## GREEN evidence

The Docker dependency stage now copies the schema after the package manifests
and before `RUN npm ci`.

The same targeted command passed: one test file and one test passed.

Checkpoint: `1016ddf fix: copy Prisma schema before container install`.

## Test specification

| Guarantee | Test or command | Type | Result |
| --- | --- | --- | --- |
| A clean dependency stage contains the Prisma schema before `npm ci` invokes postinstall | `dockerfile.test.ts` | Deployment contract | PASS |
| Existing application behavior remains intact | `npm run test:run` | Unit/integration | 90 files, 338 tests PASS |
| TypeScript remains valid | `npm run typecheck` | Static | PASS |
| Code style remains valid | `npm run lint` | Static | PASS |
| The production Next.js application builds | `npm run build` | Production build | PASS |

## Coverage and known gap

`npm run test:coverage` passed with 91.98% statements, 80.78% branches,
94.28% functions, and 95.28% lines. Docker Desktop was not running locally, so
the container image itself was not executed; the exact Docker stage ordering is
covered by the regression test and the next Railway deployment is the external
image-build verification.
