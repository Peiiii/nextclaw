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
