#!/usr/bin/env node
import process from "node:process";
import { chromium } from "playwright";
import { PLATFORM_ADMIN_SMOKE_FIXTURES } from "./platform-admin-smoke-fixtures.mjs";

const baseUrl = (process.env.PLATFORM_ADMIN_BASE_URL ?? "http://127.0.0.1:4177").replace(/\/+$/, "");

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

async function installRoutes(page, fixtures) {
  await page.route("**/platform/auth/me", async (route) => {
    await fulfillJson(route, { user: fixtures.user });
  });
  await page.route("**/platform/admin/overview", async (route) => {
    await fulfillJson(route, fixtures.overview);
  });
  await page.route("**/platform/admin/remote/quota/v2", async (route) => {
    await fulfillJson(route, fixtures.remoteQuota);
  });
  await page.route("**/platform/admin/profit/overview**", async (route) => {
    await fulfillJson(route, fixtures.profit);
  });
  await page.route("**/platform/admin/providers", async (route) => {
    await fulfillJson(route, fixtures.providers);
  });
  await page.route("**/platform/admin/models", async (route) => {
    await fulfillJson(route, fixtures.models);
  });
  await page.route("**/platform/admin/marketplace/skills?**", async (route) => {
    await fulfillJson(route, fixtures.marketplaceList);
  });
  await page.route("**/platform/admin/marketplace/skills/%40peiiii%2Fstock-briefing", async (route) => {
    await fulfillJson(route, fixtures.marketplaceDetail);
  });
  await page.route("**/platform/admin/users?**", async (route) => {
    await fulfillJson(route, fixtures.usersPage);
  });
  await page.route("**/platform/admin/recharge-intents?**", async (route) => {
    await fulfillJson(route, fixtures.rechargePage);
  });
  await page.route("**/platform/admin/settings", async (route) => {
    await fulfillJson(route, { globalFreeLimitUsd: 220 });
  });
  await page.route("**/platform/admin/users/*", async (route) => {
    await fulfillJson(route, {
      changed: true,
      user: fixtures.usersPage.items[0]
    });
  });
  await page.route("**/platform/admin/recharge-intents/*/confirm", async (route) => {
    await fulfillJson(route, { intentId: "intent-1" });
  });
  await page.route("**/platform/admin/recharge-intents/*/reject", async (route) => {
    await fulfillJson(route, { intentId: "intent-1" });
  });
  await page.route("**/platform/admin/marketplace/skills/*/review", async (route) => {
    await fulfillJson(route, {
      item: fixtures.marketplaceDetail.item
    });
  });
}

async function assertLoginPage(browser) {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const bodyText = await page.locator("body").innerText();
  const expected = ["登录管理后台", "仅管理员账号可进入本网站", "登录管理后台"];
  for (const value of expected) {
    if (!bodyText.includes(value)) {
      throw new Error(`登录页缺少预期文案: ${value}`);
    }
  }
  await page.close();
}

async function assertAdminUsersPage(page) {
  await page.getByRole("link", { name: /用户与额度/ }).first().click();
  await page.waitForFunction(() => document.body.innerText.includes("用户列表"));
  await page.waitForFunction(() => document.body.innerText.includes("浏览、筛选和排序保持轻量"));
  await page.waitForFunction(() => document.body.innerText.includes("1–1 / 共 1 位用户"));
  await page.waitForFunction(() => document.body.innerText.includes("注册时间"));
  await page.waitForFunction(() => document.body.innerText.includes("alice@example.com"));

  const searchRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith("/platform/admin/users") && url.searchParams.get("q") === "alice";
  });
  await page.getByPlaceholder("搜索邮箱、用户名或用户 ID").fill("alice");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await searchRequest;

  const roleRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith("/platform/admin/users") && url.searchParams.get("role") === "user";
  });
  await page.getByRole("button", { name: "普通用户 1", exact: true }).click();
  await roleRequest;

  const sortRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith("/platform/admin/users")
      && url.searchParams.get("sortBy") === "email"
      && url.searchParams.get("sortDirection") === "asc";
  });
  await page.getByRole("button", { name: "账号", exact: true }).click();
  await sortRequest;

  await page.getByRole("button", { name: "管理额度", exact: true }).click();
  await page.getByRole("dialog", { name: "管理用户额度" }).waitFor();
  await page.getByText("正数增加余额，负数扣减余额；保存前请核对金额。", { exact: true }).waitFor();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  if (await page.getByRole("dialog", { name: "管理用户额度" }).count()) {
    throw new Error("取消额度编辑后弹窗仍然存在");
  }

  await assertAdminMobileLayout(page);
}

async function assertAdminMobileLayout(page) {
  const mobileWidth = Number(process.env.PLATFORM_MOBILE_WIDTH ?? 390);
  await page.setViewportSize({ width: mobileWidth, height: 844 });
  const mobileCard = page.getByTestId("admin-user-mobile-card");
  await mobileCard.waitFor();

  const mobileLayout = await page.evaluate(() => {
    const scrollRegion = document.querySelector('[data-testid="admin-scroll-region"]');
    const mobileList = document.querySelector('[data-testid="admin-mobile-list"]');
    const desktopTable = document.querySelector("table");
    const header = document.querySelector('[data-testid="admin-mobile-header"]');
    const navigation = document.querySelector('[data-testid="admin-mobile-navigation"]');
    const firstCard = document.querySelector('[data-testid="admin-user-mobile-card"]');
    if (!(scrollRegion instanceof HTMLElement) || !(mobileList instanceof HTMLElement) || !(desktopTable instanceof HTMLElement) || !(header instanceof HTMLElement) || !(navigation instanceof HTMLElement) || !(firstCard instanceof HTMLElement)) {
      throw new Error("Mobile admin layout is missing its shell, navigation, list, card, or desktop table.");
    }
    const headerBounds = header.getBoundingClientRect();
    const navigationBounds = navigation.getBoundingClientRect();
    const scrollBounds = scrollRegion.getBoundingClientRect();
    const firstCardBounds = firstCard.getBoundingClientRect();
    const nestedScrollOwners = [...document.querySelectorAll("*")]
      .filter((element) => element instanceof HTMLElement && element !== scrollRegion && element.offsetParent !== null)
      .filter((element) => {
        const overflowY = window.getComputedStyle(element).overflowY;
        return (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight + 1;
      })
      .map((element) => element.getAttribute("data-testid") ?? element.tagName.toLowerCase());
    scrollRegion.scrollTop = scrollRegion.scrollHeight;
    const distanceFromBottom = scrollRegion.scrollHeight - scrollRegion.clientHeight - scrollRegion.scrollTop;
    scrollRegion.scrollTop = 0;
    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      scrollClientHeight: scrollRegion.clientHeight,
      scrollHeight: scrollRegion.scrollHeight,
      scrolledTo: scrollRegion.scrollTop,
      distanceFromBottom,
      headerHeight: headerBounds.height,
      navigationHeight: navigationBounds.height,
      firstCardTop: firstCardBounds.top,
      firstCardBottom: firstCardBounds.bottom,
      scrollRegionBottom: scrollBounds.bottom,
      nestedScrollOwners,
      mobileListDisplay: window.getComputedStyle(mobileList).display,
      desktopTableDisplay: window.getComputedStyle(desktopTable.closest("div")).display,
      navigationClientWidth: navigation.clientWidth,
      navigationScrollWidth: navigation.scrollWidth
    };
  });
  if (process.env.PLATFORM_ADMIN_MOBILE_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.PLATFORM_ADMIN_MOBILE_SCREENSHOT_PATH });
  }
  if (mobileLayout.documentScrollWidth > mobileLayout.documentClientWidth || mobileLayout.bodyScrollWidth > mobileLayout.documentClientWidth) {
    throw new Error(`Mobile admin has horizontal page overflow: ${JSON.stringify(mobileLayout)}`);
  }
  if (mobileLayout.distanceFromBottom > 2) {
    throw new Error(`Mobile admin content is not vertically reachable: ${JSON.stringify(mobileLayout)}`);
  }
  if (mobileLayout.mobileListDisplay === "none" || mobileLayout.desktopTableDisplay !== "none") {
    throw new Error(`Mobile admin did not switch from desktop table to task cards: ${JSON.stringify(mobileLayout)}`);
  }
  if (mobileLayout.documentScrollHeight > mobileLayout.viewportHeight + 1 || mobileLayout.nestedScrollOwners.length > 0) {
    throw new Error(`Mobile admin has more than one primary scroll surface: ${JSON.stringify(mobileLayout)}`);
  }
  if (mobileLayout.headerHeight > 56 || mobileLayout.navigationHeight > 64 || mobileLayout.navigationScrollWidth > mobileLayout.navigationClientWidth) {
    throw new Error(`Mobile admin chrome is oversized or horizontally scrollable: ${JSON.stringify(mobileLayout)}`);
  }
  if (mobileLayout.firstCardTop > 260 || mobileLayout.firstCardBottom > mobileLayout.scrollRegionBottom) {
    throw new Error(`Mobile admin does not show the first complete task card in the initial viewport: ${JSON.stringify(mobileLayout)}`);
  }
  await mobileCard.getByRole("button", { name: "管理额度", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "管理用户额度" });
  await dialog.waitFor();
  const dialogBounds = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
  });
  if (dialogBounds.top < 0 || dialogBounds.left < 0 || dialogBounds.right > mobileWidth || dialogBounds.bottom > 844) {
    throw new Error(`Mobile quota dialog escapes the viewport: ${JSON.stringify(dialogBounds)}`);
  }
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function assertConsoleShell(browser) {
  const page = await browser.newPage();
  const fixtures = PLATFORM_ADMIN_SMOKE_FIXTURES;
  await installRoutes(page, fixtures);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("nextclaw.platform.token", "demo-admin-token");
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });

  const faviconHref = await page.locator('link[rel="icon"]').getAttribute("href");
  if (faviconHref !== "/logo.svg") {
    throw new Error(`管理后台 favicon 地址异常: ${faviconHref ?? "missing"}`);
  }
  const faviconResponse = await page.request.get(`${baseUrl}/logo.svg`);
  if (!faviconResponse.ok()) {
    throw new Error(`管理后台 favicon 加载失败: HTTP ${faviconResponse.status()}`);
  }

  const homeText = await page.locator("body").innerText();
  const homeExpected = [
    "Platform Admin",
    "总览",
    "Marketplace 审核",
    "用户与额度",
    "充值审核",
    "PLATFORM GOVERNANCE",
    "平台治理入口与关键运行状态",
    "营收与上游治理",
    "Cloudflare 套餐档案",
    "仅观察，不限制正常使用"
  ];
  for (const value of homeExpected) {
    if (!homeText.includes(value)) {
      throw new Error(`控制台首页缺少预期文案: ${value}`);
    }
  }

  await page.getByRole("link", { name: /Marketplace 审核/ }).first().click();
  await page.waitForFunction(() => document.body.innerText.includes("审核队列"));
  await page.getByRole("button", { name: /Stock Briefing/ }).click();
  await page.waitForFunction(() => document.body.innerText.includes("@peiiii/stock-briefing"));

  await assertAdminUsersPage(page);

  await page.getByRole("link", { name: /充值审核/ }).first().click();
  await page.waitForFunction(() => document.body.innerText.includes("充值审核表"));
  await page.waitForFunction(() => document.body.innerText.includes("user-1"));
  await page.waitForFunction(() => document.body.innerText.includes("20.0000"));

  await page.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await assertLoginPage(browser);
    await assertConsoleShell(browser);
    console.log(`platform-admin smoke ok: ${baseUrl}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
