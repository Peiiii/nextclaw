import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { FeedbackMaintenanceClient } from "nextclaw";
import { chromium } from "playwright";
const state = new URL("../../../.local/feedback-acceptance/", import.meta.url);
const account = JSON.parse(await readFile(new URL("platform-account.json", state), "utf8"));
const client = new FeedbackMaintenanceClient({ endpoint: "http://127.0.0.1:3197", token: (await readFile(new URL("maintainer-token", state), "utf8")).trim() });
const id = randomUUID(), receiptKey = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
const submitted = await fetch("http://127.0.0.1:3197/api/support", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ requestId: id, receiptKey, title: "验收：在原管理平台评审反馈", description: "原管理员登录→用户反馈→批准修复→执行队列；普通用户不能审批，撤销后旧执行失效。" })
});
assert.equal(submitted.status, 201);
const report = (await submitted.json()).data;
await assert.rejects(client.act(report, { action: "claim" }));
const login = async email => {
  const response = await fetch("http://127.0.0.1:8787/platform/auth/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: account.password })
  });
  assert.equal(response.status, 200);
  return (await response.json()).data.token;
};
const ordinary = await login("user@feedback.test");
for (const [path, method] of [["", "GET"], ["/" + id, "POST"]]) {
  const response = await fetch("http://127.0.0.1:8787/platform/admin/support" + path, { method, headers: { authorization: "Bearer " + ordinary } });
  assert.equal(response.status, 403);
}
assert.equal((await fetch("http://127.0.0.1:8787/platform/admin/support")).status, 401);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ locale: "zh-CN" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:5177/#/support");
  await page.getByPlaceholder("邮箱").fill(account.email);
  await page.getByPlaceholder("密码（至少 8 位）").fill(account.password);
  await page.getByRole("button", { name: "登录管理后台", exact: true }).click();
  await page.getByRole("textbox", { name: "搜索反馈标题或编号" }).fill(id);
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  const card = page.locator("article").filter({ hasText: id });
  await card.waitFor();
  assert.equal(await page.getByText("管理员访问凭证", { exact: true }).count(), 0);
  await card.getByRole("button", { name: "批准修复", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "已批准修复" }).waitFor();
  const approved = (await client.scan()).approved.find(item => item.id === id);
  assert.ok(approved);
  const claimed = await client.act(approved, { action: "claim" });
  assert.equal(claimed.status, "working");
  await page.getByRole("button", { name: "处理中", exact: true }).click();
  await card.getByText(/^处理中 · P\d$/).waitFor();
  await card.getByRole("button", { name: "撤销批准" }).click();
  await page.getByRole("status").filter({ hasText: "已撤销批准" }).waitFor();
  await page.getByRole("button", { name: "待评审", exact: true }).click();
  await card.getByText(/尚未批准执行/).waitFor();
  await assert.rejects(client.act(claimed, { action: "checkpoint", status: "ready", evidence: "stale" }));
  await page.reload();
  await card.waitFor();
  assert.equal(await page.getByPlaceholder("邮箱").count(), 0);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: new URL("platform-review.png", state).pathname, fullPage: true });
  console.log(JSON.stringify({ reportId: id, realPlatformLogin: true, ordinaryUserDenied: true, adminReviewToClaim: true, revokedRunDenied: true, sessionSurvivesReload: true }));
} finally { await browser.close(); }
