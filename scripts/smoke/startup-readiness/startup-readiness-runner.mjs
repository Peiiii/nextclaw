import { rmSync } from "node:fs";
import { spawn } from "node:child_process";
import {
  createArtifactHome,
  fetchHttp,
  fetchJson,
  findAvailablePort,
  formatCommand,
  normalizeLineBuffer,
  parseStartupTraceLine,
  readServiceLogTail,
  summarizeRuns,
  terminateChild,
} from "./startup-readiness-support.mjs";
import { printRunWaterfall } from "./startup-readiness-waterfall.mjs";

const STARTUP_TRACE_ENV_KEY = "NEXTCLAW_STARTUP_TRACE";

function getCriterionValue(run, criterion) {
  if (criterion === "ui-api") {
    return run.uiApiReachableMs;
  }
  if (criterion === "auth-status") {
    return run.authStatusOkMs;
  }
  if (criterion === "frontend-auth-status") {
    return run.frontendAuthStatusOkMs;
  }
  if (criterion === "health") {
    return run.healthOkMs;
  }
  if (criterion === "bootstrap-ready") {
    return run.bootstrapReadyMs;
  }
  if (criterion === "plugin-hydration-ready") {
    return run.pluginHydrationReadyMs;
  }
  if (criterion === "channels-ready") {
    return run.channelsReadyMs;
  }
  return run.ncpAgentReadyMs;
}

function createRunRecord(runIndex, port, homeDir, baseUrl, command, frontend) {
  return {
    runIndex,
    port,
    homeDir,
    baseUrl,
    command,
    frontendPort: frontend?.port ?? null,
    frontendUrl: frontend?.url ?? null,
    frontendCommand: frontend?.command ?? null,
    devRunnerApiBaseResolved: false,
    devRunnerFrontendResolved: false,
    uiApiReachableMs: null,
    authStatusOkMs: null,
    frontendServerReadyMs: null,
    frontendAuthStatusOkMs: null,
    frontendAuthStatusFailureCount: 0,
    frontendAuthStatusLastError: null,
    healthOkMs: null,
    ncpAgentReadyMs: null,
    bootstrapReadyMs: null,
    pluginHydrationReadyMs: null,
    channelsReadyMs: null,
    startupTrace: [],
    stdoutLines: [],
    stderrLines: [],
    success: false,
    failureReason: null,
    childExit: null,
    serviceLogTail: "",
  };
}

function spawnBenchmarkChild(homeDir, command, extraEnv = {}) {
  const shell = process.platform === "win32" ? "cmd.exe" : process.env.SHELL || "zsh";
  const shellArgs = process.platform === "win32" ? ["/d", "/s", "/c", command] : ["-lc", command];
  return spawn(shell, shellArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXTCLAW_HOME: homeDir,
      [STARTUP_TRACE_ENV_KEY]: "1",
      ...extraEnv,
    },
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function applyDevRunnerUrlLine(run, line) {
  const apiBaseMatch = /^\[dev\] API base: (http:\/\/\S+)\s*$/.exec(line);
  if (apiBaseMatch) {
    run.baseUrl = apiBaseMatch[1];
    run.devRunnerApiBaseResolved = true;
    const port = Number.parseInt(new URL(run.baseUrl).port, 10);
    run.port = Number.isFinite(port) ? port : run.port;
    return;
  }
  const frontendMatch = /^\[dev\] Frontend: (http:\/\/\S+)\s*$/.exec(line);
  if (frontendMatch) {
    run.frontendUrl = frontendMatch[1];
    run.devRunnerFrontendResolved = true;
    const port = Number.parseInt(new URL(run.frontendUrl).port, 10);
    run.frontendPort = Number.isFinite(port) ? port : run.frontendPort;
  }
}

function attachChildOutput(child, run, prefix = "") {
  const buffers = {
    stdout: "",
    stderr: "",
  };

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffers.stdout = normalizeLineBuffer(buffers.stdout, chunk, (line) => {
      run.stdoutLines.push(prefix ? `${prefix}${line}` : line);
      applyDevRunnerUrlLine(run, line);
      const trace = parseStartupTraceLine(line);
      if (trace) {
        run.startupTrace.push(trace);
      }
    });
  });
  child.stderr.on("data", (chunk) => {
    buffers.stderr = normalizeLineBuffer(buffers.stderr, chunk, (line) => {
      run.stderrLines.push(prefix ? `${prefix}${line}` : line);
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
  if (bootstrapData?.pluginHydration?.state === "ready" && run.pluginHydrationReadyMs === null) {
    run.pluginHydrationReadyMs = elapsedMs;
  }
  if (bootstrapData?.channels?.state === "ready" && run.channelsReadyMs === null) {
    run.channelsReadyMs = elapsedMs;
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

function recordFrontendServerMilestone(run, elapsedMs, frontendResponse) {
  if (!run.frontendUrl || run.frontendServerReadyMs !== null) {
    return;
  }
  if (frontendResponse.ok) {
    run.frontendServerReadyMs = elapsedMs;
  }
}

function recordFrontendAuthStatusMilestone(run, elapsedMs, authStatus) {
  if (run.frontendServerReadyMs === null || run.frontendAuthStatusOkMs !== null) {
    return;
  }
  const authStatusOk = authStatus.ok && authStatus.body?.ok === true && typeof authStatus.body?.data === "object";
  if (authStatusOk) {
    run.frontendAuthStatusOkMs = elapsedMs;
    return;
  }
  run.frontendAuthStatusFailureCount += 1;
  run.frontendAuthStatusLastError = authStatus.error ?? `HTTP ${String(authStatus.status)}`;
}

async function pollRunUntilCriterion(options, run, processes, startedAt) {
  while (Date.now() - startedAt < options.timeoutMs) {
    const elapsedMs = Date.now() - startedAt;
    const exitedProcess = processes.find((processInfo) =>
      processInfo.child.exitCode !== null || processInfo.child.signalCode !== null
    );
    if (exitedProcess) {
      run.failureReason = `${exitedProcess.label} process exited before criterion was reached (exit=${exitedProcess.child.exitCode ?? "null"}, signal=${exitedProcess.child.signalCode ?? "null"})`;
      return;
    }
    if (options.devRunner && (!run.devRunnerApiBaseResolved || !run.devRunnerFrontendResolved)) {
      await new Promise((resolve) => setTimeout(resolve, options.pollMs));
      continue;
    }
    if (run.frontendUrl) {
      recordFrontendServerMilestone(
        run,
        elapsedMs,
        await fetchHttp(run.frontendUrl)
      );
    }
    const authStatus = await fetchJson(`${run.baseUrl}/api/auth/status`);
    if (run.frontendUrl && run.frontendServerReadyMs !== null) {
      recordFrontendAuthStatusMilestone(
        run,
        elapsedMs,
        await fetchJson(`${run.frontendUrl}/api/auth/status`)
      );
    }
    recordBootstrapMilestones(
      run,
      elapsedMs,
      await fetchJson(`${run.baseUrl}/api/runtime/bootstrap-status`)
    );
    recordAuthStatusMilestone(
      run,
      elapsedMs,
      authStatus
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

    await new Promise((resolve) => setTimeout(resolve, options.pollMs));
  }

  run.failureReason = `criterion ${options.criterion} not reached within ${options.timeoutMs}ms`;
}

async function finalizeRun(options, run, processes) {
  for (const processInfo of processes) {
    await terminateChild(processInfo.child);
  }
  run.childExit = {
    exitCode: processes[0]?.child.exitCode ?? null,
    signalCode: processes[0]?.child.signalCode ?? null,
  };
  run.serviceLogTail = readServiceLogTail(run.homeDir).tail;
  for (const processInfo of processes) {
    if (processInfo.buffers.stdout.trim()) {
      run.stdoutLines.push(`${processInfo.prefix}${processInfo.buffers.stdout.trim()}`);
    }
    if (processInfo.buffers.stderr.trim()) {
      run.stderrLines.push(`${processInfo.prefix}${processInfo.buffers.stderr.trim()}`);
    }
  }
  if (!options.home && !options.keepArtifacts && run.success) {
    rmSync(run.homeDir, { recursive: true, force: true });
  }
}

async function measureSingleRun(options, runIndex) {
  const homeDir = options.home ?? createArtifactHome();
  const port = options.port ?? await findAvailablePort(options.host);
  let frontendPort = options.frontendServer
    ? options.frontendPort ?? await findAvailablePort(options.host)
    : null;
  while (frontendPort === port) {
    frontendPort = await findAvailablePort(options.host);
  }
  const baseUrl = `http://${options.host}:${port}`;
  const frontendUrl = frontendPort ? `http://${options.host}:${frontendPort}` : null;
  const command = formatCommand(options.commandTemplate, {
    host: options.host,
    port,
    frontendPort,
    frontendUrl,
    baseUrl,
    home: homeDir,
  });
  const frontendCommand = frontendUrl
    ? formatCommand(options.frontendCommandTemplate, {
      host: options.host,
      port,
      frontendPort,
      frontendUrl,
      baseUrl,
      home: homeDir,
    })
    : null;
  const run = createRunRecord(
    runIndex,
    port,
    homeDir,
    baseUrl,
    command,
    frontendUrl && frontendPort
      ? {
        port: frontendPort,
        url: frontendUrl,
        command: frontendCommand,
      }
      : null
  );
  run.devRunnerApiBaseResolved = !options.devRunner;
  run.devRunnerFrontendResolved = !options.devRunner || !frontendUrl;
  const child = spawnBenchmarkChild(homeDir, command);
  const processes = [
    {
      label: "backend",
      child,
      buffers: attachChildOutput(child, run),
      prefix: "",
    },
  ];
  if (frontendCommand && frontendUrl && !options.frontendManagedByCommand) {
    const frontendChild = spawnBenchmarkChild(homeDir, frontendCommand, {
      VITE_API_BASE: baseUrl,
    });
    processes.push({
      label: "frontend",
      child: frontendChild,
      buffers: attachChildOutput(frontendChild, run, "[frontend] "),
      prefix: "[frontend] ",
    });
  }
  const startedAt = Date.now();

  try {
    await pollRunUntilCriterion(options, run, processes, startedAt);
  } finally {
    await finalizeRun(options, run, processes);
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
    devRunner: options.devRunner,
    frontendCommandTemplate: options.frontendCommandTemplate,
    frontendManagedByCommand: options.frontendManagedByCommand,
    frontendServer: options.frontendServer,
    runs,
    aggregate: summarizeRuns(runs),
  };
}

export function printPrettySummary(summary) {
  console.log(`criterion: ${summary.criterion}`);
  console.log(`commandTemplate: ${summary.commandTemplate}`);
  if (summary.devRunner) {
    console.log("mode: dev-runner");
  }
  if (summary.frontendServer && !summary.frontendManagedByCommand) {
    console.log(`frontendCommandTemplate: ${summary.frontendCommandTemplate}`);
  }
  console.log(`runs: ${summary.runs.length}`);
  for (const run of summary.runs) {
    const status = run.success ? "ok" : "failed";
    console.log(
      `run #${run.runIndex} [${status}] api=${run.baseUrl} frontend=${run.frontendUrl ?? "-"} uiApi=${run.uiApiReachableMs ?? "-"}ms authStatus=${run.authStatusOkMs ?? "-"}ms frontendServer=${run.frontendServerReadyMs ?? "-"}ms frontendAuthStatus=${run.frontendAuthStatusOkMs ?? "-"}ms frontendAuthFailures=${run.frontendAuthStatusFailureCount} health=${run.healthOkMs ?? "-"}ms ncpReady=${run.ncpAgentReadyMs ?? "-"}ms ready=${run.bootstrapReadyMs ?? "-"}ms pluginReady=${run.pluginHydrationReadyMs ?? "-"}ms channelsReady=${run.channelsReadyMs ?? "-"}ms`
    );
    if (run.frontendAuthStatusLastError && run.frontendAuthStatusOkMs === null) {
      console.log(`  frontendAuthLastError: ${run.frontendAuthStatusLastError}`);
    }
    if (!run.success && run.failureReason) {
      console.log(`  failure: ${run.failureReason}`);
    }
    printRunWaterfall(run);
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
