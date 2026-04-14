#!/usr/bin/env node
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const appRoot = process.cwd();
const skipLocalServer = process.env.PUBLIC_ROADMAP_FEEDBACK_PORTAL_SKIP_LOCAL_SERVER === "1";
const baseUrl = (
  process.env.PUBLIC_ROADMAP_FEEDBACK_PORTAL_BASE_URL
  ?? (skipLocalServer ? "https://example.invalid" : "http://127.0.0.1:3196")
).replace(/\/+$/, "");
const distIndexPath = resolve(appRoot, "dist/client/index.html");
const serverPort = Number.parseInt(new URL(baseUrl).port || "3196", 10);

if (!skipLocalServer && !existsSync(distIndexPath)) {
  console.error("Smoke test requires a built client. Run `pnpm -C apps/public-roadmap-feedback-portal build` first.");
  process.exit(1);
}

let serverLogs = "";
const serverProcess = skipLocalServer
  ? null
  : spawn("pnpm", ["run", "start"], {
      cwd: appRoot,
      env: {
        ...process.env,
        PUBLIC_ROADMAP_FEEDBACK_PORTAL_PORT: `${serverPort}`
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
  await expectText(page, "公开路线图与产品进展");
  await expectText(page, "Phase 1 preview data");
  await expectText(page, "公开阶段视图");
  await expectText(page, "近期已交付");
  await expectText(page, "Building");

  await page.getByRole("button", { name: "List" }).click();
  await expectText(page, "公开路线图与反馈门户");
  await page.getByRole("button", { name: "公开路线图与反馈门户" }).click();
  await expectText(page, "路线图事项详情");
  await expectText(page, "Linear 数据源适配层");

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
      // ignore
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
  }

  throw new Error(`Portal did not become healthy within 30 seconds at ${baseUrl}.`);
}

async function expectText(page, text) {
  await page.waitForFunction(
    (expectedText) => document.body.innerText.includes(expectedText),
    text,
    { timeout: 20_000 }
  );
}
