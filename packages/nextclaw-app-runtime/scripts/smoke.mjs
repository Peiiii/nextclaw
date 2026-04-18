import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const packageDirectory = process.cwd();
const appDirectory = path.resolve(packageDirectory, "../../apps/examples/hello-notes");
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

const installedAppChild = spawn(
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
const installedHostInfo = await waitForJsonProcess(installedAppChild);
const starterRunResponse = await fetch(`${installedHostInfo.host.url}/__napp/run`, {
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
installedAppChild.kill("SIGTERM");
await onceExit(installedAppChild);

const child = spawn(
  process.execPath,
  [
    path.join(packageDirectory, "dist/main.js"),
    "run",
    appDirectory,
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

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

const hostInfo = await waitForJson(() => stdout, () => stderr);

const manifestResponse = await fetch(`${hostInfo.host.url}/__napp/manifest`);
if (!manifestResponse.ok) {
  throw new Error(`manifest request failed: ${manifestResponse.status}`);
}

const runResponse = await fetch(`${hostInfo.host.url}/__napp/run`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    action: "summarizeNotes",
  }),
});

if (!runResponse.ok) {
  throw new Error(`run request failed: ${runResponse.status}`);
}

const runPayload = await runResponse.json();
if (runPayload.result.output.output !== 215) {
  throw new Error(`unexpected run output: ${JSON.stringify(runPayload)}`);
}

child.kill("SIGTERM");
await onceExit(child);
const uninstallResult = await runCli(["uninstall", installResult.installation.appId, "--json"], {
  NEXTCLAW_APP_HOME: appHomeDirectory,
});
if (uninstallResult.uninstall.removedVersions[0] !== installResult.installation.version) {
  throw new Error(`unexpected uninstall result: ${JSON.stringify(uninstallResult)}`);
}
process.stdout.write(`[napp smoke] ok ${hostInfo.host.url}\n`);

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
