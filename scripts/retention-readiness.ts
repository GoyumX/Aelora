import "dotenv/config";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import pg from "pg";

import { evaluateRetentionReadiness, type BackupEvidence } from "../lib/operations/backup-policy";

const { Client } = pg;
const evidenceDirectory = path.resolve("docs/evidence/step-29-backup-and-retention");
const verificationPath = path.join(evidenceDirectory, "backup-restore-verification.json");

type StoredVerification = {
  generatedAt: string;
  passed: boolean;
  backup: { relativePath: string; sha256: string } | null;
};

function hashFile(filePath: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function html(report: { generatedAt: string; allowed: boolean; reasons: string[]; existingTables: string[]; backupArchivePresent: boolean; backupChecksumMatches: boolean }) {
  const checks = [
    ["Restore verification passed within seven days", !report.reasons.some((reason) => reason.includes("backup") || reason.includes("Backup"))],
    ["Verified backup archive is still present", report.backupArchivePresent],
    ["Backup archive checksum still matches", report.backupChecksumMatches],
    ["15-minute roll-up table exists", report.existingTables.includes("TelemetryRollup15Minute")],
    ["Daily roll-up table exists", report.existingTables.includes("TelemetryRollupDaily")],
  ] as const;
  const rows = checks.map(([label, passed]) => `<tr><td><strong>${label}</strong></td><td><span class="status ${passed ? "pass" : "blocked"}">${passed ? "PASS" : "BLOCKED"}</span></td></tr>`).join("");
  const reasons = report.reasons.map((reason) => `<li>${reason}</li>`).join("") || "<li>All retention prerequisites are satisfied.</li>";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aelora retention readiness</title><style>
  :root{color-scheme:dark;font-family:Inter,Segoe UI,sans-serif;background:#0b0d10;color:#f5f7fb}*{box-sizing:border-box}body{margin:0;padding:42px;background:radial-gradient(circle at 88% 0%,#331b16 0,transparent 35%),#0b0d10}.wrap{max-width:1100px;margin:auto}.eyebrow{color:#fb923c;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:12px}h1{font-size:38px;margin:8px 0 4px}p{color:#aab7c8}.hero,section{border:1px solid #2d2a29;border-radius:18px;background:#11151a;box-shadow:0 18px 45px #0004}.hero{padding:24px;margin:25px 0}.hero strong{display:block;font-size:34px;color:${report.allowed ? "#6ee7b7" : "#fdba74"}}section{padding:22px;margin-top:18px}h2{margin:0 0 15px}table{width:100%;border-collapse:collapse}td{padding:14px 10px;border-bottom:1px solid #242a31}.status{display:inline-block;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800}.pass{background:#0b3b2b;color:#6ee7b7}.blocked{background:#4a2417;color:#fdba74}ul{color:#aab7c8;line-height:1.9}.foot{font-size:12px;color:#718096;margin-top:18px}
  </style></head><body><main class="wrap"><div class="eyebrow">Chapter 7 · Data safety evidence</div><h1>Telemetry retention readiness</h1><p>Fail-closed prerequisite audit · ${report.generatedAt}</p><div class="hero"><span>Raw telemetry deletion</span><strong>${report.allowed ? "ALLOWED" : "SAFELY BLOCKED"}</strong><p>No deletion command is implemented or executed by this audit.</p></div><section><h2>Safety gates</h2><table><tbody>${rows}</tbody></table></section><section><h2>Current blockers</h2><ul>${reasons}</ul></section><p class="foot">Retention remains blocked until roll-ups exist and a recent, checksum-valid restore proof is available.</p></main></body></html>`;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const stored = fs.existsSync(verificationPath)
    ? JSON.parse(fs.readFileSync(verificationPath, "utf8")) as StoredVerification
    : null;
  let backupArchivePresent = false;
  let backupChecksumMatches = false;
  let backupEvidence: BackupEvidence | null = stored
    ? { passed: stored.passed, verifiedAt: stored.generatedAt }
    : null;

  if (stored?.backup) {
    const backupPath = path.resolve(stored.backup.relativePath);
    const configuredBackupDirectory = path.resolve(process.env.AELORA_BACKUP_DIR ?? "backups");
    const insideBackupDirectory = backupPath.startsWith(`${configuredBackupDirectory}${path.sep}`);
    backupArchivePresent = insideBackupDirectory && fs.existsSync(backupPath);
    backupChecksumMatches = backupArchivePresent && hashFile(backupPath) === stored.backup.sha256;
    if (!backupChecksumMatches && backupEvidence) backupEvidence = { ...backupEvidence, passed: false };
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const existingTables = (await client.query<{ tablename: string }>(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `)).rows.map((row) => row.tablename);
  await client.end();

  const readiness = evaluateRetentionReadiness({ now: new Date(), backupEvidence, existingTables });
  if (!backupArchivePresent) readiness.reasons.push("The verified backup archive is not present in the configured backup directory.");
  else if (!backupChecksumMatches) readiness.reasons.push("The verified backup archive checksum no longer matches.");
  readiness.allowed = readiness.reasons.length === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    ...readiness,
    existingTables,
    backupArchivePresent,
    backupChecksumMatches,
  };
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(path.join(evidenceDirectory, "retention-readiness.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDirectory, "retention-readiness.html"), html(report));
  process.stdout.write(`Raw telemetry deletion is ${report.allowed ? "allowed by all guards" : "safely blocked"}. ${report.reasons.length} blocker(s).\n`);
}

void main();
