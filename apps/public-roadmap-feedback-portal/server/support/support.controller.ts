import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import type { SupportWorkflowOperation, SupportOperation, SupportSubmission } from "../../shared/support-feedback.types.js";
import type { PortalWorkerEnv } from "../portal-env.types.js";
import { SupportAuthService } from "./support-auth.service.js";
import { SupportRepository } from "./support.repository.js";
import { SupportService } from "./support.service.js";
import { SupportWorkflowService } from "./support-workflow.service.js";
import { object, reject } from "./support-validation.utils.js";
import { administratorActor, discussionParticipantActor } from "../discussion/discussion.controller.js";

export const supportController = new Hono<{ Bindings: PortalWorkerEnv }>();
supportController.use("*", bodyLimit({ maxSize: 16000 }));
supportController.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store"); c.header("Referrer-Policy", "no-referrer");
  await next();
});
supportController.onError((error, c) => {
  const status = error instanceof HTTPException ? error.status : error instanceof SyntaxError ? 400 : 503;
  if (status === 429) c.header("Retry-After", "3600");
  return c.json({ ok: false, error: { message: error instanceof HTTPException ? error.message : error instanceof SyntaxError ? "请求格式不正确。" : "反馈服务暂时不可用，请保留草稿后重试。" } }, status);
});
function repository(env: PortalWorkerEnv) {
  if (!env.PUBLIC_ROADMAP_PORTAL_DB) reject(503, "反馈存储尚未启用，请保留草稿。");
  return new SupportRepository(env.PUBLIC_ROADMAP_PORTAL_DB);
}
async function requireAdministrator(c: Context<{ Bindings: PortalWorkerEnv }>) {
  await new SupportAuthService(c.env).administrator(c.req.header("authorization") ?? "");
}
supportController.get("/review", async (c) => {
  await requireAdministrator(c);
  const page = Number(c.req.query("page") ?? 1), pageSize = Number(c.req.query("pageSize") ?? 10);
  if (!Number.isInteger(page) || page < 1 || ![10, 20].includes(pageSize)) reject(400, "分页参数不正确。");
  return c.json({ ok: true, data: { ...await repository(c.env).reviewList(c.req.query("bucket") ?? "review",
    (c.req.query("q") ?? "").slice(0, 100), page, pageSize), maxAuthority: c.env.SUPPORT_MAX_AUTHORITY ?? "analyze" } });
});
supportController.post("/review/:id", async (c) => {
  await requireAdministrator(c);
  const body = object(await c.req.json());
  const input = body as unknown as SupportWorkflowOperation;
  if (input.action !== "review") reject(400, "请提交评审决定。");
  return c.json({ ok: true, data: await new SupportWorkflowService(repository(c.env), c.env).operate(c.req.param("id"), input, administratorActor(body)) });
});
supportController.post("/", async (c) => {
  const userId = await new SupportAuthService(c.env).user(c.req.header("authorization") ?? "");
  const input = object(await c.req.json()) as unknown as SupportSubmission;
  const report = await new SupportService(repository(c.env)).submit(input, userId, c.req.header("cf-connecting-ip") ?? "local");
  return c.json({ ok: true, data: report }, 201);
});
supportController.get("/", async (c) => {
  const user = await new SupportAuthService(c.env).user(c.req.header("authorization") ?? "");
  if (!user) reject(401, "账号暂未验证，请凭回执查看反馈。");
  return c.json({ ok: true, data: await repository(c.env).list(user, c.req.query("cursor") ?? "", "", false) });
});
supportController.get("/workflow", async (c) => {
  await new SupportAuthService(c.env).participant(c.req.header("authorization") ?? "");
  const status = c.req.query("status") ?? "";
  return c.json({ ok: true, data: { ...await repository(c.env).list(null, c.req.query("cursor") ?? "", status, true),
    paused: c.env.SUPPORT_PAUSED === "true", maxAuthority: c.env.SUPPORT_MAX_AUTHORITY ?? "analyze" } });
});
supportController.get("/workflow/:id", async (c) => {
  await new SupportAuthService(c.env).participant(c.req.header("authorization") ?? "");
  const value = await repository(c.env).get(c.req.param("id"));
  if (!value) reject(404, "反馈不存在。");
  return c.json({ ok: true, data: value.report });
});
supportController.post("/workflow/:id", async (c) => {
  await new SupportAuthService(c.env).participant(c.req.header("authorization") ?? "");
  const input = object(await c.req.json()) as unknown as SupportWorkflowOperation;
  return c.json({ ok: true, data: await new SupportWorkflowService(repository(c.env), c.env).operate(c.req.param("id"), input, discussionParticipantActor) });
});
supportController.get("/:id", async (c) => {
  const user = await new SupportAuthService(c.env).user(c.req.header("authorization") ?? "");
  const value = await new SupportService(repository(c.env)).access(c.req.param("id"), c.req.header("x-feedback-receipt") ?? "", user);
  return c.json({ ok: true, data: value.report });
});
supportController.post("/:id", async (c) => {
  const service = new SupportService(repository(c.env));
  const user = await new SupportAuthService(c.env).user(c.req.header("authorization") ?? "");
  const value = await service.access(c.req.param("id"), c.req.header("x-feedback-receipt") ?? "", user);
  const input = object(await c.req.json()) as unknown as SupportOperation;
  return c.json({ ok: true, data: await service.operate(value, input, user) });
});
