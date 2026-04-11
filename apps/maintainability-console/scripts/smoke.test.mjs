#!/usr/bin/env node
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const appRoot = process.cwd();
const baseUrl = (process.env.MAINTAINABILITY_CONSOLE_BASE_URL ?? "http://127.0.0.1:3198").replace(/\/+$/, "");
const distIndexPath = resolve(appRoot, "dist/client/index.html");
const serverPort = Number.parseInt(new URL(baseUrl).port || "3198", 10);

if (!existsSync(distIndexPath)) {
  console.error("Smoke test requires a built client. Run `pnpm -C apps/maintainability-console build` first.");
  process.exit(1);
}

const serverProcess = spawn("pnpm", ["run", "start"], {
  cwd: appRoot,
  env: {
    ...process.env,
    MAINTAINABILITY_CONSOLE_PORT: `${serverPort}`
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let serverLogs = "";
serverProcess.stdout.on("data", (chunk) => {
  serverLogs += chunk.toString();
});
serverProcess.stderr.on("data", (chunk) => {
  serverLogs += chunk.toString();
});

const stopServer = () => {
  if (!serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }
};

process.on("SIGINT", stopServer);
process.on("SIGTERM", stopServer);

try {
  await waitForHealth();
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 1100
    }
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await expectText(page, "Maintainability Console");
  await expectText(page, "模块榜单");
  await expectText(page, "大文件排行");
  await expectText(page, "目录压力");
  await expectText(page, "维护性热点");

  await page.getByRole("button", { name: "Repo Volume" }).click();
  await expectText(page, "仓库体积口径");

  await page.getByRole("button", { name: "刷新数据" }).click();
  await expectText(page, "扫描中");

  await browser.close();
  stopServer();
} catch (error) {
  stopServer();
  console.error(serverLogs.trim());
  throw error;
}

async function waitForHealth() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore and retry
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
  }

  throw new Error(`Maintainability console did not become healthy within 30 seconds at ${baseUrl}.`);
}

async function expectText(page, text) {
  await page.waitForFunction(
    (expectedText) => document.body.innerText.includes(expectedText),
    text,
    { timeout: 20_000 }
  );
}
