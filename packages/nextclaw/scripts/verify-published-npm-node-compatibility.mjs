import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const expectedVersion = readArg("--expected-version");
const packageSpec = readArg("--package-spec") ?? `nextclaw@${expectedVersion}`;
const kernelPackageSpec = readArg("--kernel-package-spec");
const expectUnsupported = process.argv.includes("--expect-unsupported");
if (!expectedVersion) {
  throw new Error("--expected-version is required");
}

const startedAt = Date.now();
const installRoot = mkdtempSync(
  join(tmpdir(), "nextclaw-npm-node-compatibility-"),
);
const npmUserConfig = join(installRoot, "empty-npmrc");
writeFileSync(npmUserConfig, "");

try {
  installPublishedPackage(
    [
      "install",
      "--prefix",
      installRoot,
      packageSpec,
      "--registry",
      "https://registry.npmjs.org",
      "--no-audit",
      "--no-fund",
      "--loglevel=warn",
    ],
  );

  if (kernelPackageSpec) {
    installPublishedPackage(
      [
        "install",
        "--prefix",
        installRoot,
        kernelPackageSpec,
        "--no-audit",
        "--no-fund",
        "--loglevel=warn",
      ],
    );
  }

  const installedPackage = JSON.parse(
    readFileSync(
      join(installRoot, "node_modules", "nextclaw", "package.json"),
      "utf8",
    ),
  );
  if (installedPackage.version !== expectedVersion) {
    throw new Error(
      `Expected nextclaw ${expectedVersion}, installed ${installedPackage.version ?? "unknown"}.`,
    );
  }

  const installedRequire = createRequire(join(installRoot, "package.json"));
  const launcherPath = join(
    installRoot,
    "node_modules",
    "nextclaw",
    "dist",
    "cli",
    "launcher",
    "index.js",
  );
  if (expectUnsupported) {
    const result = spawnSync(process.execPath, [launcherPath, "--version"], {
      encoding: "utf8",
    });
    if (
      result.status === 0 ||
      !result.stderr.includes("requires Node.js 20.19+")
    ) {
      throw new Error(
        `Unsupported Node guard did not fail clearly: ${result.stderr || result.stdout}`,
      );
    }
    process.stdout.write(
      `${JSON.stringify({
        schema: "nextclaw.npm-node-compatibility/v1",
        ok: true,
        expectedUnsupported: true,
        nextclawVersion: installedPackage.version,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        durationMs: Date.now() - startedAt,
      })}\n`,
    );
  } else {
    const kernelEntrypoint = installedRequire.resolve("@nextclaw/kernel");
    const { NcpAgentSessionJournalStore } = await import(
      pathToFileURL(kernelEntrypoint).href
    );
    const journalRoot = join(installRoot, "journal");
    const store = new NcpAgentSessionJournalStore(journalRoot);
    const timestamp = "2026-08-30T00:00:00.000Z";
    await store.importSessionSnapshot({
      sessionId: "npm-node-compatibility",
      messages: [
        {
          id: "compatibility-message",
          sessionId: "npm-node-compatibility",
          role: "user",
          status: "final",
          parts: [{ type: "text", text: "node:sqlite compatibility" }],
          timestamp,
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {},
    });
    const summaries = await store.listSessionSummaries();
    if (
      summaries[0]?.sessionId !== "npm-node-compatibility" ||
      summaries[0]?.messageCount !== 1
    ) {
      throw new Error(
        `Published kernel SQLite CRUD failed: ${JSON.stringify(summaries)}`,
      );
    }
    let sqliteDriver = "sql.js-wasm";
    let sqliteVersion = null;
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const database = new DatabaseSync(":memory:");
      sqliteVersion = database
        .prepare("select sqlite_version() as version")
        .get().version;
      database.close();
      sqliteDriver = "node:sqlite";
    } catch (error) {
      if (!isMissingNodeSqlite(error)) throw error;
    }

    process.stdout.write(
      `${JSON.stringify({
        schema: "nextclaw.npm-node-compatibility/v1",
        ok: true,
        nextclawVersion: installedPackage.version,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        sqliteDriver,
        sqliteVersion,
        sessionCatalog: "write-and-read",
        durationMs: Date.now() - startedAt,
      })}\n`,
    );
  }
} finally {
  // node:sqlite can release a Windows file handle just after the CRUD contract
  // completes. The temporary fixture is not part of that contract, so retry the
  // bounded cleanup instead of turning a successful published-package check
  // into a platform-specific false failure.
  rmSync(installRoot, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 500,
  });
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}

function installPublishedPackage(args) {
  execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    stdio: "inherit",
    timeout: 5 * 60_000,
    shell: process.platform === "win32",
    env: {
      ...process.env,
      npm_config_userconfig: npmUserConfig,
    },
  });
}

function isMissingNodeSqlite(error) {
  return (
    error?.code === "ERR_UNKNOWN_BUILTIN_MODULE" ||
    error?.code === "ERR_MODULE_NOT_FOUND"
  );
}
