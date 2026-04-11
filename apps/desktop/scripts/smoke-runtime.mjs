#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { RuntimeServiceProcess } = require("../dist/src/runtime-service.js");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const workspace = mkdtempSync(join(tmpdir(), "nextclaw-desktop-smoke-"));
const embeddedScriptPath = join(workspace, "mock-embedded-runtime.cjs");
const managedScriptPath = join(workspace, "mock-managed-runtime.cjs");
const managedServerPath = join(workspace, "mock-managed-runtime-server.cjs");

writeFileSync(
  embeddedScriptPath,
  [
    "const http = require('node:http');",
    "const args = process.argv.slice(2);",
    "const command = args[0];",
    "if (command === 'init') {",
    "  process.exit(0);",
    "}",
    "if (command !== 'serve') throw new Error('expected serve command');",
    "const portIndex = args.indexOf('--ui-port');",
    "const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 0;",
    "if (!port) throw new Error('missing --ui-port');",
    "const server = http.createServer((req, res) => {",
    "  if (req.url === '/api/health') {",
    "    res.writeHead(200, { 'content-type': 'application/json' });",
    "    res.end(JSON.stringify({ ok: true, data: { status: 'ok' } }));",
    "    return;",
    "  }",
    "  res.writeHead(404, { 'content-type': 'application/json' });",
    "  res.end(JSON.stringify({ ok: false }));",
    "});",
    "server.listen(port, '127.0.0.1');",
    "const shutdown = () => server.close(() => process.exit(0));",
    "process.on('SIGTERM', shutdown);",
    "process.on('SIGINT', shutdown);"
  ].join("\n"),
  "utf8"
);

writeFileSync(
  managedServerPath,
  [
    "const http = require('node:http');",
    "const port = Number(process.argv[2] || 0);",
    "if (!port) throw new Error('missing managed server port');",
    "const server = http.createServer((req, res) => {",
    "  if (req.url === '/api/health') {",
    "    res.writeHead(200, { 'content-type': 'application/json' });",
    "    res.end(JSON.stringify({ ok: true, data: { status: 'ok' } }));",
    "    return;",
    "  }",
    "  res.writeHead(404, { 'content-type': 'application/json' });",
    "  res.end(JSON.stringify({ ok: false }));",
    "});",
    "server.listen(port, '127.0.0.1');",
    "setTimeout(() => server.close(() => process.exit(0)), 15000);",
    "process.on('SIGTERM', () => server.close(() => process.exit(0)));",
    "process.on('SIGINT', () => server.close(() => process.exit(0)));"
  ].join("\n"),
  "utf8"
);

writeFileSync(
  managedScriptPath,
  [
    "const { mkdirSync, writeFileSync } = require('node:fs');",
    "const { join, resolve } = require('node:path');",
    "const { fork } = require('node:child_process');",
    "const args = process.argv.slice(2);",
    "const command = args[0];",
    "const dataDir = resolve(process.env.NEXTCLAW_HOME || '.');",
    "const configPath = join(dataDir, 'config.json');",
    "const serverScriptPath = process.env.MANAGED_TEST_SERVER_SCRIPT;",
    "mkdirSync(dataDir, { recursive: true });",
    "if (command === 'init') {",
    "  process.exit(0);",
    "}",
    "if (command !== 'start') throw new Error('expected start command');",
    "const port = Number(process.env.MANAGED_TEST_PORT || 0);",
    "if (!port) throw new Error('missing managed test port');",
    "if (!serverScriptPath) throw new Error('missing MANAGED_TEST_SERVER_SCRIPT');",
    "writeFileSync(configPath, JSON.stringify({ ui: { host: '0.0.0.0', port } }, null, 2));",
    "const child = fork(serverScriptPath, [String(port)], { detached: true, stdio: 'ignore' });",
    "child.unref();",
    "process.exit(0);"
  ].join("\n"),
  "utf8"
);

const logs = [];
const logger = {
  info: (message) => logs.push(message),
  warn: (message) => logs.push(message),
  error: (message) => logs.push(message)
};

const runtime = new RuntimeServiceProcess({
  logger,
  scriptPath: embeddedScriptPath,
  startupTimeoutMs: 8_000
});

try {
  const { baseUrl } = await runtime.start();
  const response = await fetch(`${baseUrl}/api/health`);
  assert(response.ok, "health endpoint must be available");
  const payload = await response.json();
  assert(payload?.ok === true, "health payload must include ok=true");

  const managedHome = join(workspace, "managed-home");
  const managedPort = await pickFreePort();
  const previousHome = process.env.NEXTCLAW_HOME;
  const previousManagedPort = process.env.MANAGED_TEST_PORT;
  const previousManagedServerScript = process.env.MANAGED_TEST_SERVER_SCRIPT;
  mkdirSync(managedHome, { recursive: true });
  process.env.NEXTCLAW_HOME = managedHome;
  process.env.MANAGED_TEST_PORT = String(managedPort);
  process.env.MANAGED_TEST_SERVER_SCRIPT = managedServerPath;

  try {
    const managedRuntime = new RuntimeServiceProcess({
      logger,
      scriptPath: managedScriptPath,
      mode: "managed-service",
      startupTimeoutMs: 8_000
    });
    const managedResult = await managedRuntime.start();
    assert(existsSync(join(managedHome, "config.json")), "managed-service must write config.json");
    assert(
      managedResult.baseUrl === `http://127.0.0.1:${managedPort}`,
      `managed-service must resolve loopback UI url, got ${managedResult.baseUrl}`
    );
    assert(managedResult.port === managedPort, "managed-service must preserve service port");
  } finally {
    if (previousHome === undefined) {
      delete process.env.NEXTCLAW_HOME;
    } else {
      process.env.NEXTCLAW_HOME = previousHome;
    }
    if (previousManagedPort === undefined) {
      delete process.env.MANAGED_TEST_PORT;
    } else {
      process.env.MANAGED_TEST_PORT = previousManagedPort;
    }
    if (previousManagedServerScript === undefined) {
      delete process.env.MANAGED_TEST_SERVER_SCRIPT;
    } else {
      process.env.MANAGED_TEST_SERVER_SCRIPT = previousManagedServerScript;
    }
  }

  await runtime.stop();
  console.log("desktop runtime smoke passed");
} finally {
  await runtime.stop();
  rmSync(workspace, { recursive: true, force: true });
}

async function pickFreePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate free port.")));
        return;
      }
      const port = address.port;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}
