import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { prepareTaskFixture, verifyTaskFixture } from "#benchmark/tasks/fixtures.config.mjs";
import { summarizeCalls } from "#benchmark/measurement/usage.utils.mjs";

class NextclawBenchmarkAdapter {
  constructor(config) { this.config = config; }
  start = async () => {
    const { home, workspace, model } = this.config;
    process.env.NEXTCLAW_HOME = home;
    writeFileSync(join(home, "config.json"), JSON.stringify({
      agents: { defaults: { model, workspace, thinkingDefault: "off" } },
      providers: { deepseek: { enabled: true, apiKey: "", models: ["deepseek-v4-flash"] } },
      secrets: { refs: { "providers.deepseek.apiKey": { source: "env", id: "CACHE_BENCHMARK_API_KEY" } } },
    }), { mode: 0o600 });
    const { installNextclawBenchmarkObserver } = await import("@nextclaw/agent-benchmark");
    await installNextclawBenchmarkObserver();
    const { NextclawHarness } = await import("@nextclaw/kernel");
    this.harness = new NextclawHarness({ homeDir: home, configPath: join(home, "config.json") });
    await this.harness.start();
  };
  run = async (input) => {
    const { model, taskId, timeoutMs } = this.config;
    const result = await this.harness.runTask({ sessionId: `benchmark-${taskId}`, model, input,
      signal: globalThis.AbortSignal.timeout(timeoutMs) });
    return result.text;
  };
  close = async () => { await this.harness?.dispose(); };
}

class DshBenchmarkAdapter {
  constructor(config) { this.config = config; }
  start = async () => {
    const { sdkEntry, home, workspace, maxOutputTokens, timeoutMs, observerPath } = this.config;
    const { DeepSeekHarness } = await import(sdkEntry);
    this.harness = new DeepSeekHarness({ dshHome: home, cwd: workspace, processCwd: workspace,
      provider: "deepseek-official", model: "deepseek-v4-flash", maxTokens: maxOutputTokens,
      initializeTimeoutMs: timeoutMs, requestTimeoutMs: timeoutMs,
      env: { PATH: process.env.PATH, HOME: home, USERPROFILE: home,
        XDG_CONFIG_HOME: join(home, ".config"), XDG_DATA_HOME: join(home, ".local/share"),
        XDG_CACHE_HOME: join(home, ".cache"), TMPDIR: process.env.TMPDIR,
        DEEPSEEK_API_KEY: process.env.CACHE_BENCHMARK_API_KEY,
        NODE_OPTIONS: `--import ${observerPath}`,
        NEXTCLAW_BENCHMARK_WORKER_CONFIG: process.env.NEXTCLAW_BENCHMARK_WORKER_CONFIG },
    });
    await this.harness.start();
    this.session = this.harness.session();
  };
  run = async (input) => (await this.session.run(input)).finalResponse;
  close = async () => { await this.harness?.close(); };
}

function readCalls(tracePath) {
  if (!existsSync(tracePath)) return [];
  const updates = readFileSync(tracePath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  return [...new Map(updates.map((call) => [call.number, call])).values()];
}

async function runWorker(config) {
  const { harness: harnessName, taskId, workspace, timeoutMs, tracePath, reportPath } = config;
  const isolation = { profile: "clean-home-v1",
    systemHomeMatches: realpathSync(homedir()) === realpathSync(config.home),
    cwdMatches: realpathSync(process.cwd()) === realpathSync(workspace),
    globalSkillsInitiallyAbsent: !existsSync(join(config.home, ".agents/skills")) };
  if (!isolation.systemHomeMatches || !isolation.cwdMatches || !isolation.globalSkillsInitiallyAbsent) {
    throw new Error("Benchmark environment is not isolated");
  }
  const adapter = harnessName === "nextclaw" ? new NextclawBenchmarkAdapter(config) : new DshBenchmarkAdapter(config);
  const prompts = prepareTaskFixture(taskId, workspace, harnessName === "nextclaw" ? "read_file" : "read");
  const replies = [], startedAt = new Date().toISOString();
  let failure = null, readyAt = null;
  const timer = setTimeout(() => { failure = "Task timeout"; void adapter.close(); }, timeoutMs);
  try {
    await adapter.start(); readyAt = Date.now();
    for (const prompt of prompts) replies.push(await adapter.run(prompt));
  } catch (error) { failure = String(error); }
  finally { clearTimeout(timer); await adapter.close(); }
  const calls = readCalls(tracePath), all = summarizeCalls(calls);
  let checks;
  try { checks = verifyTaskFixture({ taskId, workspace, replies, calls }); }
  catch (error) { checks = { verificationCompleted: false }; failure ??= String(error); }
  const endedAt = new Date().toISOString();
  const report = { harness: harnessName, taskId, startedAt, endedAt, replies, failure, checks, all, calls,
    isolation,
    durationMs: Date.parse(endedAt) - Date.parse(startedAt),
    startupMs: readyAt === null ? null : readyAt - Date.parse(startedAt),
    modelRequestMs: calls.reduce((sum, call) => sum + (call.elapsedMs ?? 0), 0),
    passed: !failure && all.complete && Object.values(checks).every(Boolean) };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
}

await runWorker(JSON.parse(readFileSync(process.env.NEXTCLAW_BENCHMARK_WORKER_CONFIG, "utf8")));
