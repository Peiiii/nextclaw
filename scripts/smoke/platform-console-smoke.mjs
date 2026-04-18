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
    archivedInstances: [],
    ownerSkills: [
      {
        id: "skill-1",
        slug: "stock-briefing",
        packageName: "@peiiii/stock-briefing",
        ownerScope: "peiiii",
        skillName: "stock-briefing",
        name: "Stock Briefing",
        summary: "Daily market briefing skill for investors.",
        summaryI18n: {
          en: "Daily market briefing skill for investors.",
          zh: "给投资者的每日市场简报 skill。"
        },
        description: "Summarize watchlist moves, catalysts, and next checks.",
        descriptionI18n: {
          en: "Summarize watchlist moves, catalysts, and next checks.",
          zh: "总结自选股波动、催化因素和下一步检查项。"
        },
        author: "peiiii",
        tags: ["market", "briefing"],
        publishStatus: "published",
        publishedByType: "user",
        ownerVisibility: "public",
        reviewNote: "Looks good.",
        reviewedAt: "2026-03-23T08:30:00.000Z",
        publishedAt: "2026-03-23T08:00:00.000Z",
        updatedAt: "2026-03-23T09:00:00.000Z",
        sourceRepo: "https://github.com/nextclaw/stock-briefing",
        homepage: "https://platform.nextclaw.io/skills/stock-briefing",
        install: {
          kind: "marketplace",
          spec: "@peiiii/stock-briefing",
          command: "nextclaw skills install @peiiii/stock-briefing"
        },
        canShow: false,
        canHide: true,
        canDelete: true,
        ownerDeletedAt: null
      }
    ]
  };
}

function toOwnerSkillSummary(skill) {
  return {
    id: skill.id,
    slug: skill.slug,
    packageName: skill.packageName,
    ownerScope: skill.ownerScope,
    skillName: skill.skillName,
    name: skill.name,
    summary: skill.summary,
    author: skill.author,
    tags: skill.tags,
    publishStatus: skill.publishStatus,
    publishedByType: skill.publishedByType,
    ownerVisibility: skill.ownerVisibility,
    reviewNote: skill.reviewNote,
    reviewedAt: skill.reviewedAt,
    publishedAt: skill.publishedAt,
    updatedAt: skill.updatedAt
  };
}

function toOwnerSkillDetail(skill) {
  return {
    ...toOwnerSkillSummary(skill),
    summaryI18n: skill.summaryI18n,
    description: skill.description,
    descriptionI18n: skill.descriptionI18n,
    sourceRepo: skill.sourceRepo,
    homepage: skill.homepage,
    install: skill.install,
    canShow: !skill.ownerDeletedAt && skill.ownerVisibility === "hidden",
    canHide: !skill.ownerDeletedAt && skill.ownerVisibility === "public",
    canDelete: !skill.ownerDeletedAt
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
  await installRemoteRoutes(page, fixtures);
  await installOwnerSkillRoutes(page, fixtures);
}

async function installRemoteRoutes(page, fixtures) {
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

async function installOwnerSkillRoutes(page, fixtures) {
  await page.route("**/platform/marketplace/skills", async (route) => {
    const url = new URL(route.request().url());
    const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const items = fixtures.ownerSkills
      .filter((skill) => !skill.ownerDeletedAt)
      .filter((skill) => {
        if (!query) {
          return true;
        }
        return [skill.name, skill.packageName, skill.summary]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .map((skill) => toOwnerSkillSummary(skill));

    await fulfillJson(route, {
      total: items.length,
      items
    });
  });
  await page.route("**/platform/marketplace/skills/*/manage", async (route) => {
    const selector = readMarketplaceSkillSelector(route.request().url()).replace(/\/manage$/, "");
    const body = JSON.parse(route.request().postData() ?? "{}");
    const skill = fixtures.ownerSkills.find((entry) => entry.packageName === selector || entry.slug === selector);
    if (!skill) {
      await fulfillNotFound(route);
      return;
    }

    if (body.action === "hide") {
      skill.ownerVisibility = "hidden";
    } else if (body.action === "show") {
      skill.ownerVisibility = "public";
    } else if (body.action === "delete") {
      skill.ownerDeletedAt = "2026-03-23T09:30:00.000Z";
    }
    skill.updatedAt = "2026-03-23T09:30:00.000Z";

    await fulfillJson(route, {
      item: toOwnerSkillDetail(skill)
    });
  });
  await page.route("**/platform/marketplace/skills/*", async (route) => {
    const selector = readMarketplaceSkillSelector(route.request().url());
    const skill = fixtures.ownerSkills.find(
      (entry) => !entry.ownerDeletedAt && (entry.packageName === selector || entry.slug === selector)
    );
    if (!skill) {
      await fulfillNotFound(route);
      return;
    }

    await fulfillJson(route, toOwnerSkillDetail(skill));
  });
}

function readMarketplaceSkillSelector(url) {
  return decodeURIComponent(url.split("/platform/marketplace/skills/")[1]);
}
async function fulfillNotFound(route) {
  await route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({
      ok: false,
      error: {
        message: "Marketplace skill not found."
      }
    })
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
    "NEXTCLAW WORKBENCH",
    "My Instances",
    "PUBLISH READINESS",
    "Remote Quota & Usage",
    "Open via fixed domain",
    "Daily Worker requests",
    "COMING SOON",
    "Account"
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
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__spaNavGuard = "alive";
  });
  await page.getByRole("link", { name: "Account" }).click();
  await page.waitForURL(`${baseUrl}/account`);
  const spaNavGuard = await page.evaluate(() => window.__spaNavGuard);
  if (spaNavGuard !== "alive") {
    throw new Error("Sidebar navigation triggered a full page reload instead of SPA routing.");
  }
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

async function assertSkillManagementFlow(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__spaNavGuard = "alive";
  });
  await page.getByRole("link", { name: "My Skills" }).click();
  await page.waitForURL(`${baseUrl}/skills`);
  const spaNavGuard = await page.evaluate(() => window.__spaNavGuard);
  if (spaNavGuard !== "alive") {
    throw new Error("Skills sidebar navigation triggered a full page reload instead of SPA routing.");
  }

  await page.waitForFunction(() => document.body.innerText.includes("Stock Briefing"));
  await page.getByRole("button", { name: "Hide" }).waitFor();

  await page.getByRole("button", { name: "Hide" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Hidden"));
  const hiddenText = await page.locator("body").innerText();
  if (!hiddenText.includes("Make visible")) {
    throw new Error("Skill detail did not expose the show action after hiding the skill.");
  }

  await page.getByRole("button", { name: "Make visible" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Visible"));
  const shownText = await page.locator("body").innerText();
  if (!shownText.includes("Hide")) {
    throw new Error("Skill detail did not restore the hide action after showing the skill.");
  }

  acceptNextDialog(page);
  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("No skills under your scope yet."));
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
  const requiredText = ["我的实例", "发布准备状态", "Remote 额度与用量", "即将上线"];
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
  await assertSkillManagementFlow(page);
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
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
