import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const packageDirectory = process.cwd();
const appDirectory = path.resolve(packageDirectory, "../../apps/examples/hello-notes");
const createdAppDirectory = await mkdtemp(path.join(tmpdir(), "napp-created-app-"));
await runCli(["create", path.join(createdAppDirectory, "starter"), "--json"]);
const inspectResult = await runCli(["inspect", path.join(createdAppDirectory, "starter"), "--json"]);
if (inspectResult.summary.action !== "runStarterDemo") {
  throw new Error(`unexpected created app action: ${JSON.stringify(inspectResult)}`);
}

const notesDirectory = await mkdtemp(path.join(tmpdir(), "napp-smoke-notes-"));
await writeFile(path.join(notesDirectory, "day-1.md"), "alpha");
await writeFile(path.join(notesDirectory, "day-2.md"), "beta-gamma");

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
process.stdout.write(`[napp smoke] ok ${hostInfo.host.url}\n`);

async function runCli(args) {
  const childProcess = spawn(process.execPath, [path.join(packageDirectory, "dist/main.js"), ...args], {
    cwd: packageDirectory,
    stdio: ["ignore", "pipe", "pipe"],
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
