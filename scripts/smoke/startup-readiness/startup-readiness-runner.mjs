import { rmSync } from "node:fs";
import { spawn } from "node:child_process";
import {
  createArtifactHome,
  fetchJson,
  findAvailablePort,
  formatCommand,
  normalizeLineBuffer,
  parseStartupTraceLine,
  readServiceLogTail,
  summarizeRuns,
  terminateChild,
} from "./startup-readiness-support.mjs";

const STARTUP_TRACE_ENV_KEY = "NEXTCLAW_STARTUP_TRACE";

function getCriterionValue(run, criterion) {
  if (criterion === "ui-api") {
    return run.uiApiReachableMs;
  }
  if (criterion === "auth-status") {
    return run.authStatusOkMs;
  }
  if (criterion === "health") {
    return run.healthOkMs;
  }
  if (criterion === "bootstrap-ready") {
    return run.bootstrapReadyMs;
  }
  return run.ncpAgentReadyMs;
}

function createRunRecord(runIndex, port, homeDir, baseUrl, command) {
  return {
    runIndex,
    port,
    homeDir,
    baseUrl,
    command,
    uiApiReachableMs: null,
    authStatusOkMs: null,
    healthOkMs: null,
    ncpAgentReadyMs: null,
    bootstrapReadyMs: null,
    startupTrace: [],
    stdoutLines: [],
    stderrLines: [],
    success: false,
    failureReason: null,
    childExit: null,
    serviceLogTail: "",
  };
}

function spawnBenchmarkChild(homeDir, command) {
  const shell = process.platform === "win32" ? "cmd.exe" : process.env.SHELL || "zsh";
  const shellArgs = process.platform === "win32" ? ["/d", "/s", "/c", command] : ["-lc", command];
  return spawn(shell, shellArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXTCLAW_HOME: homeDir,
      [STARTUP_TRACE_ENV_KEY]: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function attachChildOutput(child, run) {
  const buffers = {
    stdout: "",
    stderr: "",
  };

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffers.stdout = normalizeLineBuffer(buffers.stdout, chunk, (line) => {
      run.stdoutLines.push(line);
      const trace = parseStartupTraceLine(line);
      if (trace) {
        run.startupTrace.push(trace);
      }
    });
  });
  child.stderr.on("data", (chunk) => {
    buffers.stderr = normalizeLineBuffer(buffers.stderr, chunk, (line) => {
      run.stderrLines.push(line);
    });
  });

  return buffers;
}

function recordBootstrapMilestones(run, elapsedMs, bootstrap) {
  if (bootstrap.ok && run.uiApiReachableMs === null) {
    run.uiApiReachableMs = elapsedMs;
  }
  const bootstrapData = bootstrap.body?.ok === true ? bootstrap.body.data : null;
  if (bootstrapData?.ncpAgent?.state === "ready" && run.ncpAgentReadyMs === null) {
    run.ncpAgentReadyMs = elapsedMs;
  }
  if (bootstrapData?.phase === "ready" && run.bootstrapReadyMs === null) {
    run.bootstrapReadyMs = elapsedMs;
  }
}

function recordHealthMilestone(run, elapsedMs, health) {
  const healthOk = health.ok && health.body?.ok === true && health.body?.data?.status === "ok";
  if (healthOk && run.healthOkMs === null) {
    run.healthOkMs = elapsedMs;
  }
}

function recordAuthStatusMilestone(run, elapsedMs, authStatus) {
  const authStatusOk = authStatus.ok && authStatus.body?.ok === true && typeof authStatus.body?.data === "object";
  if (authStatusOk && run.authStatusOkMs === null) {
    run.authStatusOkMs = elapsedMs;
  }
}

async function pollRunUntilCriterion(options, run, child, startedAt) {
  while (Date.now() - startedAt < options.timeoutMs) {
    const elapsedMs = Date.now() - startedAt;
    recordBootstrapMilestones(
      run,
      elapsedMs,
      await fetchJson(`${run.baseUrl}/api/runtime/bootstrap-status`)
    );
    recordAuthStatusMilestone(
      run,
      elapsedMs,
      await fetchJson(`${run.baseUrl}/api/auth/status`)
    );
    recordHealthMilestone(
      run,
      elapsedMs,
      await fetchJson(`${run.baseUrl}/api/health`)
    );

    if (getCriterionValue(run, options.criterion) !== null) {
      run.success = true;
      return;
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      run.failureReason = `startup process exited before criterion was reached (exit=${child.exitCode ?? "null"}, signal=${child.signalCode ?? "null"})`;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, options.pollMs));
  }

  run.failureReason = `criterion ${options.criterion} not reached within ${options.timeoutMs}ms`;
}

async function finalizeRun(options, run, child, buffers) {
  await terminateChild(child);
  run.childExit = {
    exitCode: child.exitCode,
    signalCode: child.signalCode,
  };
  run.serviceLogTail = readServiceLogTail(run.homeDir).tail;
  if (buffers.stdout.trim()) {
    run.stdoutLines.push(buffers.stdout.trim());
  }
  if (buffers.stderr.trim()) {
    run.stderrLines.push(buffers.stderr.trim());
  }
  if (!options.keepArtifacts && run.success) {
    rmSync(run.homeDir, { recursive: true, force: true });
  }
}

async function measureSingleRun(options, runIndex) {
  const homeDir = createArtifactHome();
  const port = options.port ?? await findAvailablePort(options.host);
  const baseUrl = `http://${options.host}:${port}`;
  const command = formatCommand(options.commandTemplate, {
    host: options.host,
    port,
    baseUrl,
    home: homeDir,
  });
  const run = createRunRecord(runIndex, port, homeDir, baseUrl, command);
  const child = spawnBenchmarkChild(homeDir, command);
  const buffers = attachChildOutput(child, run);

  try {
    await pollRunUntilCriterion(options, run, child, Date.now());
  } finally {
    await finalizeRun(options, run, child, buffers);
  }

  return run;
}

export async function runBenchmark(options) {
  const runs = [];
  for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
    runs.push(await measureSingleRun(options, runIndex));
  }

  return {
    criterion: options.criterion,
    commandTemplate: options.commandTemplate,
    runs,
    aggregate: summarizeRuns(runs),
  };
}

export function printPrettySummary(summary) {
  console.log(`criterion: ${summary.criterion}`);
  console.log(`commandTemplate: ${summary.commandTemplate}`);
  console.log(`runs: ${summary.runs.length}`);
  for (const run of summary.runs) {
    const status = run.success ? "ok" : "failed";
    console.log(
      `run #${run.runIndex} [${status}] port=${run.port} uiApi=${run.uiApiReachableMs ?? "-"}ms authStatus=${run.authStatusOkMs ?? "-"}ms health=${run.healthOkMs ?? "-"}ms ncpReady=${run.ncpAgentReadyMs ?? "-"}ms ready=${run.bootstrapReadyMs ?? "-"}ms`
    );
    if (!run.success && run.failureReason) {
      console.log(`  failure: ${run.failureReason}`);
    }
  }
  console.log("aggregate:");
  for (const [key, stats] of Object.entries(summary.aggregate)) {
    if (!stats) {
      console.log(`  ${key}: no data`);
      continue;
    }
    console.log(
      `  ${key}: min=${stats.minMs}ms median=${stats.medianMs}ms mean=${stats.meanMs}ms p95=${stats.p95Ms}ms max=${stats.maxMs}ms`
    );
  }
}
