import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const appEntrypoint = resolve(packageRoot, "dist/cli/app/index.js");
const binaryPath = readArg("--binary");
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
    env: runtimeEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
child.stdout.on("data", (chunk) => output.push(String(chunk)));
child.stderr.on("data", (chunk) => output.push(String(chunk)));

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
  assert(
    entries.length === 5,
    `expected five portable runtime components, got ${entries.length}`,
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
  const call = spawnSync(
    command,
    [
      ...commandPrefix,
      "app",
      "call",
      stateComponent.dirPath,
      "counter_read",
      "--json",
    ],
    {
      cwd: commandCwd,
      env: runtimeEnv,
      encoding: "utf8",
      timeout: 90_000,
      windowsHide: true,
    },
  );
  assert(
    call.status === 0,
    `counter_read failed: ${call.stderr || call.stdout}`,
  );
  const callPayload = JSON.parse(call.stdout.trim());
  assert(
    callPayload.ok === true,
    `counter_read did not return ok=true: ${call.stdout}`,
  );
  assert(
    child.exitCode === null,
    "NextClaw service exited while invoking the portable runtime action",
  );

  const scaffold = verifyRustWasiScaffold
    ? await verifyRustWasiScaffoldLoop()
    : undefined;

  console.log(
    JSON.stringify({
      ok: true,
      platform: process.platform,
      arch: process.arch,
      componentCount: entries.length,
      provider: "running",
      resident: "running",
      action: "counter_read",
      ...(scaffold ? { scaffold } : {}),
    }),
  );
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
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    }
  }
  throw new Error(
    `NextClaw service did not become ready: ${String(lastError ?? "timeout")}`,
  );
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  assert(
    contentType.includes("application/json"),
    `expected JSON from ${url}, got ${response.status} ${contentType}: ${body.slice(0, 500)}`,
  );
  return { response, payload: JSON.parse(body) };
}

async function stopChild(processHandle) {
  if (processHandle.exitCode !== null) return;
  processHandle.kill("SIGTERM");
  await Promise.race([
    new Promise((resolvePromise) => processHandle.once("exit", resolvePromise)),
    new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
  ]);
  if (processHandle.exitCode === null) processHandle.kill("SIGKILL");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() || null : null;
}

async function verifyRustWasiScaffoldLoop() {
  const appRoot = join(tempRoot, "generated-counter");
  const artifactPath = join(tempRoot, "generated-counter.napp");
  const { dev } = await createAndValidateGeneratedApp(appRoot);
  const sourceRead = verifyGeneratedSourceCalls(appRoot);
  const installedRead = await installAndVerifyGeneratedApp(
    appRoot,
    artifactPath,
  );

  return {
    template: "rust-wasi",
    actions: dev.actions.length,
    doctor: "ready",
    build: "locked-rust-wasip2",
    test: "fixture-passed",
    sourceCounter: sourceRead.result.counter,
    installedCounter: installedRead.result.counter,
    relativeInstall: "normalized-and-installed",
    enabled: true,
  };
}

async function createAndValidateGeneratedApp(appRoot) {
  const doctor = parseJsonCommand(
    runCli(["app", "doctor", "--profile", "wasi", "--json"]),
    "WASI toolchain doctor",
  );
  assert(
    doctor.ok === true,
    `WASI toolchain is not ready: ${JSON.stringify(doctor)}`,
  );
  runCli(["app", "create", appRoot, "--template", "rust-wasi", "--json"]);
  const build = parseJsonCommand(
    runCli(["app", "build", appRoot, "--json"]),
    "generated app build",
  );
  assert(
    build.ok === true && build.build?.built === true,
    `generated app build failed: ${JSON.stringify(build)}`,
  );

  const check = parseJsonCommand(
    runCli(["app", "check", appRoot, "--json"]),
    "generated app check",
  );
  assert(
    check.ok === true,
    `generated app check failed: ${JSON.stringify(check)}`,
  );
  assert(
    check.issues?.length === 0,
    `generated app check returned issues: ${JSON.stringify(check.issues)}`,
  );

  const test = parseJsonCommand(
    runCli(["app", "test", appRoot, "--json"]),
    "generated app test",
  );
  assert(
    test.ok === true && test.steps?.length === 2,
    `generated app test failed: ${JSON.stringify(test)}`,
  );

  const dev = parseJsonCommand(
    runCli([
      "app",
      "dev",
      appRoot,
      "--reset-data",
      "--confirm",
      "nextclaw-generated-counter-service",
      "--json",
    ]),
    "generated app dev",
  );
  assert(
    dev.ok === true && dev.actions?.length === 2,
    `generated app dev failed: ${JSON.stringify(dev)}`,
  );
  return { dev };
}

function verifyGeneratedSourceCalls(appRoot) {
  const increment = parseJsonCommand(
    runCli([
      "app",
      "call",
      appRoot,
      "counter_increment",
      "--input",
      JSON.stringify({ step: 3 }),
      "--json",
    ]),
    "generated app increment",
  );
  assert(
    increment.result?.counter === 3,
    `generated app increment failed: ${JSON.stringify(increment)}`,
  );
  assert(
    increment.observation?.operation === "invoke",
    `generated app observation is missing: ${JSON.stringify(increment)}`,
  );
  const read = parseJsonCommand(
    runCli(["app", "call", appRoot, "counter_read", "--json"]),
    "generated app read",
  );
  assert(
    read.result?.counter === 3,
    `generated app persistence failed: ${JSON.stringify(read)}`,
  );
  return read;
}

async function installAndVerifyGeneratedApp(appRoot, artifactPath) {
  runCli(["app", "pack", appRoot, "--out", artifactPath, "--json"]);
  const install = parseJsonCommand(
    runCli(["app", "install", "./generated-counter.napp", "--json"], {
      cwd: tempRoot,
    }),
    "generated app relative install",
  );
  assert(
    install.status === "queued" ||
      install.status === "running" ||
      install.status === "completed",
    `generated app install was not accepted: ${JSON.stringify(install)}`,
  );
  assert(
    (await realpath(install.source)) === (await realpath(artifactPath)),
    `generated app relative source was not normalized: ${JSON.stringify(install)}`,
  );
  await waitForJson(`${baseUrl}/api/app-packages`, {
    timeoutMs: 90_000,
    accept: ({ payload }) =>
      payload?.data?.entries?.some(
        (entry) => entry?.id === "nextclaw.generated-counter",
      ),
  });
  const enable = parseJsonCommand(
    runCli(["app", "enable", "nextclaw.generated-counter", "--json"], {
      cwd: tempRoot,
    }),
    "generated app enable",
  );
  assert(
    enable.enabled === true,
    `generated app enable failed: ${JSON.stringify(enable)}`,
  );
  const installedServices = await fetchJson(`${baseUrl}/api/service-apps`);
  const installedService = installedServices.payload?.data?.entries?.find(
    (entry) =>
      entry?.packageId === "nextclaw.generated-counter" &&
      entry?.id === "nextclaw-generated-counter-service",
  );
  assert(installedService?.dirPath, "generated app service was not installed");
  const installedIncrement = parseJsonCommand(
    runCli(
      [
        "app",
        "call",
        installedService.dirPath,
        "counter_increment",
        "--input",
        JSON.stringify({ step: 4 }),
        "--json",
      ],
      { cwd: tempRoot },
    ),
    "installed generated app increment",
  );
  assert(
    installedIncrement.result?.counter === 4,
    `installed generated app increment failed: ${JSON.stringify(installedIncrement)}`,
  );
  const installedRead = parseJsonCommand(
    runCli(
      ["app", "call", installedService.dirPath, "counter_read", "--json"],
      { cwd: tempRoot },
    ),
    "installed generated app read",
  );
  assert(
    installedRead.result?.counter === 4,
    `installed generated app persistence failed: ${JSON.stringify(installedRead)}`,
  );
  assert(
    child.exitCode === null,
    "NextClaw service exited while enabling the generated app",
  );
  return installedRead;
}

function runCli(args, options = {}) {
  return runChecked(command, [...commandPrefix, ...args], options);
}

function runChecked(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: options.cwd ?? commandCwd,
    env: runtimeEnv,
    encoding: "utf8",
    timeout: 180_000,
    windowsHide: true,
  });
  assert(
    result.status === 0,
    `${commandName} ${args.join(" ")} failed: ${result.stderr || result.stdout || String(result.error)}`,
  );
  return result;
}

function parseJsonCommand(result, description) {
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    throw new Error(
      `${description} did not return JSON: ${result.stdout}\n${result.stderr}`,
    );
  }
}
