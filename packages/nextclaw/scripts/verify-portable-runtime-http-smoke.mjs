import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  configurePortableRuntimeHttpSmokeTools,
  fetchJson,
  verifyInstalledEntrySurfaces,
  verifyRustWasiScaffoldLoop,
} from "./portable-runtime-http-smoke.tools.mjs";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const appEntrypoint = resolve(packageRoot, "dist/cli/app/index.js");
const binaryPath = readArg("--binary");
const outputPath = readArg("--output");
const verifyRustWasiScaffold = process.argv.includes(
  "--verify-rust-wasi-scaffold",
);
const command = binaryPath ?? process.execPath;
const commandPrefix = binaryPath ? [] : [appEntrypoint];
const commandCwd = resolve(readArg("--cwd") ?? packageRoot);
const runnerExecutable =
  process.platform === "win32"
    ? "nextclaw-wasmtime-runner.exe"
    : "nextclaw-wasmtime-runner";
const runnerPath = resolve(
  packageRoot,
  "resources/native",
  `${process.platform}-${process.arch}`,
  runnerExecutable,
);

const tempRoot = await mkdtemp(join(tmpdir(), "nextclaw-portable-http-smoke-"));
const nextclawHome = resolve(readArg("--home") ?? join(tempRoot, "home"));
const port = await reservePort();
const baseUrl = `http://127.0.0.1:${port}`;
const output = [];
const runtimeEnv = {
  ...process.env,
  NEXTCLAW_HOME: nextclawHome,
  NEXTCLAW_APP_HOME: join(nextclawHome, "apps"),
  NEXTCLAW_RUN_HOME: join(tempRoot, "run"),
  ...(binaryPath ? {} : { NEXTCLAW_WASMTIME_RUNNER_PATH: runnerPath }),
};
const child = spawn(
  command,
  [...commandPrefix, "serve", "--ui-port", String(port)],
  {
    cwd: commandCwd,
    detached: process.platform !== "win32",
    env: runtimeEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
child.stdout.on("data", (chunk) => output.push(String(chunk)));
child.stderr.on("data", (chunk) => output.push(String(chunk)));
configurePortableRuntimeHttpSmokeTools({ baseUrl, tempRoot, child, command, commandPrefix, commandCwd, runtimeEnv });

try {
  const meta = await waitForJson(`${baseUrl}/api/app/meta`, {
    timeoutMs: 90_000,
  });
  assert(
    meta.response.ok,
    `app metadata returned HTTP ${meta.response.status}`,
  );
  await waitForJson(`${baseUrl}/api/app-packages`, {
    timeoutMs: 90_000,
    accept: ({ payload }) =>
      payload?.data?.entries?.some(
        (entry) => entry?.id === "nextclaw.portable-runtime-lab",
      ),
  });

  const enabled = await fetchJson(
    `${baseUrl}/api/app-packages/nextclaw.portable-runtime-lab/enable`,
    { method: "POST" },
  );
  assert(
    enabled.response.ok,
    `portable runtime enable returned HTTP ${enabled.response.status}: ${JSON.stringify(enabled.payload)}`,
  );
  assert(
    enabled.payload?.ok === true,
    `portable runtime enable did not return ok=true: ${JSON.stringify(enabled.payload)}`,
  );
  assert(
    enabled.payload?.data?.enabled === true,
    `portable runtime package was not enabled: ${JSON.stringify(enabled.payload)}`,
  );
  assert(
    child.exitCode === null,
    "NextClaw service exited while enabling the portable runtime package",
  );

  const serviceApps = await fetchJson(`${baseUrl}/api/service-apps`);
  assert(
    serviceApps.response.ok && serviceApps.payload?.ok === true,
    "service app inventory was not available after enable",
  );
  const entries =
    serviceApps.payload?.data?.entries?.filter(
      (entry) => entry?.packageId === "nextclaw.portable-runtime-lab",
    ) ?? [];
  const expectedComponentIds = [
    "nextclaw-portable-runtime-lab-state",
    "nextclaw-portable-runtime-lab-capabilities",
    "nextclaw-portable-runtime-lab-sqlite",
    "nextclaw-portable-runtime-lab-resident",
    "nextclaw-portable-runtime-lab-provider",
    "nextclaw-portable-runtime-lab-composition",
  ];
  assert(
    entries.length === expectedComponentIds.length &&
      expectedComponentIds.every((id) => entries.some((entry) => entry?.id === id)),
    `portable runtime component inventory is incomplete: ${JSON.stringify(entries.map((entry) => entry?.id))}`,
  );
  for (const mode of ["provider", "resident"]) {
    const entry = entries.find(
      (candidate) => candidate?.lifecycle?.mode === mode,
    );
    assert(
      entry?.status === "running",
      `${mode} component is not running: ${JSON.stringify(entry)}`,
    );
  }

  const stateComponent = entries.find(
    (entry) => entry?.id === "nextclaw-portable-runtime-lab-state",
  );
  assert(stateComponent?.dirPath, "portable state component was not installed");
  const entrySurfaces = await verifyInstalledEntrySurfaces();
  const residentLifecycle = await verifyInstalledResidentLifecycle();
  assert(
    child.exitCode === null,
    "NextClaw service exited while invoking the portable runtime action",
  );

  const scaffold = verifyRustWasiScaffold
    ? await verifyRustWasiScaffoldLoop()
    : undefined;

  const summary = {
    schemaVersion: 1,
    kind: "nextclaw.portable-runtime.developer-smoke",
    ok: true,
    checks: [
      "service-enable",
      "installed-cli-action",
      "panel-installed-action",
      "agent-installed-action",
      "entry-fact-equivalence",
      "acceptance-contract",
      "verification-record",
      "acceptance-export",
      "resident-disable-reenable",
      ...(scaffold ? [
        "doctor",
        "create",
        "build",
        "check",
        "test",
        "pack",
        "install-relative",
        "enable",
        "disable-reenable",
        "persistence-across-reenable",
        "update",
        "rollback",
        "uninstall-retain",
        "reinstall-retain",
        "uninstall-purge",
      ] : []),
    ],
    platform: process.platform,
    arch: process.arch,
    componentCount: entries.length,
    provider: "running",
    resident: "running",
    action: "counter_read",
    entrySurfaces,
    residentLifecycle,
    ...(scaffold ? { scaffold } : {}),
  };
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  if (outputPath) await writeFile(resolve(outputPath), serialized, "utf8");
  process.stdout.write(serialized);
} catch (error) {
  process.stderr.write(output.join("").slice(-12_000));
  throw error;
} finally {
  await stopChild(child);
  await rm(tempRoot, { recursive: true, force: true });
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolvePromise, reject) =>
    server.close((error) => (error ? reject(error) : resolvePromise())),
  );
  assert(port, "failed to reserve a local port");
  return port;
}

async function waitForJson(url, { timeoutMs, accept = () => true }) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `NextClaw service exited before becoming ready (code ${child.exitCode})`,
      );
    }
    try {
      const result = await fetchJson(url);
      if (accept(result)) return result;
      lastError = new Error(
        `JSON response from ${url} did not reach the expected state`,
      );
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(
    `NextClaw service did not become ready: ${String(lastError ?? "timeout")}`,
  );
}

/**
 * This goes through the same installed-App package lifecycle that users use.
 * It checks the package lifecycle boundary, not a test-only resident endpoint:
 * after disable the component is unavailable, and enable must restart it.
 */
async function verifyInstalledResidentLifecycle() {
  const packageId = "nextclaw.portable-runtime-lab";
  const residentId = "nextclaw-portable-runtime-lab-resident";
  const disable = await fetchJson(`${baseUrl}/api/app-packages/${encodeURIComponent(packageId)}/disable`, {
    method: "POST",
  });
  assert(
    disable.response.ok && disable.payload?.ok === true && disable.payload?.data?.enabled === false,
    `portable Resident package disable failed: ${JSON.stringify(disable.payload)}`,
  );
  const disabledInventory = await fetchJson(`${baseUrl}/api/service-apps`);
  assert(
    disabledInventory.response.ok && disabledInventory.payload?.ok === true &&
      !disabledInventory.payload?.data?.entries?.some((entry) => entry?.id === residentId),
    `Resident remained callable after package disable: ${JSON.stringify(disabledInventory.payload)}`,
  );

  const enable = await fetchJson(`${baseUrl}/api/app-packages/${encodeURIComponent(packageId)}/enable`, {
    method: "POST",
  });
  assert(
    enable.response.ok && enable.payload?.ok === true && enable.payload?.data?.enabled === true,
    `portable Resident package re-enable failed: ${JSON.stringify(enable.payload)}`,
  );
  const inventory = await fetchJson(`${baseUrl}/api/service-apps`);
  const resident = inventory.payload?.data?.entries?.find((entry) => entry?.id === residentId);
  assert(
    inventory.response.ok && inventory.payload?.ok === true && resident?.status === "running",
    `Resident did not restart after package enable: ${JSON.stringify(resident)}`,
  );
  return { disabled: true, reenabled: true, status: resident.status };
}

async function stopChild(processHandle) {
  try {
    if (processHandle.exitCode === null) {
      signalChildTree(processHandle, "SIGTERM");
      await waitForExit(processHandle, 5_000);
    }
    if (processHandle.exitCode === null) {
      signalChildTree(processHandle, "SIGKILL");
      await waitForExit(processHandle, 5_000);
    }
  } finally {
    // Resident components can inherit the service pipes. Closing our readers
    // prevents a successful smoke from waiting for the outer 300s timeout.
    processHandle.stdout?.destroy();
    processHandle.stderr?.destroy();
  }
}

function signalChildTree(processHandle, signal) {
  if (process.platform === "win32") {
    if (signal === "SIGKILL" && processHandle.pid) {
      spawnSync("taskkill", ["/pid", String(processHandle.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
      return;
    }
    processHandle.kill(signal);
    return;
  }
  try {
    process.kill(-processHandle.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function waitForExit(processHandle, timeoutMs) {
  if (processHandle.exitCode !== null) return;
  await Promise.race([
    new Promise((resolvePromise) => processHandle.once("exit", resolvePromise)),
    new Promise((resolvePromise) => setTimeout(resolvePromise, timeoutMs)),
  ]);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}
