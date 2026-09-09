import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { publicRoadmapFeedbackPortalApp as app } from "../server/portal.controller.js";
import { SupportLocalDatabaseService } from "../server/support/support-local-database.service.js";
import type { PortalWorkerEnv } from "../server/portal-env.types.js";
import type { SupportReport, SupportSubmission } from "../shared/support-feedback.types.js";

const directory = mkdtempSync(join(tmpdir(), "nextclaw-feedback-test-"));
const path = join(directory, "feedback.sqlite");
let database = new SupportLocalDatabaseService(path, new URL("../migrations/", import.meta.url));
const maintainer = crypto.randomUUID() + crypto.randomUUID();
const administrator = crypto.randomUUID() + crypto.randomUUID();
const env: PortalWorkerEnv = { PUBLIC_ROADMAP_PORTAL_DB: database, PUBLIC_ROADMAP_FEEDBACK_PORTAL_DATA_MODE: "live",
  SUPPORT_MAINTAINER_TOKEN: maintainer, SUPPORT_ADMIN_TOKEN: administrator, SUPPORT_MAX_AUTHORITY: "repair" };
const auth = createServer((req, res) => {
  const token = req.headers.authorization;
  res.writeHead(token === "Bearer valid" || token === "Bearer other" ? 200 : 401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, data: { user: { id: token === "Bearer valid" ? "account-a" : "account-b" } } }));
});
await new Promise<void>((resolve) => auth.listen(0, "127.0.0.1", resolve));
env.SUPPORT_PLATFORM_API_BASE = "http://127.0.0.1:" + (auth.address() as { port: number }).port;
after(async () => { database.close(); await new Promise<void>((resolve) => auth.close(() => resolve())); rmSync(directory, { recursive: true }); });
function submission(): SupportSubmission {
  return { requestId: crypto.randomUUID(), receiptKey: crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""),
    title: "反馈验收", description: "打开工具后返回错误，应当显示结果。", version: "0.49.0" };
}
async function request(route: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = await app.request("http://localhost/api/support" + route, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": crypto.randomUUID(), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  }, env);
  const payload = await response.json() as { data: SupportReport; error?: { message: string } };
  return { status: response.status, payload, response };
}
const maintenanceHeaders = { authorization: "Bearer " + maintainer };
const administratorHeaders = { authorization: "Bearer " + administrator };
function op(report: SupportReport, values: Record<string, unknown>) {
  return { operationId: crypto.randomUUID(), revision: report.revision, runId: report.runId, ...values };
}
async function approve(report: SupportReport, decision = "repair"): Promise<SupportReport> {
  const result = await request("/review/" + report.id, op(report, { action: "review", decision }), administratorHeaders);
  assert.equal(result.status, 200);
  return result.payload.data;
}

test("FB-01/03/04 anonymous receipt, retry, private projection, ownership", async () => {
  const input = submission();
  const first = await request("", input);
  assert.equal(first.status, 201); assert.equal(first.payload.data.identity, "anonymous");
  assert.equal((await request("", input)).payload.data.id, input.requestId);
  assert.equal((await request("", { ...input, description: "changed" })).status, 409);
  assert.equal((await request("/" + input.requestId)).status, 404);
  const own = await request("/" + input.requestId, undefined, { "x-feedback-receipt": input.receiptKey });
  assert.equal(own.payload.data.description, input.description);
  assert.equal((await request("/" + input.requestId, undefined, { authorization: "Bearer other" })).status, 404);
  const publicResponse = await app.request("http://localhost/api/feedback", {}, env);
  assert.ok(!(await publicResponse.text()).includes(input.requestId));
  const operation = { operationId: crypto.randomUUID(), action: "reply", body: "补充复现步骤", role: "maintainer" };
  const reply = await request("/" + input.requestId, operation, { "x-feedback-receipt": input.receiptKey });
  assert.equal(reply.payload.data.messages[0]!.role, "user");
  const retried = await request("/" + input.requestId, operation, { "x-feedback-receipt": input.receiptKey });
  assert.equal(retried.payload.data.messages.length, 1);
  assert.equal((await request("/" + input.requestId, { ...operation, body: "different" }, { "x-feedback-receipt": input.receiptKey })).status, 409);
});

test("FB-02/04 verified identity, expired identity, link and account listing", async () => {
  const input = submission();
  assert.equal((await request("", { ...input, userId: "account-a", identity: "verified" }, { authorization: "Bearer expired" })).payload.data.identity, "anonymous");
  const linked = await request("/" + input.requestId, { action: "link", operationId: crypto.randomUUID() },
    { authorization: "Bearer valid", "x-feedback-receipt": input.receiptKey });
  assert.equal(linked.payload.data.identity, "verified");
  assert.equal((await request("/" + input.requestId, undefined, { authorization: "Bearer valid" })).status, 200);
  assert.equal((await request("/" + input.requestId, undefined, { authorization: "Bearer other" })).status, 404);
  assert.equal((await request("", submission(), { authorization: "Bearer valid" })).payload.data.identity, "verified");
});

test("FB-06/07/08 atomic claim, stale generation, new evidence, pause and withdrawal", async () => {
  const input = submission();
  let report = (await request("", input)).payload.data;
  report = await approve(report);
  const claims = await Promise.all([1, 2].map(() => request("/maintenance/" + report.id, op(report, { action: "claim" }), maintenanceHeaders)));
  assert.deepEqual(claims.map((r) => r.status).sort(), [200, 409]);
  const claimed = claims.find((r) => r.status === 200)!.payload.data;
  const updated = await request("/" + report.id, { operationId: crypto.randomUUID(), action: "reply", body: "又出现不同错误" }, { "x-feedback-receipt": input.receiptKey });
  assert.equal(updated.payload.data.runId, null); assert.equal(updated.payload.data.inputVersion, 2);
  assert.equal((await request("/maintenance/" + report.id, op(claimed, { action: "checkpoint", status: "ready", evidence: "test" }), maintenanceHeaders)).status, 409);
  await request("/" + report.id, { operationId: crypto.randomUUID(), action: "withdraw" }, { "x-feedback-receipt": input.receiptKey });
  const current = (await request("/" + report.id, undefined, { "x-feedback-receipt": input.receiptKey })).payload.data;
  assert.equal((await request("/maintenance/" + report.id, op(current, { action: "reply", body: "should not send" }), maintenanceHeaders)).status, 409);
  env.SUPPORT_PAUSED = "true";
  assert.equal((await request("/maintenance/" + report.id, op(current, { action: "reply" }), maintenanceHeaders)).status, 409);
  env.SUPPORT_PAUSED = "false";
});

test("FB-06 persistence and pagination over 20 reports; missing maintenance credential", async () => {
  for (let i = 0; i < 25; i++) assert.equal((await request("", submission())).status, 201);
  assert.equal((await request("/maintenance")).status, 401);
  const ids = new Set<string>();
  let cursor = "";
  do {
    const result = await request("/maintenance?cursor=" + cursor, undefined, maintenanceHeaders);
    const page = result.payload.data as unknown as { items: SupportReport[]; nextCursor: string | null };
    for (const report of page.items) { assert.ok(!ids.has(report.id)); ids.add(report.id); }
    cursor = page.nextCursor ?? "";
  } while (cursor);
  assert.ok(ids.size >= 25);
  database.close();
  database = new SupportLocalDatabaseService(path, new URL("../migrations/", import.meta.url));
  env.PUBLIC_ROADMAP_PORTAL_DB = database;
  const page = (await request("/maintenance", undefined, maintenanceHeaders)).payload.data as unknown as { items: SupportReport[] };
  assert.equal(page.items.length, 20);
});

test("FB-13 rate limit, payload size and no self-granted delivery", async () => {
  let last = 0;
  for (let i = 0; i < 11; i++) last = (await request("", submission(), { "cf-connecting-ip": "same-source" })).status;
  assert.equal(last, 429);
  assert.equal((await request("", { ...submission(), description: "x".repeat(20000) })).status, 413);
  const report = (await request("", submission())).payload.data;
  assert.equal((await request("/maintenance/" + report.id, op(report, { action: "triage", kind: "bug", priority: 0, authority: "deliver" }), maintenanceHeaders)).status, 403);
  assert.equal((await request("/maintenance/" + report.id, op(report, { action: "publish", release: { version: "1.0.0" } }), maintenanceHeaders)).status, 403);
});

test("FB-15 administrator approval is separate from AI authority and bound to current input", async () => {
  const input = submission();
  let report = (await request("", input)).payload.data;
  const path = "/maintenance/" + report.id;
  assert.equal((await request(path, op(report, { action: "claim" }), maintenanceHeaders)).status, 403);
  assert.equal((await request(path, op(report, { action: "review", decision: "repair" }), maintenanceHeaders)).status, 403);
  assert.equal((await request("/review/" + report.id, op(report, { action: "review", decision: "repair" }), maintenanceHeaders)).status, 403);
  assert.equal((await request("/review")).status, 403);
  report = await approve(report);
  assert.equal(report.approval?.inputVersion, report.inputVersion);
  const claim = await request(path, op(report, { action: "claim" }), maintenanceHeaders);
  assert.equal(claim.status, 200);
  report = claim.payload.data;
  const revoked = await request("/review/" + report.id, op(report, { action: "review", decision: "revoke" }), administratorHeaders);
  assert.equal(revoked.status, 200); assert.equal(revoked.payload.data.approval, null);
  assert.equal((await request(path, op(report, { action: "checkpoint", status: "ready", evidence: "stale" }), maintenanceHeaders)).status, 409);
  report = await approve(revoked.payload.data);
  report = (await request("/" + report.id, { action: "reply", operationId: crypto.randomUUID(), body: "新的复现条件" }, { "x-feedback-receipt": input.receiptKey })).payload.data;
  assert.equal(report.approval, null);
  assert.equal((await request(path, op(report, { action: "claim" }), maintenanceHeaders)).status, 403);
});

test("FB-16 review inbox filters and searches all pages, with stable ordering", async () => {
  const prefix = "review-inbox-" + crypto.randomUUID();
  const reports: SupportReport[] = [];
  for (let index = 0; index < 13; index++) {
    reports.push((await request("", { ...submission(), title: prefix + "-" + index })).payload.data);
  }
  await approve(reports[0]!);
  const page = async (query: string) => (await request("/review?q=" + prefix + query, undefined, administratorHeaders)).payload.data as unknown as { items: SupportReport[]; total: number; page: number };
  const first = await page("&bucket=review&page=1&pageSize=10");
  const second = await page("&bucket=review&page=2&pageSize=10");
  assert.equal(first.total, 12); assert.equal(first.items.length, 10); assert.equal(second.items.length, 2);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 12);
  assert.equal((await page("&bucket=working")).items[0]!.id, reports[0]!.id);
  assert.equal((await page("&bucket=review&page=999")).page, 2);
  const search = await request("/review?bucket=all&q=" + reports[12]!.id, undefined, administratorHeaders);
  assert.equal((search.payload.data as unknown as { total: number }).total, 1);
  assert.equal((await request("/review?bucket=invalid", undefined, administratorHeaders)).status, 400);
});

test("FB-15 public portal cannot mint administrator sessions", async () => {
  assert.equal((await request("/review/session", {}, { origin: "http://localhost" })).status, 403);
  for (const origin of ["https://attacker.invalid", "http://localhost"]) {
    const response = await app.request("http://127.0.0.1:3197/api/support/review/session", { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{}" }, env);
    assert.equal(response.status, 403);
  }
  const response = await app.request("http://127.0.0.1:3197/api/support/review/session", { method: "POST", headers: { origin: "http://127.0.0.1:3197", "content-type": "application/json" }, body: "{}" }, env);
  assert.equal(response.status, 403); assert.equal(response.headers.get("set-cookie"), null);
});

test("FB-06/08 interrupted runs require recovery and only two repair attempts", async () => {
  let report = (await request("", submission())).payload.data;
  const act = async (values: Record<string, unknown>) => request("/maintenance/" + report.id, op(report, values), maintenanceHeaders);
  for (let attempt = 0; attempt < 2; attempt++) {
    report = await approve(report);
    env.SUPPORT_MAX_AUTHORITY = "analyze";
    assert.equal((await act({ action: "claim" })).status, 403);
    env.SUPPORT_MAX_AUTHORITY = "repair";
    report = (await act({ action: "claim" })).payload.data;
    assert.equal(report.attempts, attempt + 1);
    assert.equal((await act({ action: "claim" })).status, 409);
    report = (await act({ action: "recover", evidence: "本地验收：确认旧执行已停止，保存已有产物" })).payload.data;
    assert.equal(report.status, "needs-decision"); assert.equal(report.runId, null);
  }
  report = await approve(report);
  assert.equal((await act({ action: "claim" })).status, 409);
});

test("FB-11/12 publication reply is atomic and retryable; user failure reopens original report", async () => {
  const input = submission();
  let report = (await request("", input)).payload.data;
  const act = async (values: Record<string, unknown>) => request("/maintenance/" + report.id, op(report, values), maintenanceHeaders);
  report = await approve(report);
  report = (await act({ action: "claim" })).payload.data;
  report = (await act({ action: "checkpoint", status: "ready", evidence: "本地定向测试通过" })).payload.data;
  env.SUPPORT_MAX_AUTHORITY = "deliver"; env.SUPPORT_GITHUB_REPOSITORY = "test/repository";
  report = await approve(report, "deliver");
  const sha = "a".repeat(40);
  report = (await act({ action: "authorize-delivery", fixedCommit: sha })).payload.data;
  const originalFetch = globalThis.fetch;
  let successful = false;
  globalThis.fetch = (async (url: Parameters<typeof fetch>[0]) => {
    const path = String(url);
    if (path.includes("/compare/")) return Response.json({ status: "identical" });
    if (path.includes("/artifacts")) return Response.json({ artifacts: [{ name: `feedback-release-1.0.0-${sha}-npm`, expired: false }] });
    if (path.includes("/actions/runs/")) return Response.json({ status: "completed", conclusion: successful ? "success" : "failure", path: ".github/workflows/release.yml", head_branch: "master" });
    if (path.includes("/commits/")) return Response.json({ sha });
    if (path.includes("registry.npmjs.org")) return Response.json({ version: "1.0.0" });
    return Response.json({ draft: false, prerelease: false });
  }) as typeof fetch;
  try {
    const operation = op(report, { action: "publish", body: "已发布 1.0.0 到 NPM。", release: { sha, version: "1.0.0", runId: "123", channel: "npm" } });
    assert.equal((await request("/maintenance/" + report.id, operation, maintenanceHeaders)).status, 409);
    successful = true;
    const published = await request("/maintenance/" + report.id, operation, maintenanceHeaders);
    assert.equal(published.payload.data.status, "published");
    const retry = await request("/maintenance/" + report.id, operation, maintenanceHeaders);
    assert.equal(retry.payload.data.messages.length, 1);
    const reopened = await request("/" + report.id, { operationId: crypto.randomUUID(), action: "reply", body: "更新后仍失败" }, { "x-feedback-receipt": input.receiptKey });
    assert.equal(reopened.payload.data.id, input.requestId); assert.equal(reopened.payload.data.status, "received");
    assert.equal(reopened.payload.data.release?.version, "1.0.0"); assert.equal(reopened.payload.data.fixedCommit, undefined);
  } finally { globalThis.fetch = originalFetch; env.SUPPORT_MAX_AUTHORITY = "repair"; }
});
