# Database and Authentication Setup

## Local development

1. Copy `.env.example` to `.env` and replace every placeholder. Never commit `.env`.
2. Start PostgreSQL with `docker compose up -d postgres`, or use an existing local PostgreSQL service and create the database/role named by `DATABASE_URL`.
3. Apply the migration with `npm run db:deploy`.
4. Create the development accounts and simulated sites with `npm run db:seed`.
5. Start Aelora with `npm run dev`.

The seed is idempotent. It requires explicit `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD` values and does not contain password defaults in source control.

## Deployment

- Use managed PostgreSQL with a runtime pooled URL where the provider recommends it.
- Run `npm run db:deploy` during the release process; never run `prisma migrate dev` in staging or production.
- Store `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` in the hosting platform's secret manager.
- Use a unique 32-byte-or-longer `BETTER_AUTH_SECRET` per environment.
- Do not deploy seed credentials or run the development seed against shared environments.

## Security boundary

- `proxy.ts` performs only an optimistic session-cookie redirect.
- Protected layouts perform the authoritative database-backed session check.
- Admin layouts additionally require the `ADMIN` role.
- Site-scoped handlers must use `canAccessSite()` and scope their database query to the owner before returning data.
- Authentication endpoints use Better Auth's secure cookie/session implementation and built-in rate limiting.

Password-reset UI is intentionally marked as pending until a transactional email provider is connected. Reset URLs and tokens must never be printed to logs.
