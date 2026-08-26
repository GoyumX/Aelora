import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import pg from "pg";

const { Client } = pg;
const outputDirectory = path.resolve("docs/evidence/step-28-performance-and-database");

type ExplainDocument = {
  Plan: PlanNode;
  "Planning Time": number;
  "Execution Time": number;
};

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  "Actual Rows"?: number;
  "Actual Total Time"?: number;
  Plans?: PlanNode[];
};

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function flattenPlan(node: PlanNode): Array<{ nodeType: string; relation?: string; index?: string; rows?: number }> {
  return [
    { nodeType: node["Node Type"], relation: node["Relation Name"], index: node["Index Name"], rows: node["Actual Rows"] },
    ...(node.Plans ?? []).flatMap(flattenPlan),
  ];
}

function html(report: {
  generatedAt: string;
  tables: Array<{ table_name: string; estimated_rows: string; dead_rows: string; total_size: string }>;
  coreIndexes: Array<{ table_name: string; index_name: string; index_definition: string }>;
  unindexedForeignKeys: Array<{ table_name: string; constraint_name: string; definition: string }>;
  queries: Array<{ name: string; executionTimeMs: number; planningTimeMs: number; nodes: ReturnType<typeof flattenPlan>; passed: boolean }>;
  passed: boolean;
}) {
  const queryRows = report.queries.map((query) => `<tr><td><strong>${escapeHtml(query.name)}</strong></td><td>${query.executionTimeMs.toFixed(3)}</td><td>${query.planningTimeMs.toFixed(3)}</td><td>${escapeHtml(query.nodes.map((node) => node.index ?? node.nodeType).join(" → "))}</td><td><span class="status ${query.passed ? "pass" : "warn"}">${query.passed ? "Within budget" : "Review"}</span></td></tr>`).join("");
  const tableRows = report.tables.map((table) => `<tr><td><strong>${escapeHtml(table.table_name)}</strong></td><td>${escapeHtml(table.estimated_rows)}</td><td>${escapeHtml(table.dead_rows)}</td><td>${escapeHtml(table.total_size)}</td></tr>`).join("");
  const indexRows = report.coreIndexes.map((index) => `<tr><td>${escapeHtml(index.table_name)}</td><td><strong>${escapeHtml(index.index_name)}</strong><small>${escapeHtml(index.index_definition)}</small></td></tr>`).join("");
  const missingRows = report.unindexedForeignKeys.length === 0
    ? `<tr><td colspan="2"><span class="status pass">No uncovered foreign keys detected</span></td></tr>`
    : report.unindexedForeignKeys.map((item) => `<tr><td>${escapeHtml(item.table_name)}</td><td>${escapeHtml(item.constraint_name)}<small>${escapeHtml(item.definition)}</small></td></tr>`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aelora database audit</title><style>
  :root{color-scheme:dark;font-family:Inter,Segoe UI,sans-serif;background:#0b0d10;color:#f5f7fb}*{box-sizing:border-box}body{margin:0;padding:38px;background:radial-gradient(circle at 90% 0%,#2c210a 0,transparent 32%),#0b0d10}.wrap{max-width:1400px;margin:auto}.eyebrow{color:#fbbf24;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:12px}h1{font-size:38px;margin:8px 0 4px}p{color:#aab7c8;margin:0 0 22px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:24px 0}.card,section{border:1px solid #2a2d33;border-radius:18px;background:#11151a;box-shadow:0 18px 45px #0004}.card{padding:18px}.card strong{display:block;font-size:25px;margin-top:7px}.card span{color:#8f9cac;font-size:13px}section{padding:22px;margin-top:18px}h2{margin:0 0 15px;font-size:20px}table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;color:#8f9cac;font-weight:600;padding:10px;border-bottom:1px solid #2a313b}td{padding:13px 10px;border-bottom:1px solid #1e242c;vertical-align:top}small{display:block;color:#718096;margin-top:4px;max-width:900px;overflow-wrap:anywhere}.status{display:inline-block;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:700}.pass{background:#0b3b2b;color:#6ee7b7}.warn{background:#493115;color:#fbbf24}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.foot{margin-top:18px;font-size:12px;color:#718096}
  </style></head><body><main class="wrap"><div class="eyebrow">Chapter 7 · Database integration evidence</div><h1>PostgreSQL performance audit</h1><p>Read-only index and query-plan inspection · ${escapeHtml(report.generatedAt)}</p><div class="summary"><div class="card"><span>Overall query gate</span><strong>${report.passed ? "PASS" : "REVIEW"}</strong></div><div class="card"><span>Core indexes</span><strong>${report.coreIndexes.length}</strong></div><div class="card"><span>Uncovered foreign keys</span><strong>${report.unindexedForeignKeys.length}</strong></div></div><section><h2>Representative query plans</h2><table><thead><tr><th>Read path</th><th>Execution (ms)</th><th>Planning (ms)</th><th>Plan / index</th><th>Result</th></tr></thead><tbody>${queryRows}</tbody></table></section><div class="grid"><section><h2>Core table health</h2><table><thead><tr><th>Table</th><th>Estimated rows</th><th>Dead rows</th><th>Total size</th></tr></thead><tbody>${tableRows}</tbody></table></section><section><h2>Foreign-key coverage</h2><table><thead><tr><th>Table</th><th>Constraint</th></tr></thead><tbody>${missingRows}</tbody></table></section></div><section><h2>Telemetry and forecast indexes</h2><table><thead><tr><th>Table</th><th>Index</th></tr></thead><tbody>${indexRows}</tbody></table></section><p class="foot">The audit uses EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) and does not mutate application data. A sequential scan can be valid for a tiny table; the gate is based on measured execution time (≤ 100 ms), while indexes remain available for production growth.</p></main></body></html>`;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const siteResult = await client.query<{ id: string; latest_observation: Date | null }>(`
      SELECT site.id, MAX(reading."observedAt") AS latest_observation
      FROM "SolarSite" site
      LEFT JOIN "TelemetryReading" reading ON reading."siteId" = site.id
      WHERE site.status = 'ACTIVE'
      GROUP BY site.id
      ORDER BY site."createdAt" ASC
      LIMIT 1
    `);
    const site = siteResult.rows[0];
    if (!site) throw new Error("No active solar site is available for query-plan inspection.");
    const end = site.latest_observation ?? new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const tableResult = await client.query<{ table_name: string; estimated_rows: string; dead_rows: string; total_size: string }>(`
      SELECT relname AS table_name,
             n_live_tup::text AS estimated_rows,
             n_dead_tup::text AS dead_rows,
             pg_size_pretty(pg_total_relation_size(relid)) AS total_size
      FROM pg_stat_user_tables
      WHERE relname IN ('TelemetryReading', 'DeviceObservation', 'WeatherObservation', 'WeatherForecastPoint', 'SolarForecastPoint', 'SolarForecastVerification')
      ORDER BY pg_total_relation_size(relid) DESC
    `);
    const indexResult = await client.query<{ table_name: string; index_name: string; index_definition: string }>(`
      SELECT tablename AS table_name, indexname AS index_name, indexdef AS index_definition
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('TelemetryReading', 'DeviceObservation', 'WeatherObservation', 'WeatherForecastRun', 'SolarForecastRun', 'SolarForecastPoint')
      ORDER BY tablename, indexname
    `);
    const foreignKeyResult = await client.query<{ table_name: string; constraint_name: string; definition: string }>(`
      SELECT c.conrelid::regclass::text AS table_name,
             c.conname AS constraint_name,
             pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND NOT EXISTS (
          SELECT 1
          FROM pg_index i
          WHERE i.indrelid = c.conrelid
            AND i.indisvalid
            AND i.indisready
            AND (i.indkey::smallint[])[0:cardinality(c.conkey)-1] = c.conkey
        )
      ORDER BY c.conrelid::regclass::text, c.conname
    `);

    const queryDefinitions = [
      {
        name: "Latest telemetry by site",
        sql: `SELECT "observedAt", "pvPowerW", "loadPowerW", "batterySocPct" FROM "TelemetryReading" WHERE "siteId" = $1 ORDER BY "observedAt" DESC LIMIT 1`,
        values: [site.id],
      },
      {
        name: "Thirty-day telemetry range",
        sql: `SELECT "observedAt", "pvPowerW", "loadPowerW", "gridPowerW" FROM "TelemetryReading" WHERE "siteId" = $1 AND "observedAt" >= $2 AND "observedAt" <= $3 ORDER BY "observedAt" ASC`,
        values: [site.id, start, end],
      },
      {
        name: "Latest forecast by site",
        sql: `SELECT id, "createdAt", "estimatedEnergyKwh" FROM "SolarForecastRun" WHERE "siteId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
        values: [site.id],
      },
      {
        name: "Latest stored weather",
        sql: `SELECT "observedAt", condition, "temperatureAirC" FROM "WeatherObservation" WHERE "siteId" = $1 ORDER BY "observedAt" DESC LIMIT 1`,
        values: [site.id],
      },
    ];

    const queries = [];
    for (const definition of queryDefinitions) {
      const explained = await client.query<{ "QUERY PLAN": ExplainDocument[] }>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${definition.sql}`, definition.values);
      const document = explained.rows[0]["QUERY PLAN"][0];
      queries.push({
        name: definition.name,
        executionTimeMs: document["Execution Time"],
        planningTimeMs: document["Planning Time"],
        nodes: flattenPlan(document.Plan),
        passed: document["Execution Time"] <= 100,
      });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      tables: tableResult.rows,
      coreIndexes: indexResult.rows,
      unindexedForeignKeys: foreignKeyResult.rows,
      queries,
      passed: queries.every((query) => query.passed),
    };

    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, "database-performance-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(outputDirectory, "database-performance-audit.html"), html(report));
    process.stdout.write(`Database performance audit ${report.passed ? "passed" : "requires review"}. Report: ${path.join(outputDirectory, "database-performance-audit.json")}\n`);
    if (!report.passed) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
