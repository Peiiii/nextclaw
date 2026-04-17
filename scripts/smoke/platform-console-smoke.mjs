#!/usr/bin/env node
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = (process.env.PLATFORM_CONSOLE_BASE_URL ?? "http://127.0.0.1:4173").replace(/\/+$/, "");

function okEnvelope(data) {
  return JSON.stringify({ ok: true, data });
}

async function fulfillJson(route, data) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: okEnvelope(data)
  });
}

function createDashboardFixtures() {
  return {
    accountUser: {
      id: "user-1",
      email: "user@example.com",
      role: "user",
      username: null
    },
    activeInstances: [
      {
        id: "inst-1",
        instanceInstallId: "install-1",
        displayName: "MacBook Pro",
        appVersion: "0.13.99",
        platform: "macOS",
        status: "online",
        lastSeenAt: "2026-03-23T09:00:00.000Z",
        archivedAt: null,
        createdAt: "2026-03-23T08:00:00.000Z",
        updatedAt: "2026-03-23T09:00:00.000Z"
      }
    ],
    archivedInstances: []
  };
}

async function installDashboardRoutes(page, fixtures) {
  await page.route("**/platform/auth/me", async (route) => {
    await fulfillJson(route, {
      user: fixtures.accountUser
    });
  });

  await page.route("**/platform/auth/profile", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    fixtures.accountUser.username = body.username;
    await fulfillJson(route, {
      token: "demo-token-2",
      user: fixtures.accountUser
    });
  });

  await page.route("**/platform/remote/instances**", async (route) => {
    const url = new URL(route.request().url());
    const includeArchived = url.searchParams.get("includeArchived") === "true";
    await fulfillJson(route, {
      items: includeArchived ? [...fixtures.activeInstances, ...fixtures.archivedInstances] : fixtures.activeInstances
    });
  });

  await page.route("**/platform/remote/instances/inst-1/archive", async (route) => {
    const archived = {
      ...fixtures.activeInstances[0],
      archivedAt: "2026-03-23T10:00:00.000Z",
      updatedAt: "2026-03-23T10:00:00.000Z"
    };
    fixtures.activeInstances.splice(0, 1);
    fixtures.archivedInstances.splice(0, fixtures.archivedInstances.length, archived);
    await fulfillJson(route, { instance: archived });
  });

  await page.route("**/platform/remote/instances/inst-1/unarchive", async (route) => {
    const restored = {
      ...fixtures.archivedInstances[0],
      archivedAt: null,
      updatedAt: "2026-03-23T10:05:00.000Z"
    };
    fixtures.archivedInstances.splice(0, 1);
    fixtures.activeInstances.splice(0, fixtures.activeInstances.length, restored);
    await fulfillJson(route, { instance: restored });
  });

  await page.route("**/platform/remote/instances/inst-1/delete", async (route) => {
    fixtures.archivedInstances.splice(0, 1);
    await fulfillJson(route, { deleted: true, instanceId: "inst-1" });
  });

  await page.route("**/platform/remote/quota", async (route) => {
    await fulfillJson(route, {
      dayKey: "2026-03-25",
      resetsAt: "2026-03-26T00:00:00.000Z",
      sessionRequestsPerMinute: 180,
      instanceConnectionsPerInstance: 10000,
      activeBrowserConnections: 2,
      workerRequests: {
        limit: 20000,
        used: 12,
        remaining: 19988
      },
      durableObjectRequests: {
        limit: 20000,
        used: 12.05,
        remaining: 19987.95
      }
    });
  });

  await page.route("**/platform/remote/instances/inst-1/shares", async (route) => {
    if (route.request().method() === "GET") {
      await fulfillJson(route, { items: [] });
      return;
    }
    await fulfillJson(route, {
      id: "grant-1",
      instanceId: "inst-1",
      status: "active",
      createdAt: "2026-03-23T09:00:00.000Z",
      expiresAt: "2026-03-24T09:00:00.000Z",
      shareUrl: "https://r-demo.claw.cool",
      activeSessionCount: 0
    });
  });

  await page.route("**/platform/remote/instances/inst-1/open", async (route) => {
    await fulfillJson(route, {
      id: "session-1",
      instanceId: "inst-1",
      status: "active",
      sourceType: "owner_open",
      sourceGrantId: null,
      expiresAt: "2026-03-23T10:00:00.000Z",
      lastUsedAt: "2026-03-23T09:00:00.000Z",
      revokedAt: null,
      createdAt: "2026-03-23T09:00:00.000Z",
      openUrl: "https://r-session-1.claw.cool/platform/remote/open?token=token-1",
      fixedDomainOpenUrl: "https://remote.claw.cool/platform/remote/open?token=token-1"
    });
  });
}

async function initializeDashboardPage(page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("nextclaw.platform.token", "demo-token");
    window.__openedUrls = [];
    window.open = (url) => {
      window.__openedUrls.push(String(url));
      return null;
    };
  });
}

async function assertDashboardLanding(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const bodyText = await page.locator("body").innerText();
  const requiredText = [
    "Set your username before publishing personal skills",
    "My Instances",
    "Remote Quota & Usage",
    "Open via fixed domain",
    "Daily Worker requests",
    "COMING SOON",
    "https://platform.nextclaw.io/account"
  ];
  for (const expected of requiredText) {
    if (!bodyText.includes(expected)) {
      throw new Error(`Dashboard is missing expected text: ${expected}`);
    }
  }
  if (bodyText.includes("Recharge") || bodyText.includes("Ledger")) {
    throw new Error("Dashboard still exposes billing details that should stay hidden.");
  }
}

async function assertAccountSettingsFlow(page) {
  await page.goto(`${baseUrl}/account`, { waitUntil: "networkidle" });
  const accountText = await page.locator("body").innerText();
  if (!accountText.includes("You are on the exact account settings page")) {
    throw new Error("/account did not render the dedicated account guidance.");
  }
  await page.getByPlaceholder("For example: alice-dev").fill("alice-dev");
  await page.getByRole("button", { name: "Save Username" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("@alice-dev/*"));
  const readyText = await page.locator("body").innerText();
  if (!readyText.includes("Personal publishing is unlocked")) {
    throw new Error("/account did not confirm that personal publishing is ready.");
  }
}

async function assertRemoteOpenActions(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open in browser" }).click();
  await page.waitForFunction(() => Array.isArray(window.__openedUrls) && window.__openedUrls.length >= 1);
  const openedSubdomainUrl = await page.evaluate(() => window.__openedUrls[0]);
  if (openedSubdomainUrl !== "https://r-session-1.claw.cool/platform/remote/open?token=token-1") {
    throw new Error(`Subdomain open action used unexpected URL: ${openedSubdomainUrl}`);
  }
  await page.getByRole("button", { name: "Open via fixed domain" }).click();
  await page.waitForFunction(() => Array.isArray(window.__openedUrls) && window.__openedUrls.length >= 2);
  const openedFixedDomainUrl = await page.evaluate(() => window.__openedUrls[1]);
  if (openedFixedDomainUrl !== "https://remote.claw.cool/platform/remote/open?token=token-1") {
    throw new Error(`Fixed-domain open action used unexpected URL: ${openedFixedDomainUrl}`);
  }
}

function acceptNextDialog(page) {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
}

async function assertArchiveLifecycle(page) {
  acceptNextDialog(page);
  await page.getByRole("button", { name: "Archive" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Archived instances"));
  await page.waitForFunction(() => document.body.innerText.includes("Restore"));
  await page.waitForFunction(() => document.body.innerText.includes("Delete"));
  const archivedText = await page.locator("body").innerText();
  if (!archivedText.includes("Archived instances")) {
    throw new Error("Dashboard did not render the archived instances section after archiving.");
  }
  await page.getByRole("button", { name: "Restore" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Instance restored to the main list."));
  acceptNextDialog(page);
  await page.getByRole("button", { name: "Archive" }).click();
  await page.waitForTimeout(300);
  acceptNextDialog(page);
  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Archived instance deleted permanently."));
}

async function assertDashboardLocaleSwitch(page) {
  await page.getByRole("button", { name: "中文" }).click();
  await page.waitForTimeout(300);
  const zhText = await page.locator("body").innerText();
  const requiredText = ["我的实例", "个人发布已经解锁", "Remote 额度与用量", "即将上线"];
  for (const expected of requiredText) {
    if (!zhText.includes(expected)) {
      throw new Error(`Dashboard did not switch expected text to Chinese: ${expected}`);
    }
  }
}

async function assertDashboardFlow(browser) {
  const page = await browser.newPage({ locale: "en-US" });
  const fixtures = createDashboardFixtures();
  await installDashboardRoutes(page, fixtures);
  await initializeDashboardPage(page);
  await assertDashboardLanding(page);
  await assertAccountSettingsFlow(page);
  await assertRemoteOpenActions(page);
  await assertArchiveLifecycle(page);
  await assertDashboardLocaleSwitch(page);
  await page.close();
}

async function assertLoginFlow(browser) {
  const page = await browser.newPage({ locale: "en-US" });

  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const loginEn = await page.locator("body").innerText();

  if (!loginEn.includes("Sign in to NextClaw Web and continue your instances and agent workflows.")) {
    throw new Error("Login page did not render the default English hero copy.");
  }

  await page.getByRole("button", { name: "中文" }).click();
  await page.waitForTimeout(300);

  const loginZh = await page.locator("body").innerText();
  if (!loginZh.includes("登录 NextClaw Web，继续你的实例与 Agent 工作流。")) {
    throw new Error("Login page did not switch to Chinese.");
  }

  await page.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await assertDashboardFlow(browser);
    await assertLoginFlow(browser);
    console.log(`[platform-console-smoke] passed for ${baseUrl}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[platform-console-smoke] failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
