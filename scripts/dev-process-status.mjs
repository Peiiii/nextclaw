#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { printHumanSummary, printKillSummary } from "./dev-process-report.mjs";

const args = new Set(process.argv.slice(2));
const outputJson = args.has("--json");
const verbose = args.has("--verbose");
const killRequested = args.has("--kill");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runCommand(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    env: process.env
  });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(`${command} ${commandArgs.join(" ")} failed${stderr ? `: ${stderr}` : ""}`);
  }
  return result.stdout ?? "";
}

function parsePsLines(raw) {
  return raw
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
      if (!match) {
        return null;
      }
      return {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        pgid: Number(match[3]),
        stat: match[4],
        etime: match[5],
        tty: match[6],
        command: match[7]
      };
    })
    .filter((entry) => entry !== null);
}

function parseLsofLines(raw) {
  const listeners = [];
  let currentPid = null;
  for (const line of raw.split("\n")) {
    if (!line) {
      continue;
    }
    const field = line[0];
    const value = line.slice(1);
    if (field === "p") {
      currentPid = Number(value);
      continue;
    }
    if (field !== "n" || currentPid === null) {
      continue;
    }
    const portMatch = value.match(/:(\d+)$/);
    if (!portMatch) {
      continue;
    }
    listeners.push({
      pid: currentPid,
      port: Number(portMatch[1]),
      address: value
    });
  }
  return listeners;
}

function extractPort(command, flag) {
  const match = command.match(new RegExp(`${flag}\\s+(\\d+)`));
  return match ? Number(match[1]) : undefined;
}

function inferHomeScope(command) {
  if (!command.includes("--exclude")) {
    return "unknown";
  }
  if (command.includes("/.nextclaw") || command.includes(".nextclaw/**")) {
    return "default";
  }
  if (
    command.includes("/tmp/") ||
    command.includes("/private/tmp/") ||
    command.includes("/var/folders/") ||
    command.includes("nextclaw-dev-home") ||
    command.includes("nextclaw-feishu-reload-verify")
  ) {
    return "isolated";
  }
  return "unknown";
}

function classifyProcess(entry) {
  const command = entry.command;
  const roles = [];
  const uiPort = extractPort(command, "--ui-port");
  const frontendPort = extractPort(command, "--port");

  if (/pnpm dev start(?:\s|$)/.test(command)) {
    roles.push("dev-start-pnpm");
  }
  if (command.includes("scripts/dev-runner.mjs start")) {
    roles.push("dev-runner");
  }
  if (/tsx.*\swatch\b.*src\/cli\/index\.ts serve --ui-port \d+/.test(command)) {
    roles.push("backend-watch");
  }
  if (
    command.includes("src/cli/index.ts serve --ui-port") &&
    !roles.includes("backend-watch")
  ) {
    roles.push("backend-runtime");
  }
  if (command.includes("vite/bin/vite.js")) {
    roles.push("frontend-vite");
  }
  if (
    /pnpm -C packages\/nextclaw dev:build serve --ui-port \d+/.test(command) ||
    /pnpm -C packages\/nextclaw exec tsx src\/cli\/index\.ts serve --ui-port \d+/.test(command)
  ) {
    roles.push("standalone-serve-pnpm");
  }

  return {
    ...entry,
    roles,
    uiPort,
    frontendPort,
    homeScope: inferHomeScope(command)
  };
}

function findAnchorPid(entry, relevantByPid) {
  let current = entry;
  let anchor = entry;
  const seen = new Set([entry.pid]);

  while (true) {
    const parent = relevantByPid.get(current.ppid);
    if (!parent || seen.has(parent.pid)) {
      return anchor.pid;
    }
    seen.add(parent.pid);
    anchor = parent;
    current = parent;
  }
}

function pickFirst(group, role) {
  return group.processes.find((entry) => entry.roles.includes(role));
}

function chooseMode(group) {
  if (
    group.processes.some(
      (entry) =>
        entry.roles.includes("dev-start-pnpm") ||
        entry.roles.includes("dev-runner") ||
        entry.roles.includes("backend-watch")
    )
  ) {
    return "dev-start";
  }
  return "standalone-serve";
}

function uniquePorts(listeners) {
  return Array.from(new Set(listeners.map((listener) => listener.port))).sort((left, right) => left - right);
}

function buildGroupSummary(group, listenersByPgid) {
  const root = group.root;
  const mode = chooseMode(group);
  const devStartPnpm = pickFirst(group, "dev-start-pnpm");
  const devRunner = pickFirst(group, "dev-runner");
  const backendWatch = pickFirst(group, "backend-watch");
  const backendRuntime = pickFirst(group, "backend-runtime");
  const frontendVite = pickFirst(group, "frontend-vite");
  const standaloneServe = pickFirst(group, "standalone-serve-pnpm");
  const uiPort = backendWatch?.uiPort ?? backendRuntime?.uiPort ?? standaloneServe?.uiPort;
  const frontendPort = frontendVite?.frontendPort;
  const listeners = listenersByPgid.get(group.root.pid) ?? [];
  const listeningPorts = uniquePorts(listeners);
  const backendListening = typeof uiPort === "number" ? listeningPorts.includes(uiPort) : false;
  const frontendListening = typeof frontendPort === "number" ? listeningPorts.includes(frontendPort) : false;
  const homeScope = backendWatch?.homeScope ?? "unknown";
  const notes = [];

  let status = "stale";
  if (mode === "dev-start") {
    const hasCoreChain = Boolean(devStartPnpm && devRunner && backendWatch && backendRuntime && frontendVite);
    if (hasCoreChain && backendListening && frontendListening) {
      status = "running";
    } else if (backendListening || frontendListening) {
      status = "partial";
    }
  } else if (backendListening) {
    status = "running";
  }

  if (root.ppid === 1 || root.tty === "??") {
    notes.push("detached");
  }
  if (mode === "dev-start" && homeScope === "default") {
    notes.push("default-home");
  }
  if (mode === "dev-start" && !frontendListening) {
    notes.push("frontend-not-listening");
  }
  if (!backendListening) {
    notes.push("backend-not-listening");
  }

  return {
    rootPid: root.pid,
    pgid: group.pgid,
    mode,
    status,
    rootPpid: root.ppid,
    tty: root.tty,
    age: root.etime,
    uiPort,
    frontendPort,
    backendListening,
    frontendListening,
    homeScope,
    listeningPorts,
    notes,
    processes: group.processes
      .slice()
      .sort((left, right) => left.pid - right.pid)
      .map((entry) => ({
        pid: entry.pid,
        ppid: entry.ppid,
        stat: entry.stat,
        etime: entry.etime,
        tty: entry.tty,
        roles: entry.roles,
        command: entry.command
      }))
  };
}

function collectRelevantProcesses() {
  const psOutput = runCommand("ps", ["-Ao", "pid=,ppid=,pgid=,stat=,etime=,tty=,command="]);
  const allProcesses = parsePsLines(psOutput).map(classifyProcess);
  const relevantProcesses = allProcesses.filter((entry) => entry.roles.length > 0);
  const relevantByPid = new Map(relevantProcesses.map((entry) => [entry.pid, entry]));

  const byAnchorPid = new Map();
  for (const process of relevantProcesses) {
    const anchorPid = findAnchorPid(process, relevantByPid);
    const root = relevantByPid.get(anchorPid) ?? process;
    const existing = byAnchorPid.get(anchorPid);
    if (existing) {
      existing.processes.push(process);
      continue;
    }
    byAnchorPid.set(anchorPid, {
      root,
      pgid: process.pgid,
      processes: [process]
    });
  }

  let listeners = [];
  try {
    listeners = parseLsofLines(runCommand("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pn"]));
  } catch {
    listeners = [];
  }

  const pidToAnchorPid = new Map(
    relevantProcesses.map((entry) => [entry.pid, findAnchorPid(entry, relevantByPid)])
  );
  const listenersByPgid = new Map();
  for (const listener of listeners) {
    const anchorPid = pidToAnchorPid.get(listener.pid);
    if (!anchorPid) {
      continue;
    }
    const list = listenersByPgid.get(anchorPid);
    if (list) {
      list.push(listener);
      continue;
    }
    listenersByPgid.set(anchorPid, [listener]);
  }

  const summaries = Array.from(byAnchorPid.values())
    .map((group) => buildGroupSummary(group, listenersByPgid))
    .sort((left, right) => {
      const leftPort = left.uiPort ?? left.frontendPort ?? left.pgid;
      const rightPort = right.uiPort ?? right.frontendPort ?? right.pgid;
      return leftPort - rightPort;
    });

  return {
    relevantProcesses,
    summaries
  };
}

async function killSummaries(summaries, relevantProcesses) {
  const targetedSummaries = summaries.filter((entry) => entry.processes.length > 0);
  const targetedPids = new Set(targetedSummaries.flatMap((entry) => entry.processes.map((process) => process.pid)));
  const targetedPgids = Array.from(
    new Set(targetedSummaries.map((entry) => entry.pgid).filter((pgid) => Number.isInteger(pgid) && pgid > 1))
  ).sort((left, right) => left - right);

  for (const pgid of targetedPgids) {
    try {
      process.kill(-pgid, "SIGTERM");
    } catch {
      // Ignore already-exited or inaccessible groups and verify via the follow-up scan.
    }
  }

  await sleep(800);

  const afterTerm = collectRelevantProcesses().relevantProcesses.filter(
    (entry) => targetedPids.has(entry.pid) || targetedPgids.includes(entry.pgid)
  );
  const remainingAfterTerm = Array.from(new Set(afterTerm.map((entry) => entry.pid))).sort((left, right) => left - right);
  const remainingPgids = Array.from(new Set(afterTerm.map((entry) => entry.pgid))).sort((left, right) => left - right);

  for (const pgid of remainingPgids) {
    try {
      process.kill(-pgid, "SIGKILL");
    } catch {
      // Ignore already-exited or inaccessible groups and verify via the follow-up scan.
    }
  }

  if (remainingPgids.length > 0) {
    await sleep(300);
  }

  const afterKill = collectRelevantProcesses().relevantProcesses.filter(
    (entry) => targetedPids.has(entry.pid) || targetedPgids.includes(entry.pgid)
  );
  const remainingAfterKill = Array.from(new Set(afterKill.map((entry) => entry.pid))).sort((left, right) => left - right);

  return {
    targetedGroups: targetedSummaries.length,
    targetedPgids,
    targetedSummaries,
    remainingAfterTerm,
    remainingAfterKill,
    initialProcessCount: relevantProcesses.length
  };
}

async function main() {
  const { relevantProcesses, summaries } = collectRelevantProcesses();

  if (killRequested) {
    const result = await killSummaries(summaries, relevantProcesses);
    if (outputJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    printKillSummary(result, { verbose });
    return;
  }

  if (outputJson) {
    console.log(JSON.stringify({ groups: summaries }, null, 2));
    return;
  }
  printHumanSummary(summaries, { verbose });
}

await main();
