import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { db } from "../lib/db";
import { compareRollupTotals, finalizedRollupCutoff, type RollupTotals } from "../lib/telemetry/rollup";
import { reconcileSiteRollups } from "../lib/telemetry/rollup-service";

const outputDirectory = path.resolve("docs/evidence/step-30-telemetry-rollups");

function sum(rows: RollupTotals[]) {
  return rows.reduce<RollupTotals>((total, row) => ({
    generationWh: total.generationWh + row.generationWh,
    consumptionWh: total.consumptionWh + row.consumptionWh,
    importWh: total.importWh + row.importWh,
    exportWh: total.exportWh + row.exportWh,
    batteryChargeWh: total.batteryChargeWh + row.batteryChargeWh,
    batteryDischargeWh: total.batteryDischargeWh + row.batteryDischargeWh,
    coveredDurationSec: total.coveredDurationSec + row.coveredDurationSec,
  }), { generationWh: 0, consumptionWh: 0, importWh: 0, exportWh: 0, batteryChargeWh: 0, batteryDischargeWh: 0, coveredDurationSec: 0 });
}

function escapeHtml(value: unknown) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function html(report: { generatedAt: string; passed: boolean; sites: Array<{ siteName: string; rawReadings: number; intervalRows: number; dailyRows: number; rawToIntervalPassed: boolean; intervalToDailyPassed: boolean; differences: string[] }> }) {
  const rows = report.sites.map((site) => `<tr><td><strong>${escapeHtml(site.siteName)}</strong></td><td>${site.rawReadings.toLocaleString()}</td><td>${site.intervalRows.toLocaleString()}</td><td>${site.dailyRows.toLocaleString()}</td><td><span class="status ${site.rawToIntervalPassed ? "pass" : "fail"}">${site.rawToIntervalPassed ? "PASS" : "FAIL"}</span></td><td><span class="status ${site.intervalToDailyPassed ? "pass" : "fail"}">${site.intervalToDailyPassed ? "PASS" : "FAIL"}</span></td></tr>`).join("");
  const differences = report.sites.flatMap((site) => site.differences.map((difference) => `<li><strong>${escapeHtml(site.siteName)}:</strong> ${escapeHtml(difference)}</li>`)).join("") || "<li>No reconciliation differences were found.</li>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aelora telemetry roll-up verification</title><style>:root{color-scheme:dark;font-family:Inter,Segoe UI,sans-serif;background:#0b0d10;color:#f5f7fb}*{box-sizing:border-box}body{margin:0;padding:42px;background:radial-gradient(circle at 85% 0%,#152c42 0,transparent 36%),#0b0d10}.wrap{max-width:1180px;margin:auto}.eyebrow{color:#60a5fa;font-weight:800;letter-spacing:.13em;text-transform:uppercase;font-size:12px}h1{font-size:38px;margin:8px 0}p{color:#aab7c8}.hero,section{border:1px solid #28313b;border-radius:18px;background:#11151a;box-shadow:0 18px 45px #0004}.hero{padding:24px;margin:25px 0}.hero strong{display:block;font-size:34px;color:${report.passed ? "#6ee7b7" : "#fca5a5"}}section{padding:22px;margin-top:18px;overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:14px 10px;border-bottom:1px solid #242a31;text-align:left}.status{padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800}.pass{background:#0b3b2b;color:#6ee7b7}.fail{background:#491d22;color:#fca5a5}li{color:#aab7c8;line-height:1.8}</style></head><body><main class="wrap"><div class="eyebrow">Chapter 7 · Database reconciliation evidence</div><h1>Telemetry roll-up verification</h1><p>Raw → 15-minute → site-local daily · ${escapeHtml(report.generatedAt)}</p><div class="hero"><span>Reconciliation gate</span><strong>${report.passed ? "PASS" : "REVIEW REQUIRED"}</strong><p>No raw telemetry was modified or deleted.</p></div><section><h2>Stored evidence</h2><table><thead><tr><th>Site</th><th>Raw readings</th><th>15-minute rows</th><th>Daily rows</th><th>Raw → 15m</th><th>15m → daily</th></tr></thead><tbody>${rows}</tbody></table></section><section><h2>Differences</h2><ul>${differences}</ul></section></main></body></html>`;
}

async function main() {
  const generatedAt = new Date();
  const finalizedThrough = finalizedRollupCutoff(generatedAt);
  const sites = await db.solarSite.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  const siteReports = [];
  for (const site of sites) {
    const bounds = await db.telemetryReading.aggregate({ where: { siteId: site.id }, _min: { observedAt: true }, _max: { observedAt: true }, _count: { _all: true } });
    if (!bounds._min.observedAt || !bounds._max.observedAt) {
      siteReports.push({ siteId: site.id, siteName: site.name, rawReadings: 0, intervalRows: 0, dailyRows: 0, rawToIntervalPassed: true, intervalToDailyPassed: true, differences: [] as string[] });
      continue;
    }
    const from = new Date(Math.floor(bounds._min.observedAt.getTime() / (15 * 60_000)) * 15 * 60_000);
    const to = new Date(Math.min(bounds._max.observedAt.getTime() + 15 * 60_000, finalizedThrough.getTime()));
    const rawReconciliation = await reconcileSiteRollups(site.id, from, to);
    const [intervals, days] = await Promise.all([
      db.telemetryRollup15Minute.findMany({ where: { siteId: site.id, bucketStart: { gte: from, lt: to } }, select: { generationWh: true, consumptionWh: true, importWh: true, exportWh: true, batteryChargeWh: true, batteryDischargeWh: true, coveredDurationSec: true } }),
      db.telemetryRollupDaily.findMany({ where: { siteId: site.id }, select: { generationWh: true, consumptionWh: true, importWh: true, exportWh: true, batteryChargeWh: true, batteryDischargeWh: true, coveredDurationSec: true } }),
    ]);
    const dailyReconciliation = compareRollupTotals(sum(intervals), sum(days));
    siteReports.push({ siteId: site.id, siteName: site.name, rawReadings: bounds._count._all, intervalRows: intervals.length, dailyRows: days.length, rawToIntervalPassed: rawReconciliation.passed, intervalToDailyPassed: dailyReconciliation.passed, differences: [...rawReconciliation.differences, ...dailyReconciliation.differences] });
  }
  const report = { generatedAt: generatedAt.toISOString(), finalizedThrough: finalizedThrough.toISOString(), passed: siteReports.every((site) => site.rawToIntervalPassed && site.intervalToDailyPassed), sites: siteReports };
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, "telemetry-rollup-verification.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDirectory, "telemetry-rollup-verification.html"), html(report));
  process.stdout.write(`Telemetry roll-up reconciliation ${report.passed ? "passed" : "requires review"} for ${siteReports.length} site(s).\n`);
  if (!report.passed) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
