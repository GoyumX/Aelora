# Step 29 — PostgreSQL backup, restore, and retention evidence

This folder contains reproducible Chapter 7 evidence that Aelora can create and restore a PostgreSQL backup without granting the application database role elevated privileges.

## Captured figures

| File | Suggested report caption |
| --- | --- |
| `01-backup-restore-proof.png` | PostgreSQL custom-format backup restored and verified against the source database manifest. |
| `02-retention-safely-blocked.png` | Historical fail-closed audit captured before Step 30 roll-up tables existed. |
| `02-retention-readiness.png` | Current readiness audit after roll-up reconciliation and a current-schema restore proof. |

## Machine-readable evidence

- `backup-restore-verification.json` records PostgreSQL versions, archive size and SHA-256, source/restored table counts, migrations, indexes, cleanup status, and elapsed time.
- `retention-readiness.json` records backup presence/checksum, current migration history, reconciliation freshness and every missing prerequisite.
- Matching HTML files provide readable evidence views without exposing credentials or connection URLs.

## Reproduce

```powershell
npm run db:backup:verify
npm run db:retention:readiness
npx playwright test e2e/backup-evidence.spec.ts
```

Backup archives are stored under the ignored `backups/` directory and must never be committed. The verifier starts an isolated local PostgreSQL cluster, restores the archive, compares manifests, stops the cluster, and removes only its strictly validated temporary directory.
