import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const origin = "https://app.bibo.bot";
const root = resolve(process.cwd(), "../..");
const tokenPath = join(homedir(), ".config", "bibo-hosted", "edge-admin-token");
const reportPath = join(homedir(), ".config", "bibo-hosted", "edge-migration-report.json");
type Status = { mode: string; sessionCount: number; messageCount: number; hasSnapshot: boolean; hasLegacyData: boolean;
  containerStartCount: number; edgeRunCount: number };
type Row = { userId: string; before?: Status; after?: Status; migration?: { sessions: number; messages: number; files: number; workspaceTexts: number }; error?: string };

async function userIds(): Promise<string[]> {
  const { stdout } = await exec("pnpm", ["exec", "wrangler", "d1", "execute", "nextclaw-platform", "--remote",
    "--command", "SELECT id FROM users", "--json"], {
    cwd: join(root, "workers", "nextclaw-provider-gateway-api"), maxBuffer: 10 * 1024 * 1024,
  });
  const result = JSON.parse(stdout) as Array<{ results?: Array<{ id?: unknown }>; success?: boolean }>;
  if (!result[0]?.success || !Array.isArray(result[0].results)) throw new Error("Platform user discovery failed");
  return result[0].results.map((row) => row.id).filter((id): id is string => typeof id === "string");
}

async function operatorToken(): Promise<string> {
  const info = await stat(tokenPath);
  if (info.mode & 0o077) throw new Error("Restrict the migration token file to its owner (chmod 600)");
  const token = (await readFile(tokenPath, "utf8")).trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("The migration token must be 32 random bytes in hexadecimal");
  return token;
}

async function operation(token: string, path: "status" | "migrate", userId: string): Promise<{ status: number; value: unknown }> {
  const response = await fetch(`${origin}/api/admin/edge/${path}`, {
    method: "POST", headers: { origin, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ userId }), signal: AbortSignal.timeout(path === "migrate" ? 120_000 : 20_000),
  });
  return { status: response.status, value: await response.json().catch(() => null) };
}

async function writeReport(rows: Row[]): Promise<void> {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify({ measuredAt: new Date().toISOString(), rows }, null, 2), { mode: 0o600 });
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const token = await operatorToken();
  const ids = await userIds();
  const rows: Row[] = [];
  for (const userId of ids) {
    const row: Row = { userId };
    rows.push(row);
    try {
      const before = await operation(token, "status", userId);
      if (before.status !== 200) throw new Error(`Status returned ${before.status}`);
      row.before = before.value as Status;
      if (apply && row.before.hasLegacyData && row.before.mode !== "edge") {
        const migrated = await operation(token, "migrate", userId);
        if (migrated.status !== 200) throw new Error(`Migration returned ${migrated.status}`);
        row.migration = (migrated.value as { evidence: Row["migration"] }).evidence;
        const after = await operation(token, "status", userId);
        if (after.status !== 200) throw new Error(`Readback returned ${after.status}`);
        row.after = after.value as Status;
        if (row.after.mode !== "edge") throw new Error("Migration did not publish edge mode");
      }
    } catch (error) { row.error = error instanceof Error ? error.message : "Unknown migration error"; }
    await writeReport(rows);
  }
  const candidates = rows.filter((row) => row.before?.hasLegacyData && row.before.mode !== "edge");
  const failed = rows.filter((row) => row.error);
  console.log(JSON.stringify({ usersInspected: rows.length, legacyCandidates: candidates.length,
    migrated: rows.filter((row) => row.after?.mode === "edge").length, failures: failed.length, dryRun: !apply }));
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Bibo migration operation failed");
  process.exitCode = 1;
});
