import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { EOL } from "node:os";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";

export function percentile(sortedValues, ratio) {
  if (sortedValues.length === 0) {
    return null;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * ratio) - 1)
  );
  return sortedValues[index];
}

export function summarizeNumbers(values) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    count: sorted.length,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    meanMs: Math.round(sum / sorted.length),
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
  };
}

export function summarizeRuns(runs) {
  const keys = [
    "uiApiReachableMs",
    "authStatusOkMs",
    "healthOkMs",
    "frontendServerReadyMs",
    "frontendAuthStatusOkMs",
    "ncpAgentReadyMs",
    "bootstrapReadyMs",
    "pluginHydrationReadyMs",
    "channelsReadyMs",
  ];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      summarizeNumbers(
        runs
          .map((run) => run[key])
          .filter((value) => Number.isFinite(value))
      ),
    ])
  );
}

export function createArtifactHome() {
  return mkdtempSync(join(tmpdir(), "nextclaw-startup-readiness-"));
}

export async function findAvailablePort(host) {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        if (!port) {
          reject(new Error("Failed to resolve a free port."));
          return;
        }
        resolve(port);
      });
    });
  });
}

export function formatCommand(template, params) {
  return template
    .replaceAll("{host}", params.host)
    .replaceAll("{port}", String(params.port))
    .replaceAll("{frontendPort}", String(params.frontendPort ?? ""))
    .replaceAll("{frontendUrl}", params.frontendUrl ?? "")
    .replaceAll("{baseUrl}", params.baseUrl)
    .replaceAll("{home}", params.home);
}

export function normalizeLineBuffer(buffer, chunk, onLine) {
  const merged = `${buffer}${chunk}`;
  const lines = merged.split(/\r?\n/);
  const nextBuffer = lines.pop() ?? "";
  for (const line of lines) {
    onLine(line);
  }
  return nextBuffer;
}

export function parseStartupTraceLine(line) {
  const match = /^\[startup-trace\] \+(\d+)ms ([^ ]+)(?: (.+))?$/.exec(line.trim());
  if (!match) {
    return null;
  }
  const [, elapsedMsRaw, step, rawFields] = match;
  const fields = {};
  if (rawFields) {
    for (const part of rawFields.split(" ")) {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }
      const key = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      fields[key] = value;
    }
  }
  return {
    elapsedMs: Number.parseInt(elapsedMsRaw, 10),
    step,
    fields,
  };
}

export async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      text,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: null,
      text: "",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHttp(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    await response.arrayBuffer();
    return {
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return true;
  }
  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const handleExit = () => {
      cleanup();
      resolve(true);
    };
    const cleanup = () => {
      clearTimeout(timer);
      child.off("exit", handleExit);
    };
    child.once("exit", handleExit);
  });
}

export async function terminateChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill("SIGINT");
  if (await waitForChildExit(child, 3_000)) {
    return;
  }

  child.kill("SIGTERM");
  if (await waitForChildExit(child, 3_000)) {
    return;
  }

  child.kill("SIGKILL");
  await waitForChildExit(child, 1_000);
}

export function readServiceLogTail(homeDir, lines = 40) {
  const logPath = join(homeDir, "logs", "service.log");
  try {
    const content = readFileSync(logPath, "utf8");
    return {
      logPath,
      tail: content.split(/\r?\n/).slice(-lines).join(EOL).trim(),
    };
  } catch {
    return {
      logPath,
      tail: "",
    };
  }
}
