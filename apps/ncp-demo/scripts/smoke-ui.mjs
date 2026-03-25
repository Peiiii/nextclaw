#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createNetServer, Socket } from "node:net";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { loadNcpDemoEnv } from "./env.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const DEFAULT_BACKEND_PORT = 3297;
const DEFAULT_FRONTEND_PORT = 5281;
const PORT_SCAN_LIMIT = 20;
const backendPort = await resolveFreePort(DEFAULT_BACKEND_PORT, "127.0.0.1");
const frontendPort = await resolveFreePort(DEFAULT_FRONTEND_PORT, "127.0.0.1");
const backendBaseUrl = `http://127.0.0.1:${backendPort}`;
const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
const smokeAssetDir = mkdtempSync(`${tmpdir()}/nextclaw-ncp-smoke-`);
const smokeImagePath = resolve(smokeAssetDir, "smoke.png");
const loadedEnv = loadNcpDemoEnv(rootDir);
const baseEnv = { ...loadedEnv, ...process.env };
assertRequiredLlmEnv(baseEnv);
const browser = await chromium.launch({ headless: true });

writeFileSync(
  smokeImagePath,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function shouldUseShell(command) {
  return process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function isPortAvailable(portToCheck, host) {
  return new Promise((resolveAvailable) => {
    const server = createNetServer();
    server.unref();
    server.once("error", () => resolveAvailable(false));
    server.listen(portToCheck, host, () => {
      server.close(() => resolveAvailable(true));
    });
  });
}

function isPortOccupied(portToCheck, host) {
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
    socket.once("connect", () => finalize(true));
    socket.once("error", (error) => {
      const code = typeof error?.code === "string" ? error.code : "";
      if (code === "ECONNREFUSED" || code === "EHOSTUNREACH" || code === "ENETUNREACH") {
        finalize(false);
        return;
      }
      finalize(true);
    });

    socket.connect(portToCheck, host);
  });
}

async function resolveFreePort(startPort, host) {
  let current = startPort;
  for (let index = 0; index < PORT_SCAN_LIMIT; index += 1) {
    const occupied = await isPortOccupied(current, host);
    if (!occupied && (await isPortAvailable(current, host))) {
      return current;
    }
    current += 1;
  }
  throw new Error(`Unable to find a free port from ${startPort} (${host})`);
}

async function waitForUrl(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await sleep(250);
  }
  throw new Error(`Service did not become ready in time: ${url}`);
}

async function waitForSessionStatus(sessionId, expectedStatus) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${backendBaseUrl}/demo/sessions/${sessionId}/seed`);
      if (response.ok) {
        const payload = await response.json();
        if (payload?.status === expectedStatus) {
          return;
        }
      }
    } catch {}
    await sleep(250);
  }
  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus} in time.`);
}

async function fetchSessionSeed(sessionId) {
  const response = await fetch(`${backendBaseUrl}/demo/sessions/${sessionId}/seed`);
  if (!response.ok) {
    throw new Error(`Failed to load session seed for ${sessionId}`);
  }
  return response.json();
}

function countAssistantReplies(seed) {
  return Array.isArray(seed?.messages)
    ? seed.messages.filter((message) => message?.role === "assistant").length
    : 0;
}

async function waitForAssistantReplyMarker(sessionId, marker, baselineAssistantCount = 0) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const latestSeed = await fetchSessionSeed(sessionId);
    const assistantMessages = Array.isArray(latestSeed?.messages)
      ? latestSeed.messages.filter((message) => message?.role === "assistant")
      : [];
    const newAssistantMessages = assistantMessages.slice(baselineAssistantCount);
    const assistantReply = newAssistantMessages.find((message) =>
      Array.isArray(message.parts) &&
      message.parts.some(
        (part) =>
          part?.type === "text" &&
          typeof part.text === "string" &&
          part.text.toLowerCase().includes(marker),
      )
    );
    if (assistantReply) {
      return latestSeed;
    }
    await sleep(500);
  }

  throw new Error(`UI smoke did not observe an assistant reply containing ${marker}.`);
}

function attachPageDiagnostics(page) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(`[browser:console] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    console.error(`[browser:pageerror] ${error.message}`);
  });
}

async function createSession(page, placeholder, firstPrompt) {
  await page.goto(frontendBaseUrl, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(placeholder).waitFor();
  await page.getByPlaceholder(placeholder).fill(firstPrompt);
  await page.getByRole("button", { name: "send" }).click();
  await page.locator(".message.user", { hasText: firstPrompt }).waitFor();
  await page.locator(".session-card.active .session-card-id").waitFor();

  const sessionId = (await page.locator(".session-card.active .session-card-id").textContent())?.trim();
  if (!sessionId) {
    throw new Error("UI smoke failed to capture the created session id.");
  }
  return sessionId;
}

async function assertImageAttachmentFlow(page, placeholder, imagePrompt, sessionId) {
  await page.setInputFiles('input[type="file"]', smokeImagePath);
  await page.getByPlaceholder(placeholder).fill(imagePrompt);
  await page.getByRole("button", { name: "send" }).click();
  await page.getByRole("img", { name: "smoke.png" }).waitFor();

  const seedAfterAttachment = await fetchSessionSeed(sessionId);
  const attachmentMessage = seedAfterAttachment?.messages?.findLast?.((message) =>
    message?.role === "user" &&
    Array.isArray(message.parts) &&
    message.parts.some((part) => part?.type === "file")
  );
  if (!attachmentMessage) {
    throw new Error("UI smoke did not persist the uploaded image as an NCP file part.");
  }
  const firstReplySeed = await waitForAssistantReplyMarker(sessionId, "image-received");
  const followupAssistantCount = countAssistantReplies(firstReplySeed);
  const followupPrompt =
    "If you can still see the image from my previous message, reply exactly with image-still-visible.";

  await page.getByPlaceholder(placeholder).fill(followupPrompt);
  await page.getByRole("button", { name: "send" }).click();
  await page.locator(".message.user", { hasText: followupPrompt }).waitFor();
  await waitForAssistantReplyMarker(sessionId, "image-still-visible", followupAssistantCount);
}

async function assertSessionHydrationAfterReload(page, placeholder, sessionId, firstPrompt, longRunningPrompt) {
  await page.getByRole("button", { name: "new" }).click();
  await page.getByText("Send a message to start.").waitFor();
  await page.waitForFunction((text) => !document.body.innerText.includes(text), firstPrompt);

  await page.locator(".session-card", { hasText: sessionId }).click();
  await page.locator(".message.user", { hasText: firstPrompt }).waitFor();

  await page.getByPlaceholder(placeholder).fill(longRunningPrompt);
  await page.getByRole("button", { name: "send" }).click();
  await page.locator(".message.user", { hasText: longRunningPrompt }).waitFor();
  await page.getByRole("button", { name: "stop" }).waitFor();
  await waitForSessionStatus(sessionId, "running");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(placeholder).waitFor();
  await page.getByRole("button", { name: "stop" }).waitFor();

  await page.getByRole("button", { name: "stop" }).click();
  await waitForSessionStatus(sessionId, "idle");
}

const nodeOptions = [baseEnv.NODE_OPTIONS, "--conditions=development"]
  .filter((value) => typeof value === "string" && value.trim().length > 0)
  .join(" ");

const backend = spawn(
  pnpmBin,
  ["-C", "backend", "exec", "tsx", "--tsconfig", "tsconfig.json", "src/index.ts"],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...baseEnv,
      NODE_OPTIONS: nodeOptions,
      NCP_DEMO_PORT: String(backendPort),
    },
    shell: shouldUseShell(pnpmBin),
  },
);

const frontend = spawn(
  pnpmBin,
  [
    "-C",
    "frontend",
    "exec",
    "vite",
    "--config",
    "vite.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    String(frontendPort),
    "--strictPort",
  ],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...baseEnv,
      NODE_OPTIONS: nodeOptions,
      VITE_NCP_DEMO_API_BASE: backendBaseUrl,
    },
    shell: shouldUseShell(pnpmBin),
  },
);

async function main() {
  const context = await browser.newContext();
  const page = await context.newPage();
  const firstPrompt = "remember-alpha";
  const imagePrompt =
    "If and only if this turn includes a visible uploaded image, reply exactly with image-received.";
  const longRunningPrompt = "Call the sleep tool with durationMs 10000 right now, then reply only with done.";
  const placeholder = "Ask for the time, or ask the agent to sleep for 2 seconds.";

  try {
    attachPageDiagnostics(page);
    await waitForUrl(`${backendBaseUrl}/health`);
    await waitForUrl(frontendBaseUrl);
    const sessionId = await createSession(page, placeholder, firstPrompt);
    await assertImageAttachmentFlow(page, placeholder, imagePrompt, sessionId);
    await assertSessionHydrationAfterReload(page, placeholder, sessionId, firstPrompt, longRunningPrompt);

    console.log("[smoke-ui] ncp demo session hydration passed");
  } finally {
    await context.close();
  }
}

function assertRequiredLlmEnv(env) {
  const apiKey = typeof env.OPENAI_API_KEY === "string" ? env.OPENAI_API_KEY.trim() : "";
  const baseUrl =
    typeof env.OPENAI_BASE_URL === "string" && env.OPENAI_BASE_URL.trim()
      ? env.OPENAI_BASE_URL.trim()
      : typeof env.base_url === "string"
        ? env.base_url.trim()
        : "";

  if (!apiKey || !baseUrl) {
    throw new Error(
      "ncp-demo smoke-ui requires OPENAI_API_KEY and OPENAI_BASE_URL (or base_url). Mock mode has been removed.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    backend.kill("SIGTERM");
    frontend.kill("SIGTERM");
    await browser.close();
    rmSync(smokeAssetDir, { recursive: true, force: true });
  });
