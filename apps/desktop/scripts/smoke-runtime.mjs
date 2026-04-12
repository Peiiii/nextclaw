#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
const runtimeHome = join(workspace, "runtime-home");

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

const logs = [];
const logger = {
  info: (message) => logs.push(message),
  warn: (message) => logs.push(message),
  error: (message) => logs.push(message)
};

const runtime = new RuntimeServiceProcess({
  logger,
  scriptPath: embeddedScriptPath,
  runtimeEnv: {
    ...process.env,
    NEXTCLAW_HOME: runtimeHome
  },
  startupTimeoutMs: 8_000
});

try {
  const { baseUrl } = await runtime.start();
  const response = await fetch(`${baseUrl}/api/health`);
  assert(response.ok, "health endpoint must be available");
  const payload = await response.json();
  assert(payload?.ok === true, "health payload must include ok=true");

  await runtime.stop();
  console.log("desktop runtime smoke passed");
} finally {
  await runtime.stop();
  rmSync(workspace, { recursive: true, force: true });
}
