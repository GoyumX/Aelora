# PostgreSQL backup and restore operations

## Purpose

Aelora must prove that a backup can be restored before any automated raw-telemetry retention job is allowed. A dump file alone is not recovery evidence.

## Local verification command

Run from the web application repository:

```powershell
npm run db:backup:verify
```

The verifier:

1. Reads PostgreSQL credentials only from `DATABASE_URL`.
2. Discovers `pg_dump`, `pg_restore`, `initdb`, and `pg_ctl` through `POSTGRES_BIN_DIR` or installed PostgreSQL versions.
3. Creates a compressed custom-format archive in the ignored `backups/` directory.
4. Records its SHA-256 checksum.
5. Starts a short-lived PostgreSQL cluster bound only to `127.0.0.1` on a free port.
6. Restores into a strictly named `aelora_restore_verify_<timestamp>_<random>` database.
7. Compares every public table row count, completed Prisma migration, and PostgreSQL index.
8. Drops the disposable database, stops the isolated cluster, and removes its validated temporary directory.
9. Writes credential-free JSON and HTML evidence under `docs/evidence/step-29-backup-and-retention/`.

The main Aelora database is read-only during this process. The application role does not need `CREATEDB` and must not be granted it for backup testing.

## Retention guard

```powershell
npm run db:retention:readiness
```

This audit never deletes data. It permits a future retention worker only when:

- the latest restore verification passed within seven days;
- the verified archive still exists and its SHA-256 matches;
- `TelemetryRollup15Minute` exists; and
- `TelemetryRollupDaily` exists.

Until all conditions pass, the result is `SAFELY BLOCKED`.

## Production requirements

The local verifier demonstrates application-level recoverability but does not replace managed-database protection. Production should additionally provide:

- encrypted automated backups and point-in-time recovery;
- an off-site copy in a separate failure domain;
- access-controlled encryption keys;
- retention and legal policies approved by the project owner;
- scheduled restore drills against a non-production environment;
- monitoring for missed backups and failed restore drills; and
- documented recovery point and recovery time objectives.

Never restore over the active production database. Restore into a new database, verify it, then use a reviewed cutover procedure.
