import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { DiscussionActor, DiscussionPostCreateInput, DiscussionThreadCreateInput } from "@nextclaw/shared";
import type { PortalWorkerEnv } from "../portal-env.types.js";
import { SupportAuthService } from "../support/support-auth.service.js";
import { object, reject } from "../support/support-validation.utils.js";
import { DiscussionRepository } from "./discussion.repository.js";
import { DiscussionService } from "./discussion.service.js";

type AdminInput = { _actor?: { id?: unknown; displayName?: unknown } };

export const discussionController = new Hono<{ Bindings: PortalWorkerEnv }>();
discussionController.use("*", bodyLimit({ maxSize: 16000 }));
discussionController.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});
discussionController.onError((error, c) => {
  const status = error instanceof HTTPException ? error.status : error instanceof SyntaxError ? 400 : 503;
  return c.json({ ok: false, error: { message: error instanceof HTTPException ? error.message : error instanceof SyntaxError ? "请求格式不正确。" : "讨论服务暂时不可用。" } }, status);
});

discussionController.get("/admin", async c => {
  await requireAdministrator(c);
  const space = adminSpace(c.req.query("space") ?? "direct");
  return c.json({ ok: true, data: await service(c.env).list(space, cursor(c.req.query("before"))) });
});
discussionController.post("/admin", async c => {
  await requireAdministrator(c);
  const body = object(await c.req.json()) as DiscussionThreadCreateInput & AdminInput;
  return c.json({ ok: true, data: await service(c.env).create("direct", body, administratorActor(body), "participant") }, 201);
});
discussionController.get("/admin/:id", async c => {
  await requireAdministrator(c);
  return c.json({ ok: true, data: await service(c.env).get(c.req.param("id"), ["support", "direct"]) });
});
discussionController.post("/admin/:id/posts", async c => {
  await requireAdministrator(c);
  const body = object(await c.req.json()) as DiscussionPostCreateInput & AdminInput;
  return c.json({ ok: true, data: await service(c.env).post(c.req.param("id"), body.operationId, body.body, administratorActor(body), "participant", ["support", "direct"]) }, 201);
});

discussionController.get("/participant/events", async c => {
  await requireParticipant(c);
  return c.json({ ok: true, data: await service(c.env).events(cursor(c.req.query("after")), ["support", "direct"], "participant") });
});
discussionController.get("/participant", async c => {
  await requireParticipant(c);
  const space = adminSpace(c.req.query("space") ?? "direct");
  return c.json({ ok: true, data: await service(c.env).list(space, cursor(c.req.query("before"))) });
});
discussionController.get("/participant/:id", async c => {
  await requireParticipant(c);
  return c.json({ ok: true, data: await service(c.env).get(c.req.param("id"), ["support", "direct"]) });
});
discussionController.post("/participant/:id/posts", async c => {
  await requireParticipant(c);
  const body = object(await c.req.json()) as unknown as DiscussionPostCreateInput;
  return c.json({ ok: true, data: await service(c.env).post(c.req.param("id"), body.operationId, body.body, discussionParticipantActor, "administrator", ["support", "direct"]) }, 201);
});

function service(env: PortalWorkerEnv): DiscussionService {
  if (!env.PUBLIC_ROADMAP_PORTAL_DB) reject(503, "讨论存储尚未启用。");
  return new DiscussionService(new DiscussionRepository(env.PUBLIC_ROADMAP_PORTAL_DB));
}

async function requireAdministrator(c: Context<{ Bindings: PortalWorkerEnv }>): Promise<void> {
  await new SupportAuthService(c.env).administrator(c.req.header("authorization") ?? "");
}

async function requireParticipant(c: Context<{ Bindings: PortalWorkerEnv }>): Promise<void> {
  await new SupportAuthService(c.env).participant(c.req.header("authorization") ?? "");
}

function administratorActor(input: AdminInput): DiscussionActor {
  const id = typeof input._actor?.id === "string" && input._actor.id ? input._actor.id.slice(0, 160) : "platform-administrator";
  const displayName = typeof input._actor?.displayName === "string" && input._actor.displayName.trim()
    ? input._actor.displayName.trim().slice(0, 80) : "管理员";
  return { id, kind: "human", displayName, roles: ["administrator"], authenticated: true };
}

const discussionParticipantActor: DiscussionActor = {
  id: "nextclaw-discussion-participant",
  kind: "agent",
  displayName: "墨爪",
  roles: ["participant"],
  authenticated: true,
};

function cursor(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) reject(400, "游标参数不正确。");
  return parsed;
}

function adminSpace(value: string): string {
  if (!['support', 'direct'].includes(value)) reject(400, "讨论空间不正确。");
  return value;
}

export { administratorActor, discussionParticipantActor };
