import { Container, getContainer } from "@cloudflare/containers";
import { DurableObject } from "cloudflare:workers";
import { readRunStream, streamEvent, type RunResult } from "./bibo-run-stream.utils";

const PLATFORM = "https://ai-gateway-api.nextclaw.io";
const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;
const MAX_MODEL_REQUEST_BYTES = 128 * 1024;
type Message = { role: "user" | "assistant"; text: string; at: string };
type PlatformResponse<T> = { ok: boolean; data?: T; error?: { message?: string } };
type User = { id: string; email: string; freeRemainingUsd: number; paidBalanceUsd: number };
function json(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function cookieToken(request: Request): string | null {
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)bibo_session=([^;]+)/);
  return cookie ? decodeURIComponent(cookie[1] ?? "") : null;
}

async function platformRequest<T>(path: string, token: string | null, body?: unknown): Promise<{ status: number; value: PlatformResponse<T> }> {
  const response = await fetch(`${PLATFORM}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let value: PlatformResponse<T>;
  try { value = await response.json(); } catch { value = { ok: false, error: { message: "Account service unavailable" } }; }
  return { status: response.status, value };
}

async function currentUser(token: string | null): Promise<User | null> {
  if (!token) return null;
  const { status, value } = await platformRequest<{ user: User }>("/platform/auth/me", token);
  return status === 200 && value.ok ? value.data?.user ?? null : null;
}

function publicError(message: string, status: number): Response {
  return json({ error: message }, status);
}

function modelError(message: string, status: number): Response {
  return json({ error: { message, type: "bibo_limit_error" } }, status);
}

export class BiboModelBudget extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return modelError("Not found", 404);
    const { userId } = await request.json() as { userId?: unknown };
    if (typeof userId !== "string" || !userId) return modelError("Invalid user", 400);
    const day = new Date().toISOString().slice(0, 10);
    const reserved = await this.ctx.storage.transaction(async (storage) => {
      const saved = await storage.get<{ day: string; total: number; users: Record<string, number> }>("budget");
      const budget = saved?.day === day ? saved : { day, total: 0, users: {} };
      if (budget.total >= 200 || (budget.users[userId] ?? 0) >= 30) return false;
      budget.total += 1;
      budget.users[userId] = (budget.users[userId] ?? 0) + 1;
      await storage.put("budget", budget);
      return true;
    });
    return reserved ? json({ ok: true }) : modelError("今日试用额度已用完，请明天再试。", 429);
  }
}

async function modelRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return modelError("Not found", 404);
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const user = await currentUser(bearer);
  if (!user) return modelError("请先登录。", 401);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_MODEL_REQUEST_BYTES) return modelError("模型输入过长。", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_MODEL_REQUEST_BYTES) return modelError("模型输入过长。", 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw) as Record<string, unknown>; }
  catch { return modelError("模型请求格式不正确。", 400); }
  if (!body || typeof body !== "object" || !Array.isArray(body.messages) || body.messages.length === 0) return modelError("缺少对话内容。", 400);
  const budget = env.BIBO_MODEL_BUDGET.getByName("global");
  const reservation = await budget.fetch("https://bibo.internal/reserve", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: user.id }),
  });
  if (!reservation.ok) return reservation;
  const upstream = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.BIBO_DEEPSEEK_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-flash",
      messages: body.messages,
      ...(Array.isArray(body.tools) ? { tools: body.tools, tool_choice: body.tool_choice ?? "auto" } : {}),
      stream: body.stream === true,
      max_tokens: Math.max(1, Math.min(typeof body.max_tokens === "number" ? body.max_tokens : 2048, 2048)),
    }),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
  });
}

export class BiboUserContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "1m";
  enableInternet = true;
  private inFlight = false;
  private activeRun: { id: string; phase: "generating" | "saving"; controller: AbortController } | null = null;

  override async onStart(): Promise<void> {
    const archive = await this.env.SNAPSHOTS.get(await this.ctx.storage.get<string>("snapshotKey") ?? this.ctx.id.toString());
    if (!archive?.body) return;
    const response = await this.containerFetch("http://localhost/restore", { method: "POST", body: archive.body });
    if (!response.ok) throw new Error(`Bibo snapshot restore failed: ${response.status}`);
  }

  override async fetch(request: Request): Promise<Response> {
    const route = new URL(request.url).pathname;
    if (route === "/history") {
      return json({ messages: await this.ctx.storage.get<Message[]>("messages") ?? [] });
    }
    if (route === "/reset" && request.method === "POST") {
      if (this.inFlight) return publicError("Bibo 正在处理任务，请完成后再清空。", 429);
      await this.stop();
      const snapshotKey = await this.ctx.storage.get<string>("snapshotKey");
      if (snapshotKey) await this.env.SNAPSHOTS.delete(snapshotKey);
      await this.env.SNAPSHOTS.delete(this.ctx.id.toString());
      await this.ctx.storage.deleteAll();
      return json({ ok: true });
    }
    if (route === "/cancel" && request.method === "POST") {
      const body = await request.json().catch(() => null) as { runId?: unknown } | null;
      const active = this.activeRun;
      if (!body || !active || body.runId !== active.id) return publicError("这次生成已经结束。", 409);
      if (active.phase === "saving") return publicError("回答正在保存，请稍后查看。", 409);
      active.controller.abort();
      return json({ ok: true });
    }
    if (route !== "/run" || request.method !== "POST") return publicError("Not found", 404);
    return this.run(request);
  }

  private persistRun = async (message: string, result: RunResult): Promise<Response> => {
    const snapshot = await this.containerFetch("http://localhost/snapshot");
    if (!snapshot.ok) {
      console.error("bibo-snapshot-failed", snapshot.status, (await snapshot.text()).slice(0, 300));
      return publicError("结果未能保存，请重试。", 503);
    }
    const archive = await snapshot.arrayBuffer();
    if (archive.byteLength > MAX_SNAPSHOT_BYTES) return publicError("个人空间已达到首发容量限制。", 507);
    const oldKey = await this.ctx.storage.get<string>("snapshotKey") ?? this.ctx.id.toString();
    const nextKey = `${this.ctx.id.toString()}/snapshots/${crypto.randomUUID()}`;
    await this.env.SNAPSHOTS.put(nextKey, archive);
    const messages = await this.ctx.storage.get<Message[]>("messages") ?? [];
    const at = new Date().toISOString();
    const updated = [...messages.slice(-98), { role: "user" as const, text: message, at }, { role: "assistant" as const, text: result.text, at }];
    try { await this.ctx.storage.put({ snapshotKey: nextKey, sessionId: result.sessionId, messages: updated }); }
    catch (error) {
      await this.env.SNAPSHOTS.delete(nextKey).catch(() => undefined);
      throw error;
    }
    await this.env.SNAPSHOTS.delete(oldKey).catch((error: unknown) => console.error("bibo-old-snapshot-delete-failed", error));
    return json({ text: result.text, messages: updated });
  };

  private run = async (request: Request): Promise<Response> => {
    if (this.inFlight) return publicError("Bibo 正在处理上一条消息，请稍后再试。", 429);
    this.inFlight = true;
    const streaming = request.headers.get("accept")?.includes("text/event-stream") ?? false;
    const active = { id: crypto.randomUUID(), phase: "generating" as "generating" | "saving", controller: new AbortController() };
    this.activeRun = active;
    if (streaming) {
      let disconnected = false;
      const body = new ReadableStream<Uint8Array>({
        start: (controller) => {
          const encoder = new TextEncoder();
          const send = (event: string, value: unknown) => {
            if (!disconnected) controller.enqueue(encoder.encode(streamEvent(event, value)));
          };
          send("accepted", { runId: active.id });
          const operation = this.executeRun(request, active, (delta) => send("delta", { text: delta }), () => send("saving", {}))
            .then(async (response) => {
              const value = await response.json() as { error?: string; text?: string; messages?: Message[] };
              if (response.ok) send("committed", value);
              else send("error", { error: value.error ?? "Bibo 暂时无法完成这次任务。" });
            })
            .catch((error: unknown) => {
              console.error("bibo-stream-failed", error instanceof Error ? error.message : String(error));
              send("error", { error: "Bibo 暂时无法完成这次任务，请稍后重试。" });
            })
            .finally(() => { if (!disconnected) controller.close(); });
          this.ctx.waitUntil(operation);
        },
        cancel: () => {
          disconnected = true;
          if (active.phase === "generating") active.controller.abort();
        },
      });
      return new Response(body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
    }
    return this.executeRun(request, active);
  };

  private prepareRun = async (request: Request): Promise<{ message: string; token: string; sessionId?: string } | Response> => {
    const payload = await request.json() as { message?: unknown; token?: unknown };
    if (typeof payload.message !== "string" || !payload.message.trim() || payload.message.length > 4000 || typeof payload.token !== "string") {
      return publicError("请输入 1 到 4000 字的消息。", 400);
    }
    const now = Date.now();
    const recent = (await this.ctx.storage.get<number[]>("runs") ?? []).filter((at) => now - at < 3_600_000);
    if (recent.length >= 12) return publicError("本小时对话次数已用完，请稍后再来。", 429);
    await this.ctx.storage.put("runs", [...recent, now]);
    return { message: payload.message.trim(), token: payload.token, sessionId: await this.ctx.storage.get<string>("sessionId") };
  };

  private executeRun = async (request: Request, active: { id: string; phase: "generating" | "saving"; controller: AbortController }, onDelta?: (text: string) => void, onSaving?: () => void): Promise<Response> => {
    let attemptedRun = false;
    let persisted = false;
    try {
      const payload = await this.prepareRun(request);
      if (payload instanceof Response) return payload;
      attemptedRun = true;
      const response = await this.containerFetch("http://localhost/run", {
        method: "POST",
        headers: { "content-type": "application/json", ...(onDelta ? { accept: "text/event-stream" } : {}) },
        body: JSON.stringify(payload),
        signal: active.controller.signal,
      });
      if (response.status === 429) {
        const limited = await response.json().catch(() => null) as { error?: string } | null;
        return publicError(limited?.error ?? "今日试用额度已用完，请明天再试。", 429);
      }
      if (!response.ok) {
        console.error("bibo-run-response-failed", response.status, (await response.text()).slice(0, 300));
        return publicError("Bibo 暂时无法完成这次任务，请稍后重试。", 502);
      }
      const result = response.headers.get("content-type")?.includes("text/event-stream")
        ? await readRunStream(response, onDelta ?? (() => undefined))
        : await response.json() as { text?: string; sessionId?: string };
      if (active.controller.signal.aborted) return publicError("已停止生成，本轮未保存。", 409);
      if (!result.text || !result.sessionId) return publicError("Bibo 没有返回可保存的结果。", 502);
      active.phase = "saving";
      onSaving?.();
      const saved = await this.persistRun(payload.message, { text: result.text, sessionId: result.sessionId });
      persisted = saved.ok;
      return saved;
    } catch (error) {
      console.error("bibo-container-run-failed", error instanceof Error ? error.message : String(error));
      return publicError("Bibo 暂时无法完成这次任务，请稍后重试。", 503);
    } finally {
      if (attemptedRun && !persisted) await this.stop().catch(() => undefined);
      this.inFlight = false;
      if (this.activeRun === active) this.activeRun = null;
    }
  };
}

async function authRoute(request: Request, path: string): Promise<Response> {
  const routeMap: Record<string, string> = {
    "/api/auth/send-code": "/platform/auth/register/send-code",
    "/api/auth/register": "/platform/auth/register/complete",
    "/api/auth/login": "/platform/auth/login",
  };
  if (path === "/api/auth/logout" && request.method === "POST") return json({ ok: true }, 200, { "set-cookie": "bibo_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
  if (path === "/api/auth/me") {
    if (request.method !== "GET") return publicError("Not found", 404);
    const user = await currentUser(cookieToken(request));
    return user ? json({ user }) : publicError("请先登录。", 401);
  }
  const upstream = routeMap[path];
  if (!upstream || request.method !== "POST") return publicError("Not found", 404);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return publicError("请求格式不正确。", 400);
  const { status, value } = await platformRequest<{ token?: string; user?: User }>(upstream, null, body);
  if (!value.ok) return publicError(value.error?.message ?? "账号服务暂时不可用。", status);
  const token = value.data?.token;
  if (token) {
    return json({ user: value.data?.user }, status, { "set-cookie": `bibo_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` });
  }
  return json(value.data, status);
}

export default {
  fetch: async (request: Request, env: Env): Promise<Response> => {
    const url = new URL(request.url);
    if (url.hostname === "bibo.bot") {
      if (request.method !== "GET" && request.method !== "HEAD") return publicError("Not found", 404);
      const path = url.pathname.replace(/^\/app\/?/, "/");
      return Response.redirect(`https://app.bibo.bot${path}${url.search}`, 308);
    }
    const path = url.pathname;
    if (path.startsWith("/api/")) {
      if (path === "/api/model/v1/chat/completions") {
        try { return await modelRoute(request, env); }
        catch (error) {
          console.error("bibo-model-error", error instanceof Error ? error.message : String(error));
          return modelError("模型服务暂时不可用。", 503);
        }
      }
      if (request.method !== "GET" && request.headers.get("origin") !== url.origin) return publicError("请求来源不正确。", 403);
      try {
        if (path.startsWith("/api/auth/")) return await authRoute(request, path);
        const token = cookieToken(request);
        const user = await currentUser(token);
        if (!user || !token) return publicError("请先登录。", 401);
        const container = getContainer(env.BIBO_USER, `user:${user.id}`);
        if (path === "/api/history" && request.method === "GET") return await container.fetch("https://bibo.internal/history");
        if (path === "/api/reset" && request.method === "POST") return await container.fetch("https://bibo.internal/reset", { method: "POST" });
        if (path === "/api/cancel" && request.method === "POST") return await container.fetch("https://bibo.internal/cancel", {
          method: "POST", headers: { "content-type": "application/json" }, body: await request.text(),
        });
        if (path === "/api/chat" && request.method === "POST") {
          const body = await request.json() as { message?: unknown };
          return await container.fetch("https://bibo.internal/run", {
            method: "POST",
            headers: { "content-type": "application/json", ...(request.headers.get("accept")?.includes("text/event-stream") ? { accept: "text/event-stream" } : {}) },
            body: JSON.stringify({ message: body.message, token }),
          });
        }
        return publicError("Not found", 404);
      } catch (error) {
        console.error("bibo-edge-error", error instanceof Error ? error.message : String(error));
        return publicError("Bibo 暂时无法连接，请稍后重试。", 503);
      }
    }
    return await env.ASSETS.fetch(request);
  },
};
