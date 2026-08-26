import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import pg from "pg";

import { evaluateRetentionDryRun } from "../lib/telemetry/rollup";

const { Client } = pg;
const outputDirectory = path.resolve("docs/evidence/step-30-telemetry-rollups");
const readinessPath = path.resolve("docs/evidence/step-29-backup-and-retention/retention-readiness.json");
const reconciliationPath = path.join(outputDirectory, "telemetry-rollup-verification.json");

function escapeHtml(value: unknown) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function html(report: { generatedAt: string; allowed: boolean; retentionDays: number; cutoff: string; wouldDeleteRows: number; rawRowsMissingRollup: number; oldestEligibleAt: string | null; newestEligibleAt: string | null; reasons: string[] }) {
  const rows = [
    ["Retention policy and fresh restore proof", report.reasons.some((reason) => reason.includes("policy")) ? "BLOCKED" : "PASS"],
    ["Raw-to-roll-up reconciliation", report.reasons.some((reason) => reason.includes("reconciliation")) ? "BLOCKED" : "PASS"],
    ["Every eligible raw row has a 15-minute summary", report.rawRowsMissingRollup ? "BLOCKED" : "PASS"],
  ].map(([label, status]) => `<tr><td><strong>${label}</strong></td><td><span class="status ${status === "PASS" ? "pass" : "blocked"}">${status}</span></td></tr>`).join("");
  const reasons = report.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("") || "<li>All preview gates passed. Deletion remains unimplemented.</li>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aelora retention dry-run</title><style>:root{color-scheme:dark;font-family:Inter,Segoe UI,sans-serif;background:#0b0d10;color:#f5f7fb}*{box-sizing:border-box}body{margin:0;padding:42px;background:radial-gradient(circle at 88% 0%,#3a2912 0,transparent 36%),#0b0d10}.wrap{max-width:1100px;margin:auto}.eyebrow{color:#fbbf24;font-weight:800;letter-spacing:.13em;text-transform:uppercase;font-size:12px}h1{font-size:38px;margin:8px 0}p{color:#aab7c8}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:25px 0}.card,section{border:1px solid #34302a;border-radius:18px;background:#11151a;padding:22px}.card span{color:#aab7c8;font-size:13px}.card strong{display:block;font-size:30px;margin-top:8px;color:#fde68a}section{margin-top:18px}table{width:100%;border-collapse:collapse}td{padding:14px 10px;border-bottom:1px solid #242a31}.status{padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800}.pass{background:#0b3b2b;color:#6ee7b7}.blocked{background:#4a2417;color:#fdba74}li{color:#aab7c8;line-height:1.8}.note{border-left:3px solid #fbbf24;padding-left:12px}</style></head><body><main class="wrap"><div class="eyebrow">Chapter 7 · Non-destructive retention evidence</div><h1>Raw telemetry retention dry-run</h1><p>${escapeHtml(report.generatedAt)} · ${report.retentionDays}-day policy · cutoff ${escapeHtml(report.cutoff)}</p><div class="grid"><div class="card"><span>Rows that would qualify</span><strong>${report.wouldDeleteRows.toLocaleString()}</strong></div><div class="card"><span>Missing summaries</span><strong>${report.rawRowsMissingRollup.toLocaleString()}</strong></div><div class="card"><span>Preview gate</span><strong>${report.allowed ? "READY" : "BLOCKED"}</strong></div></div><section><h2>Safety gates</h2><table><tbody>${rows}</tbody></table></section><section><h2>Preview range</h2><p>${escapeHtml(report.oldestEligibleAt ?? "No eligible rows")} → ${escapeHtml(report.newestEligibleAt ?? "No eligible rows")}</p><ul>${reasons}</ul><p class="note"><strong>No DELETE statement exists in this command.</strong> Raw telemetry count is not changed.</p></section></main></body></html>`;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const retentionDays = Number(process.env.TELEMETRY_RAW_RETENTION_DAYS ?? 90);
  if (!Number.isInteger(retentionDays) || retentionDays < 30 || retentionDays > 3_650) throw new Error("TELEMETRY_RAW_RETENTION_DAYS must be an integer from 30 to 3650.");
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const readiness = fs.existsSync(readinessPath) ? JSON.parse(fs.readFileSync(readinessPath, "utf8")) as { allowed: boolean } : { allowed: false };
  const reconciliation = fs.existsSync(reconciliationPath) ? JSON.parse(fs.readFileSync(reconciliationPath, "utf8")) as { passed: boolean } : { passed: false };
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const stats = (await client.query<{ eligible_count: string; oldest_at: Date | null; newest_at: Date | null }>(`
    SELECT COUNT(*)::text AS eligible_count, MIN("observedAt") AS oldest_at, MAX("observedAt") AS newest_at
    FROM "TelemetryReading" WHERE "observedAt" < $1
  `, [cutoff])).rows[0];
  const missing = (await client.query<{ missing_count: string }>(`
    SELECT COUNT(*)::text AS missing_count
    FROM "TelemetryReading" reading
    WHERE reading."observedAt" < $1
      AND NOT EXISTS (
        SELECT 1 FROM "TelemetryRollup15Minute" rollup
        WHERE rollup."siteId" = reading."siteId"
          AND rollup."bucketStart" = date_bin(INTERVAL '15 minutes', reading."observedAt", TIMESTAMP '1970-01-01 00:00:00')
      )
  `, [cutoff])).rows[0];
  await client.end();
  const eligibleRawRows = Number(stats.eligible_count);
  const rawRowsMissingRollup = Number(missing.missing_count);
  const result = evaluateRetentionDryRun({ policyReady: readiness.allowed, reconciliationPassed: reconciliation.passed, eligibleRawRows, rawRowsMissingRollup });
  const report = { generatedAt: new Date().toISOString(), retentionDays, cutoff: cutoff.toISOString(), ...result, rawRowsMissingRollup, oldestEligibleAt: stats.oldest_at?.toISOString() ?? null, newestEligibleAt: stats.newest_at?.toISOString() ?? null, deletionExecuted: false };
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, "retention-dry-run.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDirectory, "retention-dry-run.html"), html(report));
  process.stdout.write(`Retention dry-run ${report.allowed ? "passed" : "is blocked"}: ${eligibleRawRows} row(s) would qualify; ${rawRowsMissingRollup} missing roll-up(s); 0 rows deleted.\n`);
}

void main();
