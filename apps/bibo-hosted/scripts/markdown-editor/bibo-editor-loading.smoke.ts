import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, type Page, type Route } from "playwright";
import { mockApi, openMarkdownSource } from "../personal-workspace.fixture";

const port = String(30000 + process.pid % 20000);
const base = process.env.BIBO_SMOKE_BASE ?? `http://127.0.0.1:${port}`;
const server = process.env.BIBO_SMOKE_BASE ? null : spawn(process.execPath, [new URL("../../node_modules/vite/bin/vite.js", import.meta.url).pathname, "preview", "--host", "127.0.0.1", "--port", port, "--strictPort"], { cwd: new URL("../..", import.meta.url).pathname, stdio: ["ignore", "pipe", "pipe"] });
if (server) await new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Editor preview did not start")), 20000);
  server.stdout.on("data", data => { if (String(data).includes(base)) { clearTimeout(timeout); resolve(); } });
  server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Editor preview exited with ${code}`)); });
});
const browser = await chromium.launch();
const draft = "# 加载恢复草稿\n\n未保存内容必须保留。";

async function checkFailureRecovery(page: Page, pattern: string, intercept: (route: Route) => Promise<void>): Promise<void> {
  await page.getByRole("alert").getByText("编辑器未能加载，请检查网络连接后重试。", { exact: true }).waitFor();
  assert.equal(await page.getByText("页面不存在", { exact: true }).count(), 0);
  await page.unroute(pattern, intercept);
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), page.getByRole("button", { name: "重新加载页面", exact: true }).click()]);
  await page.locator(".tiptap:visible h1").getByText("加载恢复草稿", { exact: true }).waitFor();
}

async function checkSlowRecovery(page: Page, mode: "rich" | "source", width: number, release: () => void): Promise<void> {
  await page.getByText("正在打开编辑器…", { exact: true }).waitFor();
  await page.clock.fastForward(13_000);
  await page.getByText("编辑器加载较慢，请检查网络连接。", { exact: true }).waitFor();
  await page.getByRole("button", { name: "重新加载页面", exact: true }).waitFor();
  const button = await page.getByRole("button", { name: "重新加载页面", exact: true }).boundingBox();
  if (width <= 760) assert.ok(button && button.width >= 44 && button.height >= 44, "loading recovery keeps a usable touch target");
  await page.screenshot({ path: `/tmp/bibo-editor-slow-${mode}-${width}.png` });
  release();
  if (mode === "rich") await page.locator(".tiptap:visible h1").getByText("加载恢复草稿", { exact: true }).waitFor();
  else await page.locator(".cm-content:visible").getByText("# 加载恢复草稿", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "重新加载页面", exact: true }).count(), 0, "late successful module replaces the slow-loading feedback");
}

async function checkLoading(page: Page, mode: "rich" | "source", failure: boolean, width: number): Promise<void> {
  await mockApi(page);
  await page.addInitScript(content => {
    if (!sessionStorage.getItem("bibo-file-drafts:smoke")) sessionStorage.setItem("bibo-file-drafts:smoke", JSON.stringify({ "file-a": { content, version: 1 } }));
  }, draft);
  const writes: string[] = [];
  page.on("request", request => {
    if (request.url().endsWith("/api/space") && request.postDataJSON().action === "file.update") writes.push(request.postData()!);
  });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pattern = `**/assets/${mode === "rich" ? "rich" : "source"}-markdown-editor-*.js`;
  const intercept = async (route: Route): Promise<void> => {
    if (failure) return route.abort("failed");
    await gate; await route.continue();
  };
  await page.route(pattern, intercept);
  try {
    if (mode === "rich") await page.clock.install();
    await page.goto(`${base}/notes/file-a`, { waitUntil: "domcontentloaded" });
    if (mode === "source") {
      await page.locator(".tiptap:visible h1").getByText("加载恢复草稿", { exact: true }).waitFor();
      await page.clock.install();
      await openMarkdownSource(page);
    }
    if (failure) await checkFailureRecovery(page, pattern, intercept);
    else await checkSlowRecovery(page, mode, width, release);
    assert.deepEqual(writes, [], "loading recovery never saves or overwrites a draft");
    assert.equal(new URL(page.url()).pathname, "/notes/file-a");
    console.log(`Editor ${mode} ${failure ? "failure/reload" : "slow/eventual success"} ${width}: draft retained and route preserved`);
  } finally { release(); await page.unroute(pattern, intercept); }
}

async function checkScenario(width: number, mode: "rich" | "source", failure: boolean): Promise<void> {
  const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width <= 760 });
  page.setDefaultTimeout(15000);
  try { await checkLoading(page, mode, failure, width); }
  catch (error) { await page.screenshot({ path: `/tmp/bibo-editor-loading-failed-${mode}-${width}.png` }); throw error; }
  finally { await page.close(); }
}

try {
  for (const width of [1440, 390]) for (const [mode, failure] of [["rich", false], ["rich", true], ["source", false], ["source", true]] as const) await checkScenario(width, mode, failure);
} finally {
  await browser.close();
  if (server && server.exitCode === null) { const stopped = once(server, "exit"); server.kill("SIGTERM"); await stopped; }
}
