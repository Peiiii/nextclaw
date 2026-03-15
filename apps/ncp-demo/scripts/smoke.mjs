#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNcpDemoEnv } from './env.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const port = 3297;
const baseUrl = `http://127.0.0.1:${port}`;
const loadedEnv = loadNcpDemoEnv(rootDir);
const baseEnv = { ...loadedEnv, ...process.env };

const server = spawn(pnpmBin, ['-C', 'backend', 'exec', 'tsx', '--tsconfig', 'tsconfig.json', 'server/index.ts'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...baseEnv,
    NODE_OPTIONS: [baseEnv.NODE_OPTIONS, '--conditions=development'].filter(Boolean).join(' '),
    NCP_DEMO_PORT: String(port),
    NCP_DEMO_LLM_MODE: 'mock'
  },
  shell: process.platform === 'win32'
});

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {}
    await sleep(250);
  }
  throw new Error('Demo server did not become healthy in time.');
}

function parseSseFrames(rawText) {
  const frames = [];
  const chunks = rawText.split('\n\n');
  for (const chunk of chunks) {
    const eventMatch = chunk.match(/^event:\s*(.+)$/m);
    const dataMatch = chunk.match(/^data:\s*(.+)$/m);
    if (!eventMatch || !dataMatch) {
      continue;
    }
    frames.push({ event: eventMatch[1], data: JSON.parse(dataMatch[1]) });
  }
  return frames;
}

async function main() {
  try {
    await waitForHealth();

    const sessionId = 'smoke-session';
    const requestBody = {
      sessionId,
      message: {
        id: 'user-smoke',
        sessionId,
        role: 'user',
        status: 'final',
        parts: [{ type: 'text', text: '现在几点？' }],
        timestamp: new Date().toISOString()
      }
    };

    const response = await fetch(`${baseUrl}/ncp/agent/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(requestBody)
    });
    const sendFrames = parseSseFrames(await response.text());
    const events = sendFrames.filter((frame) => frame.event === 'ncp-event').map((frame) => frame.data);
    const runStarted = events.find((event) => event.type === 'run.started');
    const toolResult = events.find((event) => event.type === 'message.tool-call-result');
    const finished = events.find((event) => event.type === 'run.finished');

    if (!runStarted?.payload?.runId || !toolResult || !finished) {
      throw new Error('Smoke send flow did not produce run.started/tool result/run.finished.');
    }

    const runId = runStarted.payload.runId;

    const sessions = await fetch(`${baseUrl}/demo/sessions`).then((res) => res.json());
    if (!Array.isArray(sessions) || sessions.length === 0) {
      throw new Error('Smoke sessions endpoint returned no sessions.');
    }

    const streamResponse = await fetch(`${baseUrl}/ncp/agent/stream?sessionId=${sessionId}&runId=${runId}`, {
      headers: { accept: 'text/event-stream' }
    });
    const streamFrames = parseSseFrames(await streamResponse.text());
    const streamEvents = streamFrames.filter((frame) => frame.event === 'ncp-event').map((frame) => frame.data);
    const replayFinished = streamEvents.find((event) => event.type === 'run.finished');
    if (!replayFinished) {
      throw new Error('Smoke stream flow did not finish.');
    }

    console.log('[smoke] ncp demo passed');
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  server.kill('SIGTERM');
  process.exit(1);
});
