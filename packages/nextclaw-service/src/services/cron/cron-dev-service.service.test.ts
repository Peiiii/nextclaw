import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

type CronJobRecord = {
  id: string;
  name: string;
  enabled: boolean;
  state: {
    nextRunAtMs?: number | null;
    lastRunAtMs?: number | null;
    lastStatus?: string | null;
    lastError?: string | null;
  };
};

type DevServiceHandle = {
  child: ChildProcess;
  spawnedAtMs: number;
};

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const nextclawCliPackageRoot = resolve(packageRoot, "../nextclaw");
const tempDirs: string[] = [];
const activeServices: DevServiceHandle[] = [];
let nextPort = 19100;
let mockProviderApiBase = "";
const mockProviderServer = createServer((request, response) => {
  if (request.method === "GET" && request.url?.endsWith("/models")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      object: "list",
      data: [{ id: "mock", object: "model", created: 1, owned_by: "test" }],
    }));
    return;
  }
  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    if (!body.trim()) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "JSON request body is required" } }));
      return;
    }
    const payload = JSON.parse(body) as { model?: string; stream?: boolean };
    if (payload.stream) {
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(`data: ${JSON.stringify({
        id: "chatcmpl-cron-test",
        object: "chat.completion.chunk",
        created: 1,
        model: payload.model ?? "mock",
        choices: [{ index: 0, delta: { role: "assistant", content: "Pong" }, finish_reason: null }],
      })}\n\n`);
      response.write(`data: ${JSON.stringify({
        id: "chatcmpl-cron-test",
        object: "chat.completion.chunk",
        created: 1,
        model: payload.model ?? "mock",
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      })}\n\n`);
      response.end("data: [DONE]\n\n");
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      id: "chatcmpl-cron-test",
      object: "chat.completion",
      created: 1,
      model: payload.model ?? "mock",
      choices: [{ index: 0, message: { role: "assistant", content: "Pong" }, finish_reason: "stop" }],
    }));
  });
});

beforeAll(async () => {
  await new Promise<void>((resolveListen, rejectListen) => {
    mockProviderServer.once("error", rejectListen);
    mockProviderServer.listen(0, "127.0.0.1", resolveListen);
  });
  const address = mockProviderServer.address() as AddressInfo;
  mockProviderApiBase = `http://127.0.0.1:${address.port}/v1`;
});

afterAll(async () => {
  await new Promise<void>((resolveClose, rejectClose) => {
    mockProviderServer.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }
      resolveClose();
    });
  });
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTempHome(): string {
  const root = mkdtempSync(join(tmpdir(), "nextclaw-cron-dev-test-"));
  const home = join(root, "home");
  mkdirSync(home, { recursive: true });
  writeFileSync(
    join(home, "config.json"),
    JSON.stringify({
      agents: { defaults: { model: "test/mock" } },
      providers: {
        test: {
          apiBase: mockProviderApiBase,
          apiKey: "test",
          models: ["test/mock"],
          providerType: "openai",
          wireApi: "chat",
        },
      },
    }),
    "utf8",
  );
  tempDirs.push(root);
  return home;
}

function buildChildEnv(home: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NEXTCLAW_HOME: home,
  };
}

function spawnPnpm(
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  }
): ChildProcess {
  const { cwd, env } = options;
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return spawn(process.execPath, [npmExecPath, ...args], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  return spawn("pnpm", args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readJobs(home: string): CronJobRecord[] {
  const jobsPath = join(home, "cron", "jobs.json");
  try {
    return JSON.parse(readFileSync(jobsPath, "utf-8")).jobs as CronJobRecord[];
  } catch {
    return [];
  }
}

function findJob(home: string, jobId: string): CronJobRecord | null {
  return readJobs(home).find((job) => job.id === jobId) ?? null;
}

async function waitForCondition<T>(
  label: string,
  read: () => T,
  predicate: (value: T) => boolean,
  timeoutMs: number
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let latest = read();
  while (Date.now() <= deadline) {
    latest = read();
    if (predicate(latest)) {
      return latest;
    }
    await wait(200);
  }
  throw new Error(`${label} timeout after ${timeoutMs}ms\n${JSON.stringify(latest, null, 2)}`);
}

async function runCli(home: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawnPnpm(args, {
      cwd: nextclawCliPackageRoot,
      env: buildChildEnv(home),
    });
    if (!child.stdout || !child.stderr) {
      reject(new Error(`CLI process missing stdio pipes for args: ${args.join(" ")}`));
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `CLI failed (${args.join(" ")}) with code ${String(code)}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
        )
      );
    });
  });
}

async function runCronCli(home: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return runCli(home, ["dev:build", "cron", ...args]);
}

async function addJobViaCli(
  home: string,
  args: string[]
): Promise<{ jobId: string; stdout: string }> {
  const result = await runCronCli(home, ["add", ...args]);
  const match = result.stdout.match(/\(([^)]+)\)/);
  if (!match) {
    throw new Error(`Failed to parse job id from output:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return { jobId: match[1], stdout: result.stdout };
}

async function startDevService(home: string): Promise<DevServiceHandle> {
  const port = nextPort;
  nextPort += 1;
  const child = spawnPnpm(["dev", "serve", "--ui-port", String(port)], {
    cwd: nextclawCliPackageRoot,
    env: buildChildEnv(home),
  });
  let logs = "";
  const onData = (chunk: Buffer) => {
    logs += chunk.toString();
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  await waitForCondition(
    `dev service ready on ${port}`,
    () => logs,
    (output) => output.includes("✓ UI NCP agent: ready"),
    20_000
  );

  const handle: DevServiceHandle = {
    child,
    spawnedAtMs: Date.now()
  };
  activeServices.push(handle);
  return handle;
}

async function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null) {
    return true;
  }
  return await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.removeListener("close", onClose);
      resolve(false);
    }, timeoutMs);
    const onClose = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    child.once("close", onClose);
  });
}

async function stopDevService(handle: DevServiceHandle): Promise<void> {
  if (handle.child.exitCode !== null) {
    return;
  }
  handle.child.kill("SIGINT");
  const exitedGracefully = await waitForChildExit(handle.child, 4_000);
  if (exitedGracefully) {
    return;
  }
  handle.child.kill("SIGKILL");
  await waitForChildExit(handle.child, 4_000);
}

function advanceCadence(anchorMs: number, nowMs: number, everyMs: number): number {
  if (anchorMs > nowMs) {
    return anchorMs;
  }
  return anchorMs + (Math.floor((nowMs - anchorMs) / everyMs) + 1) * everyMs;
}

afterEach(async () => {
  while (activeServices.length > 0) {
    const handle = activeServices.pop();
    if (!handle) {
      continue;
    }
    await stopDevService(handle);
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    }
  }
}, 20_000);

describe("cron dev-mode integration", () => {
  it(
    "hot reloads add/disable/enable/remove while the dev service is running",
    async () => {
      const home = createTempHome();
      await startDevService(home);
      const uniqueName = `running-job-${randomUUID().slice(0, 8)}`;
      const { jobId } = await addJobViaCli(home, [
        "-n",
        uniqueName,
        "-m",
        "Ping",
        "-e",
        "2",
      ]);

      const firstRun = await waitForCondition(
        "first interval trigger",
        () => findJob(home, jobId),
        (job) => Boolean(job?.state.lastRunAtMs),
        12_000
      );

      const defaultList = await runCronCli(home, ["list"]);
      expect(defaultList.stdout).toContain(jobId);
      expect(defaultList.stdout).toContain(uniqueName);

      const disableResult = await runCronCli(home, ["disable", jobId]);
      expect(disableResult.stdout).toContain("disabled");

      const disabledJob = await waitForCondition(
        "job disabled",
        () => findJob(home, jobId),
        (job) => job?.enabled === false,
        5_000
      );
      const lastRunAtBeforeDisable = disabledJob?.state.lastRunAtMs ?? firstRun?.state.lastRunAtMs ?? 0;
      await wait(3_500);
      const afterDisable = findJob(home, jobId);
      expect(afterDisable?.state.lastRunAtMs ?? 0).toBe(lastRunAtBeforeDisable);

      const enabledOnly = await runCronCli(home, ["list", "--enabled-only"]);
      expect(enabledOnly.stdout).not.toContain(jobId);

      const enableResult = await runCronCli(home, ["enable", jobId]);
      expect(enableResult.stdout).toContain("enabled");

      const resumed = await waitForCondition(
        "trigger after re-enable",
        () => findJob(home, jobId),
        (job) => (job?.state.lastRunAtMs ?? 0) > lastRunAtBeforeDisable,
        10_000
      );
      expect(resumed?.enabled).toBe(true);

      const removeResult = await runCronCli(home, ["remove", jobId]);
      expect(removeResult.stdout).toContain(`Removed job ${jobId}`);
      await waitForCondition(
        "job removed",
        () => readJobs(home),
        (jobs) => jobs.length === 0,
        5_000
      );
    },
    40_000
  );

  it(
    "runs one-shot jobs once and honors force for disabled jobs",
    async () => {
      const home = createTempHome();
      await startDevService(home);

      const atIso = new Date(Date.now() + 2_500).toISOString();
      const oneShotName = `one-shot-${randomUUID().slice(0, 8)}`;
      const { jobId: oneShotId } = await addJobViaCli(home, [
        "-n",
        oneShotName,
        "-m",
        "Ping",
        "--at",
        atIso,
      ]);

      const finishedOneShot = await waitForCondition(
        "one-shot completion",
        () => findJob(home, oneShotId),
        (job) =>
          Boolean(job?.state.lastRunAtMs)
          && job?.enabled === false
          && job?.state.nextRunAtMs === null,
        12_000
      );
      expect(finishedOneShot?.state.lastStatus).toBe("ok");

      const forcedName = `forced-run-${randomUUID().slice(0, 8)}`;
      const { jobId: forcedJobId } = await addJobViaCli(home, [
        "-n",
        forcedName,
        "-m",
        "Ping",
        "-e",
        "60",
      ]);

      const disableResult = await runCronCli(home, ["disable", forcedJobId]);
      expect(disableResult.stdout).toContain("disabled");
      const disabledBeforeRun = await waitForCondition(
        "forced job disabled",
        () => findJob(home, forcedJobId),
        (job) => job?.enabled === false,
        5_000
      );
      expect(disabledBeforeRun?.state.lastRunAtMs ?? null).toBe(null);

      const withoutForce = await runCronCli(home, ["run", forcedJobId]);
      expect(withoutForce.stdout).toContain(`Failed to run job ${forcedJobId}`);
      expect(findJob(home, forcedJobId)?.state.lastRunAtMs ?? null).toBe(null);

      const withForce = await runCronCli(home, ["run", forcedJobId, "--force"]);
      expect(withForce.stdout).toContain("✓ Job executed");

      const afterForce = await waitForCondition(
        "forced job executed",
        () => findJob(home, forcedJobId),
        (job) => Boolean(job?.state.lastRunAtMs),
        8_000
      );
      expect(afterForce?.enabled).toBe(false);
      expect(afterForce?.state.lastStatus).toBe("ok");
    },
    40_000
  );

  it(
    "keeps cadence for existing interval jobs across a dev-mode restart",
    async () => {
      const home = createTempHome();
      const { jobId } = await addJobViaCli(home, [
        "-n",
        `restart-${randomUUID().slice(0, 8)}`,
        "-m",
        "Ping",
        "-e",
        "6",
      ]);

      const originalJob = await waitForCondition(
        "pre-start job persisted",
        () => findJob(home, jobId),
        (job) => Boolean(job?.state.nextRunAtMs),
        5_000
      );
      const originalNextRunAtMs = originalJob?.state.nextRunAtMs ?? 0;
      expect(originalNextRunAtMs).toBeGreaterThan(0);

      const firstService = await startDevService(home);
      await wait(1_000);
      await stopDevService(firstService);

      await wait(5_000);

      const secondService = await startDevService(home);
      const afterRestart = await waitForCondition(
        "job reloaded after restart",
        () => findJob(home, jobId),
        (job) => Boolean(job?.state.nextRunAtMs),
        3_000
      );

      const expectedAlignedNext = advanceCadence(originalNextRunAtMs, secondService.spawnedAtMs, 6_000);
      expect(afterRestart?.state.nextRunAtMs).toBe(expectedAlignedNext);
      expect(afterRestart?.state.nextRunAtMs ?? 0).toBeLessThan(secondService.spawnedAtMs + 6_000);

      const triggeredAfterRestart = await waitForCondition(
        "trigger after restart",
        () => findJob(home, jobId),
        (job) => (job?.state.lastRunAtMs ?? 0) >= secondService.spawnedAtMs,
        12_000
      );
      expect(triggeredAfterRestart?.state.lastStatus).toBe("ok");
    },
    45_000
  );
});
