import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const runnerPath =
  args.get("--runner") ?? process.env.NEXTCLAW_WASMTIME_RUNNER_PATH;
const outputPath = args.get("--output");
if (!runnerPath) {
  throw new Error("Pass --runner <path> or set NEXTCLAW_WASMTIME_RUNNER_PATH.");
}

const repository = args.get("--repository") ?? "Peiiii/nextclaw";
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error("--repository must be owner/repository.");
}

const appDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const componentPath = path.join(
  appDirectory,
  "service-components",
  "nextclaw-github-issue-watcher-service",
  "service.wasm",
);
const dataDirectory = await mkdtemp(
  path.join(tmpdir(), "nextclaw-github-issue-watcher-"),
);
const runner = spawn(runnerPath, [], { stdio: ["pipe", "pipe", "pipe"] });
const pendingResponses = new Map();
const pendingJobs = new Map();
let outputBuffer = "";
let stderr = "";

runner.stderr.on("data", (chunk) => {
  stderr += chunk;
});
runner.stdout.on("data", (chunk) => {
  outputBuffer += chunk;
  while (true) {
    const newline = outputBuffer.indexOf("\n");
    if (newline < 0) break;
    const line = outputBuffer.slice(0, newline);
    outputBuffer = outputBuffer.slice(newline + 1);
    const message = JSON.parse(line);
    if (message.kind === "response") {
      pendingResponses.get(message.requestId)?.(message);
    } else if (message.kind === "job-terminal") {
      pendingJobs.get(message.jobId)?.(message);
    }
  }
});

function runAction(actionName, input) {
  return new Promise((resolve, reject) => {
    const requestId = randomUUID();
    const jobId = randomUUID();
    const timeout = setTimeout(() => {
      pendingResponses.delete(requestId);
      pendingJobs.delete(jobId);
      reject(new Error(`Timed out waiting for ${actionName}. ${stderr}`));
    }, 30_000);
    pendingResponses.set(requestId, (response) => {
      pendingResponses.delete(requestId);
      if (!response.ok) {
        clearTimeout(timeout);
        reject(new Error(JSON.stringify(response.error)));
        return;
      }
      pendingJobs.set(jobId, (terminal) => {
        pendingJobs.delete(jobId);
        clearTimeout(timeout);
        if (terminal.status === "succeeded") resolve(terminal.result);
        else reject(new Error(`${JSON.stringify(terminal.error)}${stderr ? `\nrunner stderr:\n${stderr}` : ""}`));
      });
    });
    runner.stdin.write(
      `${JSON.stringify({
        requestId,
        jobId,
        operation: "start-job",
        actionName,
        input,
        timeoutMs: 20_000,
        app: {
          id: "nextclaw.github-issue-watcher.public-smoke",
          componentPath,
          dataDirectory,
          storageEnabled: true,
          allowedDomains: ["api.github.com"],
        },
      })}\n`,
    );
  });
}

try {
  const before = await runAction("issues_list", { state: "all" });
  const sync = await runAction("issues_sync", { repository });
  const after = await runAction("issues_list", { state: "all" });
  const firstIssue = after.issues?.[0];
  const validIssue =
    Number.isInteger(firstIssue?.number) &&
    typeof firstIssue.title === "string" &&
    firstIssue.title.length > 0 &&
    typeof firstIssue.url === "string" &&
    firstIssue.url.startsWith("https://github.com/");
  if (
    before.persistedBy !== "wasi:keyvalue/store" ||
    sync.persistedBy !== "wasi:keyvalue/store" ||
    sync.requestedVia !== "wasi:http/outgoing-handler" ||
    after.persistedBy !== "wasi:keyvalue/store" ||
    after.repository !== repository ||
    !Array.isArray(after.issues) ||
    after.issues.length === 0 ||
    !validIssue
  ) {
    throw new Error(JSON.stringify({ before, sync, after }));
  }
  const summary = {
    schemaVersion: 1,
    kind: "nextclaw.portable-runtime.reference-app",
    ok: true,
    checks: ["github-sync", "persisted-list", "standard-wasi-kv", "public-issue-shape"],
    repository,
    issueCount: after.issues.length,
    firstIssue: {
      number: firstIssue.number,
      title: firstIssue.title,
      url: firstIssue.url,
    },
    persistedBy: after.persistedBy,
    requestedVia: sync.requestedVia,
  };
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  if (outputPath) await writeFile(path.resolve(outputPath), serialized, "utf8");
  process.stdout.write(serialized);
} finally {
  runner.kill("SIGTERM");
  await rm(dataDirectory, { recursive: true, force: true });
}
