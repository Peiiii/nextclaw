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
  await page.route("**/platform/admin/remote/quota", async (route) => {
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

async function assertConsoleShell(browser) {
  const page = await browser.newPage();
  const fixtures = PLATFORM_ADMIN_SMOKE_FIXTURES;
  await installRoutes(page, fixtures);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("nextclaw.platform.token", "demo-admin-token");
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });

  const homeText = await page.locator("body").innerText();
  const homeExpected = [
    "平台治理控制台",
    "总览",
    "Marketplace 审核",
    "用户与额度",
    "充值审核",
    "平台治理总览",
    "营收与上游治理"
  ];
  for (const value of homeExpected) {
    if (!homeText.includes(value)) {
      throw new Error(`控制台首页缺少预期文案: ${value}`);
    }
  }

  await page.getByRole("link", { name: /Marketplace 审核/ }).first().click();
  await page.waitForFunction(() => document.body.innerText.includes("skill 上架治理入口"));
  await page.getByRole("button", { name: /Stock Briefing/ }).click();
  await page.waitForFunction(() => document.body.innerText.includes("@peiiii/stock-briefing"));

  await page.getByRole("link", { name: /用户与额度/ }).first().click();
  await page.waitForFunction(() => document.body.innerText.includes("用户额度管理"));

  await page.getByRole("link", { name: /充值审核/ }).first().click();
  await page.waitForFunction(() => document.body.innerText.includes("充值审核"));
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
