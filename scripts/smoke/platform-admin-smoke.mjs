#!/usr/bin/env node
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = (process.env.PLATFORM_ADMIN_BASE_URL ?? "http://127.0.0.1:4174").replace(/\/+$/, "");

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

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ locale: "zh-CN" });

    await page.route("**/platform/auth/me", async (route) => {
      await fulfillJson(route, {
        user: {
          id: "admin-1",
          email: "admin@example.com",
          role: "admin"
        }
      });
    });

    await page.route("**/platform/admin/overview", async (route) => {
      await fulfillJson(route, {
        globalFreeLimitUsd: 20,
        globalFreeUsedUsd: 3.2,
        globalFreeRemainingUsd: 16.8,
        userCount: 12,
        pendingRechargeIntents: 1
      });
    });

    await page.route("**/platform/admin/remote/quota", async (route) => {
      await fulfillJson(route, {
        dayKey: "2026-03-25",
        resetsAt: "2026-03-26T00:00:00.000Z",
        reservePercent: 20,
        sessionRequestsPerMinute: 180,
        instanceConnectionsPerInstance: 10000,
        defaultUserWorkerBudget: 20000,
        defaultUserDoBudget: 20000,
        workerRequests: {
          configuredLimit: 100000,
          enforcedLimit: 80000,
          used: 1234,
          remaining: 78766
        },
        durableObjectRequests: {
          configuredLimit: 100000,
          enforcedLimit: 80000,
          used: 2048.1,
          remaining: 77951.9
        }
      });
    });

    await page.route("**/platform/admin/users**", async (route) => {
      await fulfillJson(route, {
        items: [
          {
            id: "user-1",
            email: "user@example.com",
            role: "user",
            freeLimitUsd: 20,
            freeUsedUsd: 1.2,
            freeRemainingUsd: 18.8,
            paidBalanceUsd: 5,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-25T00:00:00.000Z"
          }
        ],
        nextCursor: null,
        hasMore: false
      });
    });

    await page.route("**/platform/admin/recharge-intents**", async (route) => {
      await fulfillJson(route, {
        items: [],
        nextCursor: null,
        hasMore: false
      });
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("nextclaw.platform.token", "demo-token");
    });

    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    const bodyText = await page.locator("body").innerText();

    if (!bodyText.includes("Remote 额度总览")) {
      throw new Error("Admin dashboard did not render the remote quota overview.");
    }
    if (!bodyText.includes("平台 Worker 日预算")) {
      throw new Error("Admin dashboard did not render the worker quota card.");
    }
    if (!bodyText.includes("默认用户 Worker 日额度")) {
      throw new Error("Admin dashboard did not render the default user quota row.");
    }

    console.log(`[platform-admin-smoke] passed for ${baseUrl}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[platform-admin-smoke] failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
