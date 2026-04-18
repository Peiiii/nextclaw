import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const packageDirectory = process.cwd();
const exampleAppDirectory = path.resolve(packageDirectory, "../../apps/examples/hello-notes");
const appHomeDirectory = await mkdtemp(path.join(tmpdir(), "napp-home-"));
const createdAppDirectory = await mkdtemp(path.join(tmpdir(), "napp-created-app-"));
const starterDirectory = path.join(createdAppDirectory, "starter");
await runCli(["create", starterDirectory, "--json"]);
const inspectResult = await runCli(["inspect", starterDirectory, "--json"]);
if (inspectResult.summary.action !== "runStarterDemo") {
  throw new Error(`unexpected created app action: ${JSON.stringify(inspectResult)}`);
}
const packResult = await runCli(["pack", starterDirectory, "--json"]);
const installResult = await runCli(["install", packResult.bundle.bundlePath, "--json"], {
  NEXTCLAW_APP_HOME: appHomeDirectory,
});
const listResult = await runCli(["list", "--json"], {
  NEXTCLAW_APP_HOME: appHomeDirectory,
});
if (listResult.apps.length !== 1 || listResult.apps[0].appId !== installResult.installation.appId) {
  throw new Error(`unexpected app list payload: ${JSON.stringify(listResult)}`);
}
const infoResult = await runCli(["info", installResult.installation.appId, "--json"], {
  NEXTCLAW_APP_HOME: appHomeDirectory,
});
if (infoResult.app.activeVersion !== installResult.installation.version) {
  throw new Error(`unexpected app info payload: ${JSON.stringify(infoResult)}`);
}

const notesDirectory = await mkdtemp(path.join(tmpdir(), "napp-smoke-notes-"));
await writeFile(path.join(notesDirectory, "day-1.md"), "alpha");
await writeFile(path.join(notesDirectory, "day-2.md"), "beta-gamma");

const installedStarterChild = spawn(
  process.execPath,
  [
    path.join(packageDirectory, "dist/main.js"),
    "run",
    installResult.installation.appId,
    "--host",
    "127.0.0.1",
    "--port",
    "3411",
    "--json",
  ],
  {
    cwd: packageDirectory,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NEXTCLAW_APP_HOME: appHomeDirectory,
    },
  },
);
const installedStarterHostInfo = await waitForJsonProcess(installedStarterChild);
const starterRunResponse = await fetch(`${installedStarterHostInfo.host.url}/__napp/run`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    action: "runStarterDemo",
  }),
});
const starterRunPayload = await starterRunResponse.json();
if (starterRunPayload.result.output.output !== 200) {
  throw new Error(`unexpected starter output: ${JSON.stringify(starterRunPayload)}`);
}
installedStarterChild.kill("SIGTERM");
await onceExit(installedStarterChild);

const exampleRunChild = spawn(
  process.execPath,
  [
    path.join(packageDirectory, "dist/main.js"),
    "run",
    exampleAppDirectory,
    "--host",
    "127.0.0.1",
    "--port",
    "3410",
    "--json",
    "--document",
    `notes=${notesDirectory}`,
  ],
  {
    cwd: packageDirectory,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const exampleHostInfo = await waitForJsonProcess(exampleRunChild);
const exampleRunResponse = await fetch(`${exampleHostInfo.host.url}/__napp/run`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    action: "summarizeNotes",
  }),
});
const exampleRunPayload = await exampleRunResponse.json();
if (exampleRunPayload.result.output.output !== 215) {
  throw new Error(`unexpected run output: ${JSON.stringify(exampleRunPayload)}`);
}
exampleRunChild.kill("SIGTERM");
await onceExit(exampleRunChild);

const registryWorkspace = await mkdtemp(path.join(tmpdir(), "napp-registry-"));
const registryVersion2Directory = path.join(registryWorkspace, "hello-notes-v2");
await cp(exampleAppDirectory, registryVersion2Directory, { recursive: true });
const version2ManifestPath = path.join(registryVersion2Directory, "manifest.json");
const version2Manifest = JSON.parse(await readFile(version2ManifestPath, "utf-8"));
version2Manifest.version = "0.2.0";
await writeFile(version2ManifestPath, `${JSON.stringify(version2Manifest, null, 2)}\n`);
const registryBundleV1 = path.join(registryWorkspace, "hello-notes-0.1.0.napp");
const registryBundleV2 = path.join(registryWorkspace, "hello-notes-0.2.0.napp");
await runCli(["pack", exampleAppDirectory, "--out", registryBundleV1, "--json"]);
await runCli(["pack", registryVersion2Directory, "--out", registryBundleV2, "--json"]);
const registryBundleV1Bytes = await readFile(registryBundleV1);
const registryBundleV2Bytes = await readFile(registryBundleV2);
const registryBundleV1Sha256 = createHash("sha256")
  .update(registryBundleV1Bytes)
  .digest("hex");
const registryBundleV2Sha256 = createHash("sha256")
  .update(registryBundleV2Bytes)
  .digest("hex");
let latestVersion = "0.1.0";
const registryServer = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  if (requestUrl.pathname === `/${encodeURIComponent("nextclaw.hello-notes")}`) {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        name: "nextclaw.hello-notes",
        description: "Registry-hosted Hello Notes",
        "dist-tags": {
          latest: latestVersion,
        },
        versions: {
          "0.1.0": {
            name: "nextclaw.hello-notes",
            version: "0.1.0",
            description: "Registry-hosted Hello Notes",
            publisher: {
              id: "nextclaw",
              name: "NextClaw Official",
              url: "https://nextclaw.com",
            },
            dist: {
              bundle: "./-/hello-notes-0.1.0.napp",
              sha256: registryBundleV1Sha256,
            },
          },
          "0.2.0": {
            name: "nextclaw.hello-notes",
            version: "0.2.0",
            description: "Registry-hosted Hello Notes",
            publisher: {
              id: "nextclaw",
              name: "NextClaw Official",
              url: "https://nextclaw.com",
            },
            dist: {
              bundle: "./-/hello-notes-0.2.0.napp",
              sha256: registryBundleV2Sha256,
            },
          },
        },
      }),
    );
    return;
  }
  if (requestUrl.pathname === "/-/hello-notes-0.1.0.napp") {
    response.setHeader("content-type", "application/octet-stream");
    response.end(registryBundleV1Bytes);
    return;
  }
  if (requestUrl.pathname === "/-/hello-notes-0.2.0.napp") {
    response.setHeader("content-type", "application/octet-stream");
    response.end(registryBundleV2Bytes);
    return;
  }
  response.writeHead(404, {
    "content-type": "text/plain",
  });
  response.end("not found");
});
await new Promise((resolve) => {
  registryServer.listen(0, "127.0.0.1", resolve);
});
const registryAddress = registryServer.address();
if (!registryAddress || typeof registryAddress === "string") {
  throw new Error("registry smoke server address unavailable");
}
const registryUrl = `http://127.0.0.1:${registryAddress.port}/`;

try {
  const registrySetResult = await runCli(["registry", "set", registryUrl, "--json"], {
    NEXTCLAW_APP_HOME: appHomeDirectory,
  });
  if (registrySetResult.registry.currentUrl !== registryUrl) {
    throw new Error(`unexpected registry set payload: ${JSON.stringify(registrySetResult)}`);
  }
  const registryGetResult = await runCli(["registry", "get", "--json"], {
    NEXTCLAW_APP_HOME: appHomeDirectory,
  });
  if (registryGetResult.registry.currentUrl !== registryUrl) {
    throw new Error(`unexpected registry get payload: ${JSON.stringify(registryGetResult)}`);
  }

  const remoteInstallResult = await runCli(["install", "nextclaw.hello-notes", "--json"], {
    NEXTCLAW_APP_HOME: appHomeDirectory,
  });
  if (remoteInstallResult.installation.sourceKind !== "registry") {
    throw new Error(`unexpected remote install payload: ${JSON.stringify(remoteInstallResult)}`);
  }
  const remotePermissionsBeforeGrant = await runCli(
    ["permissions", "nextclaw.hello-notes", "--json"],
    {
      NEXTCLAW_APP_HOME: appHomeDirectory,
    },
  );
  if (remotePermissionsBeforeGrant.permissions.documentAccess[0]?.granted !== false) {
    throw new Error(
      `unexpected permissions before grant: ${JSON.stringify(remotePermissionsBeforeGrant)}`,
    );
  }
  await runCli(
    ["grant", "nextclaw.hello-notes", "--document", `notes=${notesDirectory}`, "--json"],
    {
      NEXTCLAW_APP_HOME: appHomeDirectory,
    },
  );
  const remotePermissionsAfterGrant = await runCli(
    ["permissions", "nextclaw.hello-notes", "--json"],
    {
      NEXTCLAW_APP_HOME: appHomeDirectory,
    },
  );
  if (remotePermissionsAfterGrant.permissions.documentAccess[0]?.granted !== true) {
    throw new Error(
      `unexpected permissions after grant: ${JSON.stringify(remotePermissionsAfterGrant)}`,
    );
  }

  const installedRegistryChild = spawn(
    process.execPath,
    [
      path.join(packageDirectory, "dist/main.js"),
      "run",
      "nextclaw.hello-notes",
      "--host",
      "127.0.0.1",
      "--port",
      "3412",
      "--json",
    ],
    {
      cwd: packageDirectory,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NEXTCLAW_APP_HOME: appHomeDirectory,
      },
    },
  );
  const installedRegistryHostInfo = await waitForJsonProcess(installedRegistryChild);
  const installedRegistryRunResponse = await fetch(
    `${installedRegistryHostInfo.host.url}/__napp/run`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "summarizeNotes",
      }),
    },
  );
  const installedRegistryRunPayload = await installedRegistryRunResponse.json();
  if (installedRegistryRunPayload.result.output.output !== 215) {
    throw new Error(
      `unexpected installed registry run payload: ${JSON.stringify(installedRegistryRunPayload)}`,
    );
  }
  installedRegistryChild.kill("SIGTERM");
  await onceExit(installedRegistryChild);

  latestVersion = "0.2.0";
  const updateResult = await runCli(["update", "nextclaw.hello-notes", "--json"], {
    NEXTCLAW_APP_HOME: appHomeDirectory,
  });
  if (updateResult.update.updated !== true || updateResult.update.version !== "0.2.0") {
    throw new Error(`unexpected update payload: ${JSON.stringify(updateResult)}`);
  }
  const updatedInfoResult = await runCli(["info", "nextclaw.hello-notes", "--json"], {
    NEXTCLAW_APP_HOME: appHomeDirectory,
  });
  if (updatedInfoResult.app.activeVersion !== "0.2.0") {
    throw new Error(`unexpected updated info payload: ${JSON.stringify(updatedInfoResult)}`);
  }
  await runCli(["revoke", "nextclaw.hello-notes", "--document", "notes", "--json"], {
    NEXTCLAW_APP_HOME: appHomeDirectory,
  });
  const remotePermissionsAfterRevoke = await runCli(
    ["permissions", "nextclaw.hello-notes", "--json"],
    {
      NEXTCLAW_APP_HOME: appHomeDirectory,
    },
  );
  if (remotePermissionsAfterRevoke.permissions.documentAccess[0]?.granted !== false) {
    throw new Error(
      `unexpected permissions after revoke: ${JSON.stringify(remotePermissionsAfterRevoke)}`,
    );
  }
  await runCli(["uninstall", "nextclaw.hello-notes", "--json"], {
    NEXTCLAW_APP_HOME: appHomeDirectory,
  });
} finally {
  await new Promise((resolve, reject) => {
    registryServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

const uninstallResult = await runCli(["uninstall", installResult.installation.appId, "--json"], {
  NEXTCLAW_APP_HOME: appHomeDirectory,
});
if (uninstallResult.uninstall.removedVersions[0] !== installResult.installation.version) {
  throw new Error(`unexpected uninstall result: ${JSON.stringify(uninstallResult)}`);
}
process.stdout.write(`[napp smoke] ok ${exampleHostInfo.host.url}\n`);

async function runCli(args, extraEnv = {}) {
  const childProcess = spawn(process.execPath, [path.join(packageDirectory, "dist/main.js"), ...args], {
    cwd: packageDirectory,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  let stdout = "";
  let stderr = "";
  childProcess.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  childProcess.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise((resolve) => {
    childProcess.once("exit", resolve);
  });
  if (exitCode !== 0) {
    throw new Error(stderr || stdout || `cli exited with code ${exitCode}`);
  }
  const text = stdout.trim();
  return text ? JSON.parse(text) : null;
}

async function waitForJsonProcess(childProcess) {
  let stdout = "";
  let stderr = "";
  childProcess.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  childProcess.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  return waitForJson(() => stdout, () => stderr);
}

async function waitForJson(readStdout, readStderr) {
  for (let index = 0; index < 100; index += 1) {
    const current = readStdout().trim();
    if (current.startsWith("{")) {
      return JSON.parse(current);
    }
    const stderrText = readStderr().trim();
    if (stderrText) {
      throw new Error(stderrText);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timeout waiting for napp output: ${readStdout() || readStderr()}`);
}

async function onceExit(childProcess) {
  await new Promise((resolve) => {
    childProcess.once("exit", resolve);
  });
}
