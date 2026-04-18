#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const argv = process.argv.slice(2);
const options = parseArgs(argv);

if (options.help) {
  printHelp();
  process.exit(0);
}

if (!options.email) {
  console.error("Missing required argument: --email <email>");
  printHelp();
  process.exit(1);
}

if (options.local === options.remote) {
  console.error("Choose exactly one execution target: --local or --remote");
  printHelp();
  process.exit(1);
}

const rootDir = resolveRepoPath(import.meta.url);
const workerDir = resolve(rootDir, "workers/nextclaw-provider-gateway-api");
const workerConfigPath = resolve(workerDir, "wrangler.toml");
const wranglerBin = resolve(workerDir, "node_modules/.bin", process.platform === "win32" ? "wrangler.cmd" : "wrangler");

if (!existsSync(workerConfigPath)) {
  console.error(`Missing worker config: ${workerConfigPath}`);
  process.exit(1);
}

if (!existsSync(wranglerBin)) {
  console.error(`Missing local wrangler binary: ${wranglerBin}`);
  console.error("Run `pnpm install` at the repo root first.");
  process.exit(1);
}

const executionTarget = options.remote ? "remote" : "local";
const user = loadUserByEmail(options.email);
if (!user) {
  console.error(`No platform user found for ${options.email} on ${executionTarget}.`);
  process.exit(1);
}

if (user.role === "admin") {
  console.log(`${user.email} is already an admin on ${executionTarget}.`);
  printUser(user);
  process.exit(0);
}

const nowIso = new Date().toISOString();
runSql(`
  UPDATE users
     SET role = 'admin',
         updated_at = ${toSqlString(nowIso)}
   WHERE id = ${toSqlString(user.id)};

  SELECT id, email, username, role, created_at, updated_at
    FROM users
   WHERE id = ${toSqlString(user.id)}
   LIMIT 1;
`);

const updatedUser = loadUserByEmail(options.email);
if (!updatedUser || updatedUser.role !== "admin") {
  console.error(`Failed to promote ${options.email} to admin on ${executionTarget}.`);
  process.exit(1);
}

console.log(`Promoted ${updatedUser.email} to admin on ${executionTarget}.`);
printUser(updatedUser);
console.log("Note: this lightweight bootstrap path does not append an audit log because the current audit schema requires an authenticated actor_user_id.");

function loadUserByEmail(email) {
  const results = runSql(`
    SELECT id, email, username, role, created_at, updated_at
      FROM users
     WHERE email = ${toSqlString(email)}
     LIMIT 1;
  `);
  return results?.[0] ?? null;
}

function runSql(sql) {
  const result = runWranglerSqlCommand(sql);
  const parsed = parseWranglerJsonOutput(result.stdout?.trim() ?? "");
  return collectD1Rows(parsed);
}

function parseArgs(values) {
  const parsed = {
    email: "",
    help: false,
    local: false,
    persistTo: "",
    remote: false
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--") {
      continue;
    }
    if (value === "--help" || value === "-h") {
      parsed.help = true;
      continue;
    }
    if (value === "--remote") {
      parsed.remote = true;
      continue;
    }
    if (value === "--local") {
      parsed.local = true;
      continue;
    }
    if (value === "--email") {
      parsed.email = values[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (value === "--persist-to") {
      parsed.persistTo = values[index + 1] ?? "";
      index += 1;
      continue;
    }
    console.error(`Unknown argument: ${value}`);
    printHelp();
    process.exit(1);
  }

  return parsed;
}

function printHelp() {
  console.log(`
Usage:
  pnpm platform:admin:grant -- --email <email> --remote
  pnpm platform:admin:grant -- --email <email> --local [--persist-to <dir>]

Description:
  Promote an existing NextClaw platform account to the admin role.

Examples:
  pnpm platform:admin:grant -- --email 1535376447@qq.com --remote
  pnpm platform:admin:grant -- --email admin@example.com --local --persist-to .wrangler/state/v3
`.trim());
}

function printUser(user) {
  console.log(`- id: ${user.id}`);
  console.log(`- email: ${user.email}`);
  console.log(`- username: ${user.username ?? "(none)"}`);
  console.log(`- role: ${user.role}`);
  console.log(`- created_at: ${user.created_at}`);
  console.log(`- updated_at: ${user.updated_at}`);
}

function toSqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runWranglerSqlCommand(sql) {
  const result = spawnSync(wranglerBin, buildWranglerArgs(sql), {
    cwd: workerDir,
    encoding: "utf8",
    env: { ...process.env }
  });

  if (result.status !== 0) {
    printCommandFailure(result);
    process.exit(typeof result.status === "number" ? result.status : 1);
  }

  return result;
}

function buildWranglerArgs(sql) {
  const args = [
    "d1",
    "execute",
    "NEXTCLAW_PLATFORM_DB",
    "--json",
    "--config",
    workerConfigPath,
    "--command",
    sql
  ];

  if (options.remote) {
    args.push("--remote");
    return args;
  }

  args.push("--local");
  if (options.persistTo) {
    args.push("--persist-to", options.persistTo);
  }
  return args;
}

function printCommandFailure(result) {
  if (result.stdout?.trim()) {
    console.error(result.stdout.trim());
  }
  if (result.stderr?.trim()) {
    console.error(result.stderr.trim());
  }
}

function parseWranglerJsonOutput(stdout) {
  if (!stdout) {
    return [];
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    console.error("Failed to parse Wrangler JSON output.");
    console.error(stdout);
    throw error;
  }
}

function collectD1Rows(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const rows = [];
  for (const entry of entries) {
    if (!entry || entry.success !== true) {
      console.error("D1 command failed.");
      console.error(JSON.stringify(entry, null, 2));
      process.exit(1);
    }
    if (Array.isArray(entry.results)) {
      rows.push(...entry.results);
    }
  }
  return rows;
}
