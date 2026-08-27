import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { resolveRepoPath } from "../../shared/repo-paths.mjs";
import {
  agentsPayload,
  channelSpecs,
  configPayload,
  providerSpecs,
  providerTemplatesPayload,
  providersPayload,
  schemaPayload,
} from "../product-screenshot-config-mocks.mjs";
import {
  authStatusPayload,
  bootstrapStatusPayload,
  remoteStatusPayload,
  runtimeControlPayload,
  runtimeUpdatePayload,
} from "../product-screenshot-status-mocks.mjs";
import { createScreenshotRouteMockResolver } from "../product-screenshot-route-mocks.utils.mjs";
import { initializeScreenshotDocument, installScreenshotApiRoutes } from "../product-screenshot-browser-helpers.mjs";

const repoRoot = resolveRepoPath(import.meta.url);
const uiOrigin = String(process.env.SCREENSHOT_UI_ORIGIN || "http://127.0.0.1:5174").replace(/\/$/, "");
const panelTitle = "悬臂梁载荷评估";
const sessionId = "interactive-engineering-demo";
const panelId = "ZW5naW5lZXJpbmctbG9hZC1wbGFubmVyLnBhbmVsLmh0bWw";
const panelAppId = "engineering-load-planner";
const viewport = { width: 1512, height: 828 };
const panelPath = path.join(repoRoot, "fixtures/product-screenshots/interactive-engineering/panels/engineering-load-planner.panel.html");
const panelHtml = await readFile(panelPath, "utf8");

const now = "2026-07-07T02:00:00.000Z";
const panelEntry = {
  id: panelId,
  appId: panelAppId,
  fileName: "engineering-load-planner.panel.html",
  kind: "single-file",
  title: panelTitle,
  description: "可在会话中直接调整参数的工程计算示例",
  contentPath: `/api/panel-apps/${panelId}/content`,
  createdAt: now,
  updatedAt: now,
  sizeBytes: Buffer.byteLength(panelHtml),
  favorite: false,
  clientDeclared: false,
  clientGranted: true,
  lastOpenedAt: now,
  openCount: 1,
};

const sessionMessages = {
  sessionId,
  status: "idle",
  total: 2,
  pageInfo: { startCursor: null, hasPreviousPage: false },
  messages: [
    {
      id: "engineering-demo-user",
      sessionId,
      role: "user",
      status: "final",
      timestamp: now,
      parts: [{
        type: "text",
        text: "帮我做一个悬臂梁的快速载荷评估。我想在对话里直接调载荷、长度和安全系数，马上看到挠度、应力和是否可用。",
      }],
    },
    {
      id: "engineering-demo-assistant",
      sessionId,
      role: "assistant",
      status: "final",
      timestamp: now,
      parts: [{
        type: "text",
        text: `我把参数和计算结果放进这条回复里了。直接拖动控件，曲线、读数和结论会同步更新；需要更大空间时可以展开继续用。\n\n\`\`\`nextclaw-inline\n${JSON.stringify({
          target: { type: "panel_app", payload: { appId: panelAppId } },
          title: panelTitle,
          description: "在这条消息里直接调整工程参数",
        })}\n\`\`\``,
      }],
    },
  ],
};

const localPanels = {
  workspaceSessionId: sessionId,
  panelListView: { workspacePath: repoRoot, panelsPath: path.dirname(panelPath), entries: [panelEntry] },
  sessionList: {
    sessions: [{
      sessionId,
      agentId: "main",
      status: "idle",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      messageCount: 2,
      workingDir: repoRoot,
      metadata: {
        label: panelTitle,
        project_root: repoRoot,
        preferred_model: "GPT-5.1",
        last_activity_preview: { state: "completed", timestamp: now, replyText: "已生成可在会话内直接操作的悬臂梁载荷评估工具。" },
      },
    }],
    total: 1,
  },
  sessionMessages,
  findPanelContent: (id) => id === panelId ? panelHtml : null,
  findPanelAsset: () => null,
  readServerPath: () => null,
  browseServerPath: () => null,
  readServerContent: () => null,
};

const staticGetMocks = new Map([
  ["/api/auth/status", authStatusPayload],
  ["/api/remote/status", remoteStatusPayload],
  ["/api/runtime/bootstrap-status", bootstrapStatusPayload],
  ["/api/runtime/control", runtimeControlPayload],
  ["/api/runtime/update", runtimeUpdatePayload],
  ["/api/config", configPayload],
  ["/api/config/meta", { providers: providerSpecs, channels: channelSpecs }],
  ["/api/providers", providersPayload],
  ["/api/provider-templates", providerTemplatesPayload],
  ["/api/config/schema", schemaPayload],
  ["/api/agents", agentsPayload],
  ["/api/sessions", { sessions: [], total: 0 }],
  ["/api/chat/capabilities", { stopSupported: true }],
  ["/api/chat/runs", { runs: [], total: 0 }],
]);

const resolveMock = createScreenshotRouteMockResolver({
  localPanels,
  marketplaceSkills: [],
  resolveSceneMock: () => null,
  staticGetMocks,
});

async function writeBuffer(targetPath, buffer) {
  const absolutePath = path.join(repoRoot, targetPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
}

async function waitForPanel(page) {
  await page.waitForFunction(() => Boolean(document.querySelector("textarea, [contenteditable=true]")), undefined, { timeout: 20_000 });
  const frame = page.locator(`iframe[title="${panelTitle}"]`).last();
  await frame.waitFor({ state: "visible", timeout: 20_000 });
  await frame.evaluate((element) => element.closest("[data-message-id], article")?.scrollIntoView({ block: "center" }));
  await page.frameLocator(`iframe[title="${panelTitle}"]`).locator("#load").waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(800);
}

async function pressRange(page, locator, count) {
  await locator.click();
  for (let index = 0; index < count; index += 1) {
    await locator.press("ArrowRight");
    await page.waitForTimeout(115);
  }
}

async function recordInteraction(page) {
  const app = page.frameLocator(`iframe[title="${panelTitle}"]`);
  await page.waitForTimeout(650);
  await pressRange(page, app.locator("#load"), 8);
  await page.waitForTimeout(600);
  await pressRange(page, app.locator("#length"), 7);
  await page.waitForTimeout(600);
  await pressRange(page, app.locator("#factor"), 5);
  await page.waitForTimeout(900);
}

async function main() {
  const response = await fetch(uiOrigin);
  if (!response.ok) {
    throw new Error(`UI is unavailable: ${uiOrigin} (${response.status})`);
  }
  const videoDirectory = await mkdtemp(path.join(tmpdir(), "nextclaw-engineering-demo-"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: "light", recordVideo: { dir: videoDirectory, size: viewport } });
  try {
    await context.addInitScript(initializeScreenshotDocument, { key: "nextclaw.ui.language", value: "zh", useMockRealtime: true });
    await context.addInitScript(() => globalThis.localStorage.setItem("nextclaw.ui.theme", "cool"));
    const page = await context.newPage();
    const video = page.video();
    await installScreenshotApiRoutes(page, { resolveMock: (pathname, searchParams, method) => resolveMock(pathname, searchParams, method, "inline-engineering-zh"), resolveRealMarketplace: async () => null, useMockApi: true, useRealMarketplace: false });
    await page.goto(`${uiOrigin}/chat/${sessionId}`, { waitUntil: "domcontentloaded" });
    await waitForPanel(page);
    await recordInteraction(page);
    await writeBuffer("images/screenshots/nextclaw-inline-engineering-20260827-cn.png", await page.screenshot({ type: "png" }));
    await context.close();
    const videoBuffer = await readFile(await video.path());
    await Promise.all([
      writeBuffer("images/marketing/nextclaw-inline-engineering-20260827-demo.webm", videoBuffer),
      writeBuffer("apps/landing/public/nextclaw-inline-engineering-20260827-demo.webm", videoBuffer),
    ]);
  } finally {
    await context.close().catch(() => undefined);
    await browser.close();
    await rm(videoDirectory, { recursive: true, force: true });
  }
}

await main();
