import "dotenv/config";

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

import pg from "pg";

import {
  compareBackupManifests,
  createRestoreDatabaseName,
  isDisposableRestoreDatabaseName,
  type BackupManifest,
} from "../lib/operations/backup-policy";

const { Client } = pg;
const evidenceDirectory = path.resolve("docs/evidence/step-29-backup-and-retention");
const backupDirectory = path.resolve(process.env.AELORA_BACKUP_DIR ?? "backups");

type CommandResult = { stdout: string; stderr: string };

type VerificationReport = {
  generatedAt: string;
  passed: boolean;
  elapsedMs: number;
  database: { serverVersion: string; pgDumpVersion: string; pgRestoreVersion: string };
  backup: {
    fileName: string;
    relativePath: string;
    format: "PostgreSQL custom archive";
    sizeBytes: number;
    sha256: string;
  } | null;
  sourceManifest: BackupManifest | null;
  restoredManifest: BackupManifest | null;
  comparison: { passed: boolean; differences: string[] };
  temporaryDatabaseRemoved: boolean;
  error: string | null;
};

function databaseParts(connectionString: string, databaseName?: string) {
  const url = new URL(connectionString);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
  }

  const sourceDatabase = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!sourceDatabase) throw new Error("DATABASE_URL must include a database name.");

  return {
    host: url.hostname,
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: databaseName ?? sourceDatabase,
    sslMode: url.searchParams.get("sslmode") ?? undefined,
  };
}

function postgresEnvironment(connectionString: string, databaseName?: string) {
  const parts = databaseParts(connectionString, databaseName);
  return {
    ...process.env,
    PGHOST: parts.host,
    PGPORT: parts.port,
    PGUSER: parts.user,
    PGPASSWORD: parts.password,
    PGDATABASE: parts.database,
    ...(parts.sslMode ? { PGSSLMODE: parts.sslMode } : {}),
  };
}

function isolatedPostgresEnvironment(port: number, database: string) {
  return {
    ...process.env,
    PGHOST: "127.0.0.1",
    PGPORT: String(port),
    PGUSER: "aelora_restore_admin",
    PGDATABASE: database,
  };
}

function findPostgresBinary(binaryName: "pg_dump" | "pg_restore" | "initdb" | "pg_ctl") {
  const executable = process.platform === "win32" ? `${binaryName}.exe` : binaryName;
  const candidates: string[] = [];

  if (process.env.POSTGRES_BIN_DIR) candidates.push(path.join(process.env.POSTGRES_BIN_DIR, executable));
  if (process.platform === "win32") {
    const root = path.join(process.env.ProgramFiles ?? "C:/Program Files", "PostgreSQL");
    if (fs.existsSync(root)) {
      const versions = fs.readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d+(?:\.\d+)?$/.test(entry.name))
        .sort((left, right) => Number(right.name) - Number(left.name));
      for (const version of versions) candidates.push(path.join(root, version.name, "bin", executable));
    }
  } else {
    candidates.push(executable);
  }

  const resolved = candidates.find((candidate) => candidate === executable || fs.existsSync(candidate));
  if (!resolved) {
    throw new Error(`${binaryName} was not found. Set POSTGRES_BIN_DIR to the PostgreSQL bin directory.`);
  }
  return resolved;
}

function runCommand(command: string, args: string[], environment = process.env): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      else reject(new Error(`${path.basename(command)} exited with code ${code}: ${stderr.trim().slice(0, 1_000)}`));
    });
  });
}

function runQuietCommand(command: string, args: string[], environment = process.env) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env: environment,
      windowsHide: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} exited with code ${code}.`));
    });
  });
}

function findFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a local restore verification port."));
        return;
      }
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

function removeIsolatedCluster(clusterDirectory: string) {
  const resolvedCluster = path.resolve(clusterDirectory);
  const safePrefix = `${path.resolve(backupDirectory)}${path.sep}.restore-verify-`;
  if (!resolvedCluster.startsWith(safePrefix)) {
    throw new Error("Refusing to remove a restore cluster outside the configured backup directory.");
  }
  fs.rmSync(resolvedCluster, { recursive: true, force: true });
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function readManifest(client: InstanceType<typeof Client>): Promise<BackupManifest> {
  const tableResult = await client.query<{ tablename: string }>(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  const tables: Record<string, number> = {};
  for (const { tablename } of tableResult.rows) {
    const countResult = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(tablename)}`);
    tables[tablename] = Number(countResult.rows[0].count);
  }

  const migrationTable = await client.query<{ relation: string | null }>(`SELECT to_regclass('public."_prisma_migrations"')::text AS relation`);
  const migrations = migrationTable.rows[0]?.relation
    ? (await client.query<{ migration_name: string }>(`
        SELECT migration_name
        FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        ORDER BY started_at, migration_name
      `)).rows.map((row) => row.migration_name)
    : [];
  const indexes = (await client.query<{ indexname: string }>(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY indexname
  `)).rows.map((row) => row.indexname);

  return { migrations, tables, indexes };
}

function sha256(filePath: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message : "An unknown backup verification error occurred.";
}

function reportHtml(report: VerificationReport) {
  const tableRows = Object.entries(report.sourceManifest?.tables ?? {}).map(([table, count]) => {
    const restored = report.restoredManifest?.tables[table];
    const matches = restored === count;
    return `<tr><td><strong>${table}</strong></td><td>${count.toLocaleString()}</td><td>${restored?.toLocaleString() ?? "Missing"}</td><td><span class="status ${matches ? "pass" : "warn"}">${matches ? "Match" : "Review"}</span></td></tr>`;
  }).join("");
  const differenceItems = report.comparison.differences.length
    ? report.comparison.differences.map((difference) => `<li>${difference}</li>`).join("")
    : "<li>No schema or row-count differences detected.</li>";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aelora backup verification</title><style>
  :root{color-scheme:dark;font-family:Inter,Segoe UI,sans-serif;background:#0b0d10;color:#f5f7fb}*{box-sizing:border-box}body{margin:0;padding:38px;background:radial-gradient(circle at 12% 0%,#12304a 0,transparent 34%),#0b0d10}.wrap{max-width:1400px;margin:auto}.eyebrow{color:#64b5f6;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:12px}h1{font-size:38px;margin:8px 0 4px}p{color:#aab7c8;margin:0 0 22px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:24px 0}.card,section{border:1px solid #242b35;border-radius:18px;background:#11151a;box-shadow:0 18px 45px #0004}.card{padding:18px}.card strong{display:block;font-size:23px;margin-top:7px;overflow-wrap:anywhere}.card span{color:#8f9cac;font-size:13px}section{padding:22px;margin-top:18px}h2{margin:0 0 15px;font-size:20px}table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:left;color:#8f9cac;font-weight:600;padding:10px;border-bottom:1px solid #2a313b}td{padding:12px 10px;border-bottom:1px solid #1e242c}.status{display:inline-block;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:700}.pass{background:#0b3b2b;color:#6ee7b7}.warn{background:#493115;color:#fbbf24}ul{color:#aab7c8;line-height:1.8}.foot{margin-top:18px;font-size:12px;color:#718096}
  </style></head><body><main class="wrap"><div class="eyebrow">Chapter 7 · Recovery testing evidence</div><h1>PostgreSQL backup & restore proof</h1><p>Custom-format archive restored into an isolated disposable database · ${report.generatedAt}</p><div class="summary"><div class="card"><span>Recovery gate</span><strong>${report.passed ? "PASS" : "REVIEW"}</strong></div><div class="card"><span>Backup archive</span><strong>${report.backup ? `${(report.backup.sizeBytes / 1024 / 1024).toFixed(2)} MB` : "Unavailable"}</strong></div><div class="card"><span>Tables verified</span><strong>${Object.keys(report.sourceManifest?.tables ?? {}).length}</strong></div><div class="card"><span>Temporary database</span><strong>${report.temporaryDatabaseRemoved ? "Removed" : "Review"}</strong></div></div><section><h2>Restore parity</h2><table><thead><tr><th>Table</th><th>Source rows</th><th>Restored rows</th><th>Result</th></tr></thead><tbody>${tableRows}</tbody></table></section><section><h2>Integrity findings</h2><ul>${differenceItems}</ul><p>Migration records: ${report.sourceManifest?.migrations.length ?? 0} source / ${report.restoredManifest?.migrations.length ?? 0} restored · Indexes: ${report.sourceManifest?.indexes.length ?? 0} source / ${report.restoredManifest?.indexes.length ?? 0} restored</p></section><p class="foot">PostgreSQL server ${report.database.serverVersion} · ${report.database.pgDumpVersion} · SHA-256 ${report.backup?.sha256 ?? "Unavailable"}. Credentials and connection URLs are excluded from this report.</p></main></body></html>`;
}

async function main() {
  const startedAt = performance.now();
  const generatedAt = new Date();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");

  const pgDump = findPostgresBinary("pg_dump");
  const pgRestore = findPostgresBinary("pg_restore");
  const initdb = findPostgresBinary("initdb");
  const pgCtl = findPostgresBinary("pg_ctl");
  const temporaryDatabase = createRestoreDatabaseName(generatedAt, crypto.randomBytes(4).toString("hex"));
  if (!isDisposableRestoreDatabaseName(temporaryDatabase)) throw new Error("Refusing to use an unsafe restore database name.");
  const isolatedClusterDirectory = path.join(backupDirectory, `.restore-verify-${temporaryDatabase}`);

  const timestamp = generatedAt.toISOString().replaceAll(/[-:.]/g, "").replace("Z", "z").toLowerCase();
  const backupFileName = `aelora_${timestamp}.dump`;
  const backupPath = path.join(backupDirectory, backupFileName);
  const report: VerificationReport = {
    generatedAt: generatedAt.toISOString(),
    passed: false,
    elapsedMs: 0,
    database: { serverVersion: "Unknown", pgDumpVersion: "Unknown", pgRestoreVersion: "Unknown" },
    backup: null,
    sourceManifest: null,
    restoredManifest: null,
    comparison: { passed: false, differences: [] },
    temporaryDatabaseRemoved: false,
    error: null,
  };

  fs.mkdirSync(backupDirectory, { recursive: true });
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  const sourceClient = new Client({ connectionString });
  let maintenanceClient: InstanceType<typeof Client> | null = null;
  let isolatedClusterStarted = false;
  let temporaryDatabaseCreated = false;
  let isolatedPort = 0;

  try {
    await sourceClient.connect();
    report.database.serverVersion = (await sourceClient.query<{ server_version: string }>("SHOW server_version")).rows[0].server_version;
    report.sourceManifest = await readManifest(sourceClient);
    report.database.pgDumpVersion = (await runCommand(pgDump, ["--version"])).stdout;
    report.database.pgRestoreVersion = (await runCommand(pgRestore, ["--version"])).stdout;

    await runCommand(pgDump, [
      "--format=custom",
      "--compress=6",
      "--no-owner",
      "--no-privileges",
      "--file",
      backupPath,
    ], postgresEnvironment(connectionString));
    report.backup = {
      fileName: backupFileName,
      relativePath: path.relative(process.cwd(), backupPath).replaceAll("\\", "/"),
      format: "PostgreSQL custom archive",
      sizeBytes: fs.statSync(backupPath).size,
      sha256: sha256(backupPath),
    };

    isolatedPort = await findFreePort();
    await runCommand(initdb, [
      "--pgdata",
      isolatedClusterDirectory,
      "--username",
      "aelora_restore_admin",
      "--auth=trust",
      "--encoding=UTF8",
      "--no-locale",
    ]);
    await runQuietCommand(pgCtl, [
      "--pgdata",
      isolatedClusterDirectory,
      "--log",
      path.join(isolatedClusterDirectory, "server.log"),
      "--options",
      `-p ${isolatedPort} -h 127.0.0.1`,
      "--wait",
      "start",
    ]);
    isolatedClusterStarted = true;

    maintenanceClient = new Client({
      connectionString: `postgresql://aelora_restore_admin@127.0.0.1:${isolatedPort}/postgres`,
    });
    await maintenanceClient.connect();
    const collision = await maintenanceClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [temporaryDatabase]);
    if (collision.rowCount) throw new Error("The disposable restore database name unexpectedly already exists.");
    await maintenanceClient.query(`CREATE DATABASE ${quoteIdentifier(temporaryDatabase)} TEMPLATE template0`);
    temporaryDatabaseCreated = true;

    await runCommand(pgRestore, [
      "--dbname",
      temporaryDatabase,
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      backupPath,
    ], isolatedPostgresEnvironment(isolatedPort, temporaryDatabase));

    const restoredClient = new Client({
      connectionString: `postgresql://aelora_restore_admin@127.0.0.1:${isolatedPort}/${temporaryDatabase}`,
    });
    try {
      await restoredClient.connect();
      report.restoredManifest = await readManifest(restoredClient);
    } finally {
      await restoredClient.end();
    }
    report.comparison = compareBackupManifests(report.sourceManifest, report.restoredManifest);
  } catch (error) {
    report.error = safeError(error);
    if (report.comparison.differences.length === 0) report.comparison.differences.push(report.error);
  } finally {
    await sourceClient.end().catch(() => undefined);
    if (temporaryDatabaseCreated && maintenanceClient) {
      if (!isDisposableRestoreDatabaseName(temporaryDatabase)) throw new Error("Refusing to drop a database without the disposable verification prefix.");
      await maintenanceClient.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [temporaryDatabase]);
      await maintenanceClient.query(`DROP DATABASE ${quoteIdentifier(temporaryDatabase)}`);
    }
    await maintenanceClient?.end().catch(() => undefined);
    if (isolatedClusterStarted) {
      await runCommand(pgCtl, ["--pgdata", isolatedClusterDirectory, "--mode=fast", "--wait", "stop"]);
    }
    if (fs.existsSync(isolatedClusterDirectory)) removeIsolatedCluster(isolatedClusterDirectory);
    report.temporaryDatabaseRemoved = temporaryDatabaseCreated && !fs.existsSync(isolatedClusterDirectory);
  }

  report.elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
  report.passed = report.comparison.passed && report.temporaryDatabaseRemoved && report.error === null;
  fs.writeFileSync(path.join(evidenceDirectory, "backup-restore-verification.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDirectory, "backup-restore-verification.html"), reportHtml(report));
  process.stdout.write(`Backup restore verification ${report.passed ? "passed" : "requires review"}. Archive: ${report.backup?.relativePath ?? "not created"}.\n`);
  if (!report.passed) process.exitCode = 1;
}

void main();
