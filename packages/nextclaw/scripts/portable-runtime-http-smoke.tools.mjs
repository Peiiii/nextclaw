import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { join } from "node:path";

let baseUrl;
let tempRoot;
let child;
let command;
let commandPrefix;
let commandCwd;
let runtimeEnv;

export function configurePortableRuntimeHttpSmokeTools(context) {
  ({ baseUrl, tempRoot, child, command, commandPrefix, commandCwd, runtimeEnv } = context);
}

export async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  assert(
    contentType.includes("application/json"),
    `expected JSON from ${url}, got ${response.status} ${contentType}: ${body.slice(0, 500)}`,
  );
  return { response, payload: JSON.parse(body) };
}

async function postJson(pathname, body, headers = {}) {
  const result = await fetchJson(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  assert(
    result.response.ok && result.payload?.ok === true,
    `POST ${pathname} failed with HTTP ${result.response.status}: ${JSON.stringify(result.payload)}`,
  );
  return result.payload.data;
}

/**
 * Exercise the three actual public entry owners.  Panel uses a real bridge
 * session and declared-action grant, Agent uses a real configured agent and
 * grant, and CLI goes through the installed-App endpoint.  Each writes the
 * same host-KV counter; matching dataVersion plus a final total proves they
 * observed one package instance rather than three lookalike test paths.
 */
export async function verifyInstalledEntrySurfaces() {
  const packageId = "nextclaw.portable-runtime-lab";
  const panelId = "nextclaw-portable-runtime-lab-panel";
  const actionId = "nextclaw-portable-runtime-lab-state.counter_increment";
  const agentId = "portable-acceptance-agent";
  const bridge = await postJson("/api/panel-app-bridge-sessions", { appId: panelId });
  assert(typeof bridge?.token === "string" && bridge.token.length > 0, "panel bridge did not issue a session token");
  const bridgeHeaders = { "x-nextclaw-panel-bridge-session": bridge.token };
  await postJson(`/api/service-actions/${encodeURIComponent(actionId)}/grant`, {}, bridgeHeaders);
  const panel = await postJson(
    `/api/service-actions/${encodeURIComponent(actionId)}/invoke`,
    { input: { step: 1 } },
    bridgeHeaders,
  );
  assert(panel?.result?.counter === 1, `Panel action did not write the shared counter: ${JSON.stringify(panel)}`);

  await postJson("/api/agents", { id: agentId, displayName: "Portable acceptance agent" });
  await postJson(`/api/agents/${encodeURIComponent(agentId)}/service-action-grants`, { actionIds: [actionId] });
  const agent = await postJson(
    `/api/agents/${encodeURIComponent(agentId)}/service-actions/${encodeURIComponent(actionId)}/invoke`,
    { input: { step: 2 } },
  );
  assert(agent?.result?.counter === 3, `Agent action did not observe Panel state: ${JSON.stringify(agent)}`);

  const cli = parseJsonCommand(
    runCli([
      "app", "invoke", packageId, "counter_increment",
      "--input", JSON.stringify({ step: 3 }), "--json",
    ]),
    "installed App CLI action",
  );
  assert(cli?.result?.counter === 6, `Installed App CLI action did not observe shared state: ${JSON.stringify(cli)}`);
  const read = parseJsonCommand(
    runCli(["app", "invoke", packageId, "counter_read", "--json"]),
    "installed App CLI read",
  );
  assert(read?.result?.counter === 6, `Installed App CLI read did not return shared counter: ${JSON.stringify(read)}`);
  const invocations = [panel?.invocation, agent?.invocation, cli?.invocation];
  assert(invocations.every((invocation) => typeof invocation?.dataVersion === "string" && invocation.dataVersion.length > 0), "entry actions are missing invocation dataVersion facts");
  assert(new Set(invocations.map((invocation) => invocation.dataVersion)).size === 1, `entry actions did not share one dataVersion: ${JSON.stringify(invocations)}`);

  await verifyEntryEvidence({ packageId, agentId, bridgeToken: bridge.token });
  return {
    counter: read.result.counter,
    dataVersion: invocations[0].dataVersion,
    surfaces: ["panel", "agent", "installed-app-cli"],
  };
}

async function verifyEntryEvidence({ packageId, agentId, bridgeToken }) {
  const contract = await fetchJson(`${baseUrl}/api/portable-runtime/acceptance/contract`);
  assert(contract.response.ok && contract.payload?.ok === true && contract.payload?.data?.definitions?.length === 22, "acceptance contract does not expose all 22 fixed IDs");
  const records = await fetchJson(`${baseUrl}/api/runtime-verification-records?appId=${encodeURIComponent(packageId)}&limit=100`);
  const entryRecords = records.payload?.data?.entries ?? [];
  for (const surface of ["panel", "agent", "installed-app-cli"]) {
    assert(entryRecords.some((record) => record?.entrySurface === surface), `verification records lack ${surface} proof`);
  }
  const acceptance = await fetchJson(`${baseUrl}/api/portable-runtime/acceptance/export?appId=${encodeURIComponent(packageId)}`);
  assert(acceptance.response.ok && acceptance.payload?.ok === true && acceptance.payload?.data?.contract?.definitions?.length === 22, "acceptance export did not return the fixed contract");
  const deleted = await fetchJson(`${baseUrl}/api/agents/${encodeURIComponent(agentId)}`, { method: "DELETE" });
  assert(deleted.response.ok && deleted.payload?.ok === true, `acceptance test agent cleanup failed: ${JSON.stringify(deleted.payload)}`);
  const sessionDeleted = await fetchJson(`${baseUrl}/api/panel-app-bridge-sessions/${encodeURIComponent(bridgeToken)}`, { method: "DELETE" });
  assert(sessionDeleted.response.ok && sessionDeleted.payload?.ok === true, `panel bridge cleanup failed: ${JSON.stringify(sessionDeleted.payload)}`);
}

export async function verifyRustWasiScaffoldLoop() {
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
    increment.observation?.operation === "start-job" &&
      Number.isInteger(increment.observation?.runnerPid),
    `generated app source call did not expose the real runner Job observation: ${JSON.stringify(increment)}`,
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
  await waitForInstalledPackage("nextclaw.generated-counter", install.id);
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
  const installedIncrement = parseJsonCommand(
    runCli(
      [
        "app",
        "invoke",
        "nextclaw.generated-counter",
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
      ["app", "invoke", "nextclaw.generated-counter", "counter_read", "--json"],
      { cwd: tempRoot },
    ),
    "installed generated app read",
  );
  assert(
    installedRead.result?.counter === 4,
    `installed generated app persistence failed: ${JSON.stringify(installedRead)}`,
  );
  const disable = parseJsonCommand(
    runCli(["app", "disable", "nextclaw.generated-counter", "--json"], {
      cwd: tempRoot,
    }),
    "installed generated app disable",
  );
  assert(
    disable.enabled === false,
    `generated app disable failed: ${JSON.stringify(disable)}`,
  );
  const reenable = parseJsonCommand(
    runCli(["app", "enable", "nextclaw.generated-counter", "--json"], {
      cwd: tempRoot,
    }),
    "installed generated app re-enable",
  );
  assert(
    reenable.enabled === true,
    `generated app re-enable failed: ${JSON.stringify(reenable)}`,
  );
  const retainedRead = parseJsonCommand(
    runCli(
      ["app", "invoke", "nextclaw.generated-counter", "counter_read", "--json"],
      { cwd: tempRoot },
    ),
    "re-enabled generated app read",
  );
  assert(
    retainedRead.result?.counter === 4,
    `generated app did not retain data across disable/re-enable: ${JSON.stringify(retainedRead)}`,
  );
  assert(
    child.exitCode === null,
    "NextClaw service exited while enabling the generated app",
  );
  const lifecycle = await verifyInstalledLifecycle(appRoot, artifactPath, retainedRead);
  return { ...retainedRead, lifecycle };
}

async function verifyInstalledLifecycle(appRoot, firstArtifactPath, retainedRead) {
  const appId = "nextclaw.generated-counter";
  const firstVersion = "0.1.0";
  const secondVersion = "0.1.1";
  const secondArtifactPath = join(tempRoot, "generated-counter-0.1.1.napp");
  const manifestPath = join(appRoot, "manifest.json");
  const firstManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert(firstManifest.version === firstVersion, `generated template version changed unexpectedly: ${firstManifest.version}`);
  await writeFile(manifestPath, `${JSON.stringify({ ...firstManifest, version: secondVersion }, null, 2)}\n`, "utf8");
  runCli(["app", "pack", appRoot, "--out", secondArtifactPath, "--json"]);
  const registry = await startLocalRegistry({
    appId,
    firstVersion,
    secondVersion,
    firstArtifactPath,
    secondArtifactPath,
  });
  try {
    return await exerciseInstalledLifecycle({ appId, firstVersion, secondVersion, retainedRead, registryUrl: registry.url });
  } finally {
    await registry.close();
  }
}

async function exerciseInstalledLifecycle({ appId, firstVersion, secondVersion, retainedRead, registryUrl }) {
  const update = parseJsonCommand(
      // `--version <value>` is also the root CLI version flag.  Keep this
      // child-command option in its equals form so Commander cannot consume it
      // before dispatching `app update`.
      runCli(["app", "update", appId, `--version=${secondVersion}`, "--registry", registryUrl, "--json"]),
      "generated app update",
    );
    await waitForPackageVersion(appId, secondVersion, update.id);
    const afterUpdate = parseJsonCommand(runCli(["app", "invoke", appId, "counter_read", "--json"]), "updated generated app read");
    assert(afterUpdate.result?.counter === retainedRead.result?.counter, `generated app update lost durable data: ${JSON.stringify(afterUpdate)}`);

    const rollback = parseJsonCommand(
      runCli(["app", "rollback", appId, `--version=${firstVersion}`, "--json"]),
      "generated app rollback",
    );
    await waitForPackageVersion(appId, firstVersion, rollback.id);
    const afterRollback = parseJsonCommand(runCli(["app", "invoke", appId, "counter_read", "--json"]), "rolled back generated app read");
    assert(afterRollback.result?.counter === retainedRead.result?.counter, `generated app rollback lost durable data: ${JSON.stringify(afterRollback)}`);

    const uninstallRetain = parseJsonCommand(runCli(["app", "uninstall", appId, "--json"]), "generated app retain uninstall");
    await waitForPackageAbsent(appId, uninstallRetain.id);
    const reinstallRetain = parseJsonCommand(runCli(["app", "install", "./generated-counter.napp", "--json"], { cwd: tempRoot }), "generated app retained reinstall");
    await waitForInstalledPackage(appId, reinstallRetain.id);
    parseJsonCommand(runCli(["app", "enable", appId, "--json"]), "generated app retained re-enable");
    const retained = parseJsonCommand(runCli(["app", "invoke", appId, "counter_read", "--json"]), "retained reinstall read");
    assert(retained.result?.counter === retainedRead.result?.counter, `generated app retain uninstall did not preserve data: ${JSON.stringify(retained)}`);

    const uninstallPurge = parseJsonCommand(
      runCli(["app", "uninstall", appId, "--purge-data", "--confirm", appId, "--json"]),
      "generated app purge uninstall",
    );
    await waitForPackageAbsent(appId, uninstallPurge.id);
    const reinstallPurge = parseJsonCommand(runCli(["app", "install", "./generated-counter.napp", "--json"], { cwd: tempRoot }), "generated app purge reinstall");
    await waitForInstalledPackage(appId, reinstallPurge.id);
    parseJsonCommand(runCli(["app", "enable", appId, "--json"]), "generated app purge re-enable");
    const purged = parseJsonCommand(runCli(["app", "invoke", appId, "counter_read", "--json"]), "purged reinstall read");
    assert(purged.result?.counter === 0, `generated app purge uninstall retained data: ${JSON.stringify(purged)}`);
  return { update: secondVersion, rollback: firstVersion, retainedCounter: retained.result.counter, purgedCounter: purged.result.counter };
}

async function startLocalRegistry(params) {
  const { firstVersion, secondVersion, firstArtifactPath, secondArtifactPath, appId } = params;
  const artifacts = new Map([
    [firstVersion, await readFile(firstArtifactPath)],
    [secondVersion, await readFile(secondArtifactPath)],
  ]);
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const registry = createHttpServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === `/${encodeURIComponent(appId)}`) {
      const versions = Object.fromEntries([...artifacts.entries()].map(([version, bytes]) => [version, {
        name: appId,
        version,
        dist: { kind: "bundle", bundle: `./bundles/${version}.napp`, sha256: digest(bytes) },
      }]));
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ name: appId, "dist-tags": { latest: secondVersion }, versions }));
      return;
    }
    const match = /^\/bundles\/(\d+\.\d+\.\d+)\.napp$/.exec(url.pathname);
    const bytes = match ? artifacts.get(match[1]) : undefined;
    if (request.method === "GET" && bytes) {
      response.writeHead(200, { "content-type": "application/octet-stream", "content-length": bytes.byteLength });
      response.end(bytes);
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolvePromise, reject) => {
    registry.once("error", reject);
    registry.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = registry.address();
  assert(typeof address === "object" && address !== null, "local registry did not receive a port");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: async () => await new Promise((resolvePromise, reject) => registry.close((error) => error ? reject(error) : resolvePromise())),
  };
}

async function waitForInstalledPackage(appId, operationId) {
  const deadline = Date.now() + 90_000;
  let lastOperation;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `NextClaw service exited while installing ${appId} (code ${child.exitCode})`,
      );
    }
    const packages = await fetchJson(`${baseUrl}/api/app-packages`);
    if (packages.payload?.data?.entries?.some((entry) => entry?.id === appId)) return;
    const operations = await fetchJson(`${baseUrl}/api/app-package-operations`);
    lastOperation = operations.payload?.data?.entries?.find(
      (entry) => entry?.id === operationId,
    );
    if (lastOperation?.status === "failed" || lastOperation?.status === "interrupted") {
      throw new Error(
        `App install ${operationId} ${lastOperation.status}: ${lastOperation.error ?? "unknown error"}`,
      );
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(
    `App ${appId} was not installed before timeout; operation=${JSON.stringify(lastOperation)}`,
  );
}

async function waitForPackageVersion(appId, version, operationId) {
  const deadline = Date.now() + 90_000;
  let lastOperation;
  while (Date.now() < deadline) {
    const packages = await fetchJson(`${baseUrl}/api/app-packages`);
    const entry = packages.payload?.data?.entries?.find((candidate) => candidate?.id === appId);
    if (entry?.activeVersion === version) return entry;
    lastOperation = await readOperation(operationId);
    if (lastOperation?.status === "failed" || lastOperation?.status === "interrupted") {
      throw new Error(`App operation ${operationId} ${lastOperation.status}: ${lastOperation.error ?? "unknown error"}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`App ${appId} did not activate ${version}; operation=${JSON.stringify(lastOperation)}`);
}

async function waitForPackageAbsent(appId, operationId) {
  const deadline = Date.now() + 90_000;
  let lastOperation;
  while (Date.now() < deadline) {
    const packages = await fetchJson(`${baseUrl}/api/app-packages`);
    if (!packages.payload?.data?.entries?.some((candidate) => candidate?.id === appId)) return;
    lastOperation = await readOperation(operationId);
    if (lastOperation?.status === "failed" || lastOperation?.status === "interrupted") {
      throw new Error(`App operation ${operationId} ${lastOperation.status}: ${lastOperation.error ?? "unknown error"}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`App ${appId} was not removed; operation=${JSON.stringify(lastOperation)}`);
}

async function readOperation(operationId) {
  const operations = await fetchJson(`${baseUrl}/api/app-package-operations`);
  return operations.payload?.data?.entries?.find((entry) => entry?.id === operationId);
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
