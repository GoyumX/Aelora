import { describe, expect, it } from "vitest";

import {
  compareBackupManifests,
  createRestoreDatabaseName,
  evaluateRetentionReadiness,
  isDisposableRestoreDatabaseName,
  type BackupManifest,
} from "@/lib/operations/backup-policy";

const manifest: BackupManifest = {
  migrations: ["20260818193000_add_weather_forecasts", "20260826093000_index_report_generator"],
  tables: {
    SolarSite: 1,
    TelemetryReading: 15_900,
  },
  indexes: ["TelemetryReading_siteId_observedAt_idx"],
};

describe("backup manifest comparison", () => {
  it("passes only when migrations, table counts, and indexes match", () => {
    expect(compareBackupManifests(manifest, structuredClone(manifest))).toEqual({
      passed: true,
      differences: [],
    });
  });

  it("reports exact restore differences without hiding missing objects", () => {
    const restored: BackupManifest = {
      migrations: ["20260818193000_add_weather_forecasts"],
      tables: { SolarSite: 1, TelemetryReading: 15_899 },
      indexes: [],
    };

    expect(compareBackupManifests(manifest, restored)).toEqual({
      passed: false,
      differences: [
        "Migration history differs.",
        "Table TelemetryReading expected 15900 rows but restored 15899.",
        "Index TelemetryReading_siteId_observedAt_idx is missing from the restore.",
      ],
    });
  });
});

describe("disposable restore database naming", () => {
  it("creates a PostgreSQL-safe, recognizable, bounded name", () => {
    const name = createRestoreDatabaseName(new Date("2026-08-26T04:05:06.000Z"), "a1b2c3d4");

    expect(name).toBe("aelora_restore_verify_20260826t040506_a1b2c3d4");
    expect(name.length).toBeLessThanOrEqual(63);
    expect(isDisposableRestoreDatabaseName(name)).toBe(true);
  });

  it("rejects names and suffixes that could target a real database", () => {
    expect(() => createRestoreDatabaseName(new Date(), "../unsafe")).toThrow("eight lowercase hexadecimal");
    expect(isDisposableRestoreDatabaseName("aelora")).toBe(false);
    expect(isDisposableRestoreDatabaseName("aelora_restore_verify_manual")).toBe(false);
  });
});

describe("retention readiness", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");

  it("blocks deletion until a recent restore proof and both roll-up tables exist", () => {
    expect(evaluateRetentionReadiness({
      now,
      backupEvidence: { passed: true, verifiedAt: "2026-08-25T12:00:00.000Z" },
      rollupEvidence: { passed: true, verifiedAt: "2026-08-26T11:00:00.000Z" },
      existingTables: ["TelemetryRollup15Minute"],
    })).toEqual({
      allowed: false,
      reasons: ["Required roll-up table TelemetryRollupDaily is missing."],
    });
  });

  it("blocks failed, missing, or stale restore evidence", () => {
    expect(evaluateRetentionReadiness({ now, backupEvidence: null, rollupEvidence: null, existingTables: [] }).allowed).toBe(false);
    expect(evaluateRetentionReadiness({
      now,
      backupEvidence: { passed: false, verifiedAt: "2026-08-26T11:00:00.000Z" },
      rollupEvidence: { passed: true, verifiedAt: "2026-08-26T11:00:00.000Z" },
      existingTables: ["TelemetryRollup15Minute", "TelemetryRollupDaily"],
    }).reasons).toContain("The latest backup restore verification did not pass.");
    expect(evaluateRetentionReadiness({
      now,
      backupEvidence: { passed: true, verifiedAt: "2026-08-10T12:00:00.000Z" },
      rollupEvidence: { passed: true, verifiedAt: "2026-08-26T11:00:00.000Z" },
      existingTables: ["TelemetryRollup15Minute", "TelemetryRollupDaily"],
    }).reasons).toContain("Backup restore evidence is older than seven days.");
  });

  it("allows a future retention job only when every guard passes", () => {
    expect(evaluateRetentionReadiness({
      now,
      backupEvidence: { passed: true, verifiedAt: "2026-08-26T11:00:00.000Z" },
      rollupEvidence: { passed: true, verifiedAt: "2026-08-26T11:00:00.000Z" },
      existingTables: ["TelemetryRollup15Minute", "TelemetryRollupDaily"],
    })).toEqual({ allowed: true, reasons: [] });
  });

  it("blocks retention when roll-up reconciliation evidence is missing even if both tables exist", () => {
    const input = {
      now,
      backupEvidence: { passed: true, verifiedAt: "2026-08-26T11:00:00.000Z" },
      rollupEvidence: null,
      existingTables: ["TelemetryRollup15Minute", "TelemetryRollupDaily"],
    } as Parameters<typeof evaluateRetentionReadiness>[0] & { rollupEvidence: null };

    expect(evaluateRetentionReadiness(input)).toEqual({
      allowed: false,
      reasons: ["No telemetry roll-up reconciliation evidence is available."],
    });
  });
});
