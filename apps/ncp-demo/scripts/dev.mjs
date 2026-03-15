#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createNetServer, Socket } from 'node:net';
import { loadNcpDemoEnv } from './env.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const DEFAULT_BACKEND_PORT = 3197;
const DEFAULT_FRONTEND_PORT = 5181;
const PORT_SCAN_LIMIT = 20;

function isPortAvailable(port, host) {
  return new Promise((resolveAvailable) => {
    const server = createNetServer();
    server.unref();
    server.once('error', () => resolveAvailable(false));
    server.listen(port, host, () => {
      server.close(() => resolveAvailable(true));
    });
  });
}

function isPortOccupied(port, host) {
  return new Promise((resolveOccupied) => {
    const socket = new Socket();
    let settled = false;

    const finalize = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolveOccupied(value);
    };

    socket.setTimeout(250, () => finalize(false));
    socket.once('connect', () => finalize(true));
    socket.once('error', (error) => {
      const code = typeof error?.code === 'string' ? error.code : '';
      if (code === 'ECONNREFUSED' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
        finalize(false);
        return;
      }
      finalize(true);
    });

    socket.connect(port, host);
  });
}

async function resolveFreePort(startPort, host) {
  let current = startPort;
  for (let index = 0; index < PORT_SCAN_LIMIT; index += 1) {
    const occupied = await isPortOccupied(current, '127.0.0.1');
    if (!occupied && (await isPortAvailable(current, host))) {
      return current;
    }
    current += 1;
  }
  throw new Error(`Unable to find a free port from ${startPort} (${host})`);
}

function shouldUseShell(command) {
  return process.platform === 'win32' && command.toLowerCase().endsWith('.cmd');
}

const loadedEnv = loadNcpDemoEnv(rootDir);
const baseEnv = { ...loadedEnv, ...process.env };
const backendPort = await resolveFreePort(DEFAULT_BACKEND_PORT, '127.0.0.1');
const frontendPort = await resolveFreePort(DEFAULT_FRONTEND_PORT, '127.0.0.1');

console.log(`[ncp-demo] API: http://127.0.0.1:${backendPort}`);
console.log(`[ncp-demo] Web: http://127.0.0.1:${frontendPort}`);

const children = [];
let shuttingDown = false;
let exitCode = 0;
const nodeOptions = [baseEnv.NODE_OPTIONS, '--conditions=development']
  .filter((value) => typeof value === 'string' && value.trim().length > 0)
  .join(' ');

function spawnProcess(label, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...baseEnv, ...extraEnv },
    shell: shouldUseShell(command)
  });

  children.push(child);
  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    exitCode = typeof code === 'number' ? code : 1;
    if (signal) {
      console.error(`[ncp-demo:${label}] exited with signal ${signal}`);
    }
    for (const proc of children) {
      if (proc !== child && proc.exitCode === null && !proc.killed) {
        proc.kill('SIGTERM');
      }
    }
  });
}

spawnProcess('server', pnpmBin, ['-C', 'backend', 'exec', 'tsx', 'watch', '--tsconfig', 'tsconfig.json', 'server/index.ts'], {
  NODE_OPTIONS: nodeOptions,
  NCP_DEMO_PORT: String(backendPort)
});

spawnProcess('web', pnpmBin, ['-C', 'frontend', 'exec', 'vite', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], {
  VITE_NCP_DEMO_API_BASE: `http://127.0.0.1:${backendPort}`
});

function stopAll(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) {
      child.kill(signal);
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => stopAll(signal));
}

const waitForExit = setInterval(() => {
  const done = children.length > 0 && children.every((child) => child.exitCode !== null || child.killed);
  if (!done) {
    return;
  }
  clearInterval(waitForExit);
  process.exit(exitCode);
}, 100);
