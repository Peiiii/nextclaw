#!/usr/bin/env node
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const appRoot = process.cwd();
const productionBaseUrl = "https://clawboard.nextclaw.io";
const skipLocalServer = process.env.COMPETITIVE_LEADERBOARD_SKIP_LOCAL_SERVER === "1";
const baseUrl = (
  process.env.COMPETITIVE_LEADERBOARD_BASE_URL ?? (skipLocalServer ? productionBaseUrl : "http://127.0.0.1:3194")
).replace(/\/+$/, "");
const distIndexPath = resolve(appRoot, "dist/client/index.html");
const serverPort = Number.parseInt(new URL(baseUrl).port || "3194", 10);

if (!skipLocalServer && !existsSync(distIndexPath)) {
  console.error("Smoke test requires a built client. Run `pnpm -C apps/competitive-leaderboard build` first.");
  process.exit(1);
}

let serverLogs = "";
const serverProcess = skipLocalServer
  ? null
  : spawn("pnpm", ["run", "start"], {
      cwd: appRoot,
      env: {
        ...process.env,
        COMPETITIVE_LEADERBOARD_PORT: `${serverPort}`
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

serverProcess?.stdout.on("data", (chunk) => {
  serverLogs += chunk.toString();
});
serverProcess?.stderr.on("data", (chunk) => {
  serverLogs += chunk.toString();
});

const stopServer = () => {
  if (serverProcess && !serverProcess.killed) {
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
      height: 1200
    }
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await expectText(page, "ClawBoard：龙虾类产品研究榜单");
  await expectText(page, "先画全市场，再谈总榜");
  await expectText(page, "只对真正同类的 core 层做统一总榜");
  await expectText(page, "并把公共信号和能力覆盖拆开给你看");
  await expectText(page, "Derivative / Watch");

  const profileCards = page.locator(".profile-card");
  if ((await profileCards.count()) < 20) {
    throw new Error("Expected at least 20 product profile cards in the universe.");
  }

  await page.getByRole("button", { name: "看证据" }).first().click();
  await expectText(page, "纳入判断");
  await expectText(page, "能力矩阵");
  await expectText(page, "公共信号拆解");

  await browser.close();
  stopServer();
} catch (error) {
  stopServer();
  console.error(serverLogs.trim());
  throw error;
}

async function waitForHealth() {
  if (skipLocalServer) {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Remote smoke health check failed at ${baseUrl}/health.`);
    }
    return;
  }

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

  throw new Error(`Competitive leaderboard did not become healthy within 30 seconds at ${baseUrl}.`);
}

async function expectText(page, text) {
  await page.waitForFunction(
    (expectedText) => document.body.innerText.includes(expectedText),
    text,
    { timeout: 20_000 }
  );
}
