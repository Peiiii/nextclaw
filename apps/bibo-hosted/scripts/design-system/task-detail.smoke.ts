import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright";
import { mockApi } from "../personal-workspace.fixture";

const port = String(30000 + process.pid % 20000);
const base = process.env.BIBO_SMOKE_BASE ?? `http://127.0.0.1:${port}`;
const server = process.env.BIBO_SMOKE_BASE ? null : spawn("pnpm", ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", port, "--strictPort"], {
  cwd: new URL("../..", import.meta.url).pathname, stdio: "ignore",
});
const title = "搭建「Codex 高效开发方法」个人网站";
const description = "## 为什么做这个网站\n\n1. 沉淀层：把日常开发经验整理成可复用的方法，方便自己持续迭代。\n2. 传播层：对外输出，作为个人影响力内容源，可延伸做自媒体。\n3. 求职层：作为能力证明的公开作品，面试可直接展示。\n\n关联想法笔记：想法/Codex 高效开发网站.md";
const steps = ["收集素材：把现有 Codex 经验、prompt 模式、踩坑记录汇成素材库", "梳理体系：把素材归类为可复用的方法论模块", "确定网站形态与技术方案（博客 / 手册 / 案例集）", "产出首批 3-5 篇内容（从被问最多的问题切入）", "上线最小可用版本并对外分享"];

async function ready() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base)).ok) return; } catch { /* Preview starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Task preview unavailable");
}

async function checkTask(page: Page, width: number) {
  await mockApi(page);
  await page.goto(`${base}/tasks`, { waitUntil: "networkidle" });
  await page.evaluate(async ({ title, description, steps }) => {
    await fetch("/api/space", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: "task.update", input: { id: "task-a", title, description, priority: "high", status: "planned", projectId: null,
        subtasks: steps.map((title, index) => ({ id: `step-${index}`, title, done: false })) },
    }) });
  }, { title, description, steps });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".bibo-task-row").filter({ hasText: title }).click();
  const dialog = page.getByRole("dialog", { name: "任务详情", exact: true });
  await dialog.getByRole("heading", { name: title }).waitFor();
  assert.equal(await dialog.getByRole("textbox").count(), 0, "reading opens without form fields");
  assert.equal(await dialog.getByRole("checkbox").count(), 5);
  assert.equal(await dialog.getByText(/关联想法笔记/).isVisible(), true);
  assert.equal(await dialog.evaluate((element) => element === document.activeElement), true);
  assert.equal(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
  await page.screenshot({ path: `/tmp/bibo-task-redesign-${width}.png`, animations: "disabled" });
  await checkRichEditing(page, width);
  await checkDraftRecovery(page);
}

async function checkRichEditing(page: Page, width: number) {
  const dialog = page.getByRole("dialog", { name: "任务详情", exact: true });
  await dialog.getByRole("button", { name: "编辑任务", exact: true }).click();
  const editor = dialog.getByRole("textbox", { name: "说明", exact: true });
  await editor.waitFor();
  assert.equal(await editor.getAttribute("contenteditable"), "true", "task uses the rich editor");
  await page.screenshot({ path: `/tmp/bibo-task-editing-${width}.png`, animations: "disabled" });
  await dialog.getByRole("button", { name: "编辑任务属性" }).click();
  await page.getByRole("combobox", { name: "优先级", exact: true }).selectOption("low");
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), true, "closing properties retains the task drawer");
  await editor.fill("最后一笔也必须保存");
  const saved = page.waitForResponse((response) => response.url().endsWith("/api/space") && response.request().postDataJSON()?.action === "task.update");
  await dialog.getByRole("button", { name: "保存任务", exact: true }).click();
  const response = await saved;
  assert.match(response.request().postDataJSON().input.description, /最后一笔也必须保存/);
  assert.equal(response.request().postDataJSON().input.priority, "low");
  await dialog.getByText("最后一笔也必须保存", { exact: true }).waitFor();
  assert.equal(await dialog.getByRole("button", { name: "编辑任务", exact: true }).isVisible(), true);
  await dialog.getByRole("checkbox").first().click();
  await page.waitForFunction(() => document.querySelector<HTMLInputElement>(".task-detail-step input")?.checked);
}

async function checkDraftRecovery(page: Page) {
  const dialog = page.getByRole("dialog", { name: "任务详情", exact: true });
  const editor = dialog.getByRole("textbox", { name: "说明", exact: true });
  await dialog.getByRole("button", { name: "编辑任务", exact: true }).click();
  await editor.fill("保存失败后仍保留的草稿");
  await page.route("**/api/space", (route) => route.request().postDataJSON()?.action === "task.update"
    ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "测试保存失败" }) }) : route.fallback(), { times: 1 });
  await dialog.getByRole("button", { name: "保存任务", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  assert.match(await editor.innerText(), /保存失败后仍保留的草稿/);
  await dialog.getByRole("button", { name: "关闭任务详情" }).click();
  await page.locator(".bibo-task-row").filter({ hasText: title }).click();
  await editor.waitFor();
  assert.match(await editor.innerText(), /保存失败后仍保留的草稿/);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await dialog.getByText("最后一笔也必须保存", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "更多任务操作" }).click();
  await page.getByRole("menuitem", { name: "删除任务" }).click();
  await page.getByRole("dialog", { name: "删除任务？", exact: true }).getByRole("button", { name: "取消", exact: true }).last().click();
  assert.equal(await dialog.isVisible(), true);
  await dialog.getByRole("button", { name: "关闭任务详情" }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".bibo-task-row").filter({ hasText: title }).click();
  await dialog.getByText("最后一笔也必须保存", { exact: true }).waitFor();
  assert.equal(await dialog.getByRole("checkbox").first().isChecked(), true);
}

await ready();
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 });
    await checkTask(page, width);
    await page.close();
  }
  console.log("Task detail: desktop/mobile reading, rich editing, immediate save, failure, drafts, checklist and reload passed.");
} finally { await browser.close(); server?.kill("SIGTERM"); }
