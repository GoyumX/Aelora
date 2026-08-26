export type BackupManifest = {
  migrations: string[];
  tables: Record<string, number>;
  indexes: string[];
};

export type BackupEvidence = {
  passed: boolean;
  verifiedAt: string;
};

const disposableRestorePattern = /^aelora_restore_verify_\d{8}t\d{6}_[a-f0-9]{8}$/;
const requiredRollupTables = ["TelemetryRollup15Minute", "TelemetryRollupDaily"] as const;

export function compareBackupManifests(source: BackupManifest, restored: BackupManifest) {
  const differences: string[] = [];

  if (JSON.stringify(source.migrations) !== JSON.stringify(restored.migrations)) {
    differences.push("Migration history differs.");
  }

  for (const table of Object.keys(source.tables).sort()) {
    const restoredCount = restored.tables[table];
    if (restoredCount === undefined) {
      differences.push(`Table ${table} is missing from the restore.`);
    } else if (restoredCount !== source.tables[table]) {
      differences.push(`Table ${table} expected ${source.tables[table]} rows but restored ${restoredCount}.`);
    }
  }

  for (const table of Object.keys(restored.tables).sort()) {
    if (source.tables[table] === undefined) {
      differences.push(`Unexpected table ${table} exists in the restore.`);
    }
  }

  const restoredIndexes = new Set(restored.indexes);
  for (const index of source.indexes) {
    if (!restoredIndexes.has(index)) differences.push(`Index ${index} is missing from the restore.`);
  }

  return { passed: differences.length === 0, differences };
}

export function createRestoreDatabaseName(timestamp: Date, suffix: string) {
  if (Number.isNaN(timestamp.getTime())) throw new Error("A valid restore timestamp is required.");
  if (!/^[a-f0-9]{8}$/.test(suffix)) {
    throw new Error("Restore suffix must contain exactly eight lowercase hexadecimal characters.");
  }

  const compactTimestamp = timestamp.toISOString()
    .slice(0, 19)
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace("T", "t");

  return `aelora_restore_verify_${compactTimestamp}_${suffix}`;
}

export function isDisposableRestoreDatabaseName(name: string) {
  return disposableRestorePattern.test(name) && name.length <= 63;
}

export function evaluateRetentionReadiness({
  now,
  backupEvidence,
  existingTables,
}: {
  now: Date;
  backupEvidence: BackupEvidence | null;
  existingTables: string[];
}) {
  const reasons: string[] = [];

  if (!backupEvidence) {
    reasons.push("No backup restore verification evidence is available.");
  } else {
    if (!backupEvidence.passed) reasons.push("The latest backup restore verification did not pass.");
    const verifiedAt = new Date(backupEvidence.verifiedAt);
    if (Number.isNaN(verifiedAt.getTime())) {
      reasons.push("Backup restore evidence has an invalid verification time.");
    } else if (now.getTime() - verifiedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
      reasons.push("Backup restore evidence is older than seven days.");
    }
  }

  const availableTables = new Set(existingTables);
  for (const requiredTable of requiredRollupTables) {
    if (!availableTables.has(requiredTable)) {
      reasons.push(`Required roll-up table ${requiredTable} is missing.`);
    }
  }

  return { allowed: reasons.length === 0, reasons };
}
