import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { checkLayoutInitialization } from "../design-system/bibo-design-system.smoke";

const origin = "https://app.bibo.bot";
const accountFile = process.env.BIBO_SMOKE_ACCOUNT_FILE ?? join(homedir(), ".config/bibo-hosted/smoke-account.json");
assert.equal(statSync(accountFile).mode & 0o077, 0, "Smoke credentials must be owner-only");
const account = JSON.parse(readFileSync(accountFile, "utf8")) as { origin: string; email: string; password: string; userId: string };
assert.equal(account.origin, origin, "Smoke credentials belong to the production Bibo origin");
const login = await fetch(`${origin}/api/auth/login`, {
  method: "POST", headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ email: account.email, password: account.password }), signal: AbortSignal.timeout(15_000),
});
assert.equal(login.status, 200, "Smoke account login must succeed");
assert.equal((await login.json() as { user: { id: string } }).user.id, account.userId, "The verified identity must match the test account");
const token = login.headers.get("set-cookie")?.match(/(?:^|;\s*)bibo_session=([^;]+)/)?.[1];
assert.ok(token, "Login must set the session cookie");
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: "bibo_session", value: decodeURIComponent(token), domain: "app.bibo.bot", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await checkLayoutInitialization(page, origin);
  assert.deepEqual(errors, [], "The real application must not report runtime errors");
  console.log(JSON.stringify({ ok: true, origin, firstPaint: true, accountRestore: true, manualMotion: true, reducedMotion: true, mobileDirectory: true }));
} finally { await browser.close(); }
