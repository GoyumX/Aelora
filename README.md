This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

For AI Forecast, also run the sibling `aelora-ml-service` on
`http://127.0.0.1:8000`. Put the same private
`AELORA_ML_INTERNAL_API_TOKEN` in both projects and configure
`AELORA_ML_BASE_URL` only in this Next.js server environment. See
[`docs/architecture/forecast-inference.md`](docs/architecture/forecast-inference.md)
for the full flow and local prerequisites.

To refresh stored weather and rerun only AI forecasts older than 12 hours:

```bash
npm run intelligence:refresh
```

To create a local PostgreSQL custom archive, restore it into an isolated
temporary cluster, and verify schema and row-count parity:

```bash
npm run db:backup:verify
npm run db:retention:readiness
npm run db:rollups:backfill
npm run db:rollups:verify
npm run db:retention:dry-run
```

Backup archives are written to the ignored `backups/` directory. See
[`docs/operations/postgresql-backup-and-restore.md`](docs/operations/postgresql-backup-and-restore.md)
for recovery behavior and production requirements.

Schedule `POST /api/internal/telemetry-rollups` every 15 minutes with the same
private scheduler bearer secret. It idempotently refreshes a trailing two-hour
window so delayed gateway readings are incorporated. See
[`docs/operations/telemetry-rollups-and-retention.md`](docs/operations/telemetry-rollups-and-retention.md).

In deployment, schedule `POST /api/internal/intelligence-refresh` every 30
minutes with `Authorization: Bearer <WEATHER_SYNC_SECRET>`. The endpoint applies
the same persisted freshness gates, so weather is fetched before inference and
fresh forecasts are skipped.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:coverage
npm run test:e2e
npm run build
```

The Playwright suite starts or reuses Aelora on `http://localhost:3000` and
checks public, seeded-user, and seeded-admin flows with axe-core. Configure
`SEED_USER_PASSWORD` and `SEED_ADMIN_PASSWORD` in the local `.env`; credentials
are read at runtime and are not stored in the tests. On Windows the suite uses
installed Google Chrome by default. Set `PLAYWRIGHT_EXECUTABLE_PATH` to select a
different browser executable. Generated reports are ignored by Git. See
[`docs/testing/accessibility-responsive.tdd.md`](docs/testing/accessibility-responsive.tdd.md)
for the latest browser-QA evidence and known manual follow-ups.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
