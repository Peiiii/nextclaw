#!/usr/bin/env node
import process from "node:process";
import { chromium } from "playwright";
import {
  assertArchiveLifecycle,
  assertInstanceTableFlow,
  assertInstanceTableResponsiveLayout,
  assertRemoteOpenActions,
  createRemoteInstanceFixtures,
  installRemoteInstanceRoutes
} from "./platform-console/platform-console-instance-table-smoke.utils.mjs";
import {
  assertQuotaResponsiveLayout
} from "./platform-console/platform-console-quota-smoke.utils.mjs";
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
    ...createRemoteInstanceFixtures(),
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
  await installRemoteInstanceRoutes(page, fixtures);
  await installOwnerSkillRoutes(page, fixtures);
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
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
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
    "Usage & Billing",
    "My Apps",
    "My Skills",
    "ID: inst-1",
    "Fixed domain",
    "Rows per page",
    "1–10 of 12",
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
  await page.getByRole("button", { name: "Copy instance ID: inst-1", exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes("Instance ID copied to clipboard."));
}

async function assertUsageRouteFlow(page) {
  await page.evaluate(() => {
    window.__spaNavGuard = "alive";
  });
  await page.getByRole("link", { name: "Usage & Billing" }).click();
  await page.waitForURL(`${baseUrl}/usage`);
  const spaNavGuard = await page.evaluate(() => window.__spaNavGuard);
  if (spaNavGuard !== "alive") {
    throw new Error("Usage sidebar navigation triggered a full page reload instead of SPA routing.");
  }
  await page.waitForFunction(() => document.body.innerText.includes("Daily Worker requests"));
  const usageText = await page.locator("body").innerText();
  const requiredText = [
    "Usage & Billing",
    "Remote Quota & Usage",
    "Normal use is governed by the daily allowance, with no short per-session rate limit.",
    "Daily Worker requests",
    "Recent actual usage",
    "COMING SOON"
  ];
  for (const expected of requiredText) {
    if (!usageText.includes(expected)) {
      throw new Error(`Usage page is missing expected text: ${expected}`);
    }
  }
  await assertQuotaResponsiveLayout(page);
  await page.getByRole("link", { name: "My Instances" }).click();
  await page.waitForURL(`${baseUrl}/`);
  await page.getByRole("button", { name: "Copy instance ID: inst-1", exact: true }).waitFor();
}

async function assertAccountSettingsFlow(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__spaNavGuard = "alive";
  });
  await page.getByRole("list").getByRole("link", { name: "Account", exact: true }).click();
  await page.waitForURL(`${baseUrl}/account`);
  await page.waitForFunction(() => document.body.innerText.includes("You are on the exact account settings page"));
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

function acceptNextDialog(page) {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
}

async function assertDashboardLocaleSwitch(page) {
  await page.getByRole("button", { name: "中", exact: true }).click();
  await page.waitForTimeout(300);
  const zhText = await page.locator("body").innerText();
  const requiredText = ["我的实例", "用量与充值", "我的 Apps", "我的 Skills", "账号"];
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
  await assertInstanceTableFlow(page);
  await assertInstanceTableResponsiveLayout(page);
  await assertUsageRouteFlow(page);
  await assertAccountSettingsFlow(page);
  await assertSkillManagementFlow(page);
  await assertRemoteOpenActions(page, baseUrl);
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
