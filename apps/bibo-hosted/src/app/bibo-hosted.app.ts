import { Container, getContainer } from "@cloudflare/containers";
import { DurableObject } from "cloudflare:workers";
import { readRunStream, streamEvent, type RunResult } from "./bibo-run-stream.utils";
import { authRoute, cookieToken, currentUser, json, publicError } from "./bibo-auth.utils";

const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;
const MAX_MODEL_REQUEST_BYTES = 128 * 1024;
type Message = { role: "user" | "assistant"; text: string; at: string };
type Session = { id: string; title: string; createdAt: string; updatedAt: string; messages: Message[] };

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
      thinking: { type: "disabled" },
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
  private spaceQueue: Promise<void> = Promise.resolve();
  private activeRun: { id: string; phase: "generating" | "saving"; controller: AbortController } | null = null;

  override async onStart(): Promise<void> {
    const archive = await this.env.SNAPSHOTS.get(await this.ctx.storage.get<string>("snapshotKey") ?? this.ctx.id.toString());
    if (!archive?.body) return;
    const response = await this.containerFetch("http://localhost/restore", { method: "POST", body: archive.body });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`Bibo snapshot restore failed: ${response.status}`);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const route = url.pathname;
    if (route.startsWith("/sessions") || route === "/history") {
      const mutation = request.method === "POST";
      if (mutation && this.inFlight) return publicError("Bibo 正在处理另一项操作，请稍后再试。", 429);
      if (mutation) this.inFlight = true;
      try { return await this.sessionRoute(request, url); }
      finally { if (mutation) this.inFlight = false; }
    }
    if (route === "/reset" && request.method === "POST") return this.reset();
    if (route === "/cancel" && request.method === "POST") {
      const body = await request.json().catch(() => null) as { runId?: unknown } | null;
      const active = this.activeRun;
      if (!body || !active || body.runId !== active.id) return publicError("这次生成已经结束。", 409);
      if (active.phase === "saving") return publicError("回答正在保存，请稍后查看。", 409);
      active.controller.abort();
      return json({ ok: true });
    }
    if (route === "/space" && request.method === "POST") {
      const pending = this.spaceQueue.then(() => this.space(request));
      this.spaceQueue = pending.then(() => undefined, () => undefined);
      return pending;
    }
    if (route !== "/run" || request.method !== "POST") return publicError("Not found", 404);
    return this.run(request);
  }

  private reset = async (): Promise<Response> => {
    if (this.inFlight) return publicError("Bibo 正在处理任务，请完成后再清空。", 429);
    this.inFlight = true;
    try {
      await this.stop();
      const snapshotKey = await this.ctx.storage.get<string>("snapshotKey");
      if (snapshotKey) await this.env.SNAPSHOTS.delete(snapshotKey);
      await this.env.SNAPSHOTS.delete(this.ctx.id.toString());
      await this.ctx.storage.deleteAll();
      return json({ ok: true });
    } finally { this.inFlight = false; }
  };

  private sessionRoute = async (request: Request, url: URL): Promise<Response> => {
    const route = url.pathname;
    if (route === "/sessions" && request.method === "GET") {
      const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
      return json({ sessions: sessions.map(({ messages, ...session }) => ({ ...session, messageCount: messages.length })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
    }
    if (route === "/sessions/new" && request.method === "POST") {
      const time = new Date().toISOString();
      const session: Session = { id: crypto.randomUUID(), title: "新对话", createdAt: time, updatedAt: time, messages: [] };
      const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
      await this.ctx.storage.put("sessions", [session, ...sessions]);
      return json({ session });
    }
    if (route === "/sessions/rename" && request.method === "POST") {
      const body = await request.json().catch(() => null) as { id?: unknown; title?: unknown } | null;
      if (!body || typeof body.id !== "string" || typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 100) return publicError("会话名称不正确。", 400);
      const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
      const session = sessions.find((item) => item.id === body.id);
      if (!session) return publicError("会话不存在。", 404);
      session.title = body.title.trim(); session.updatedAt = new Date().toISOString();
      await this.ctx.storage.put("sessions", sessions);
      return json({ session });
    }
    if (route === "/sessions/delete" && request.method === "POST") return this.deleteSession(request);
    if (route === "/history") {
      const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
      const session = typeof url.searchParams.get("id") === "string" ? sessions.find((item) => item.id === url.searchParams.get("id")) : sessions[0];
      return json({ messages: session?.messages ?? [], session: session ? { id: session.id, title: session.title, updatedAt: session.updatedAt } : null });
    }
    return publicError("Not found", 404);
  };

  private deleteSession = async (request: Request): Promise<Response> => {
    const body = await request.json().catch(() => null) as { id?: unknown } | null;
    const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
    if (!body || !sessions.some((item) => item.id === body.id)) return publicError("会话不存在。", 404);
    let needsRestore = false;
    try {
      needsRestore = true;
      const response = await this.containerFetch("http://localhost/sessions/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: body.id }) });
      await response.arrayBuffer();
      if (!response.ok) return publicError("会话删除失败，请稍后再试。", 503);
      const failed = await this.commitSnapshot({ sessions: sessions.filter((item) => item.id !== body.id) });
      if (failed) return failed;
      needsRestore = false;
      return json({ ok: true });
    } catch (error) {
      console.error("bibo-session-delete-failed", error instanceof Error ? error.message : String(error));
      return publicError("会话删除失败，请稍后再试。", 503);
    } finally {
      if (needsRestore) await this.stop().catch(() => undefined);
    }
  };

  private commitSnapshot = async (metadata: Record<string, unknown> = {}): Promise<Response | null> => {
    const snapshot = await this.containerFetch("http://localhost/snapshot");
    if (!snapshot.ok) {
      console.error("bibo-snapshot-failed", snapshot.status, (await snapshot.text()).slice(0, 300));
      return publicError("结果未能保存，请重试。", 503);
    }
    const archive = await snapshot.arrayBuffer();
    if (archive.byteLength > MAX_SNAPSHOT_BYTES) return publicError("个人空间已达到当前容量限制。", 507);
    const oldKey = await this.ctx.storage.get<string>("snapshotKey") ?? this.ctx.id.toString();
    const nextKey = `${this.ctx.id.toString()}/snapshots/${crypto.randomUUID()}`;
    await this.env.SNAPSHOTS.put(nextKey, archive);
    try { await this.ctx.storage.put({ snapshotKey: nextKey, ...metadata }); }
    catch (error) {
      await this.env.SNAPSHOTS.delete(nextKey).catch(() => undefined);
      throw error;
    }
    await this.env.SNAPSHOTS.delete(oldKey).catch((error: unknown) => console.error("bibo-old-snapshot-delete-failed", error));
    return null;
  };

  private persistRun = async (message: string, result: RunResult, session: Session): Promise<Response> => {
    const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
    const at = new Date().toISOString();
    const updated: Session = { ...session, title: session.messages.length === 0 && session.title === "新对话" ? message.slice(0, 40) : session.title, updatedAt: at,
      messages: [...session.messages.slice(-98), { role: "user", text: message, at }, { role: "assistant", text: result.text, at }] };
    const nextSessions = [updated, ...sessions.filter((item) => item.id !== updated.id)];
    const failed = await this.commitSnapshot({ sessions: nextSessions });
    return failed ?? json({ text: result.text, messages: updated.messages, session: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt } });
  };

  private space = async (request: Request): Promise<Response> => {
    if (this.inFlight) return publicError("Bibo 正在处理另一项操作，请稍后再试。", 429);
    this.inFlight = true;
    let needsRestore = false;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 1_100_000) return publicError("内容过大。", 413);
      const body = JSON.parse(raw) as { action?: unknown; input?: unknown };
      if (!body || typeof body.action !== "string") return publicError("缺少操作名称。", 400);
      const write = /\.(create|update|move|delete|read|resolve)$/.test(body.action);
      needsRestore = write;
      const response = await this.containerFetch("http://localhost/space", {
        method: "POST", headers: { "content-type": "application/json" }, body: raw,
      });
      const resultText = await response.text();
      const result = new Response(resultText, { status: response.status, headers: { ...Object.fromEntries(response.headers), "cache-control": "no-store" } });
      if (!response.ok || !write) return result;
      const failed = await this.commitSnapshot();
      if (failed) return failed;
      needsRestore = false;
      return result;
    } catch (error) {
      console.error("bibo-space-failed", error instanceof Error ? error.message : String(error));
      return publicError("操作未能保存，请保留内容后重试。", 503);
    } finally {
      if (needsRestore) await this.stop().catch(() => undefined);
      this.inFlight = false;
    }
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

  private prepareRun = async (request: Request): Promise<{ message: string; token: string; session: Session } | Response> => {
    const payload = await request.json() as { message?: unknown; token?: unknown; sessionId?: unknown };
    if (typeof payload.message !== "string" || !payload.message.trim() || payload.message.length > 4000 || typeof payload.token !== "string") {
      return publicError("请输入 1 到 4000 字的消息。", 400);
    }
    const now = Date.now();
    const recent = (await this.ctx.storage.get<number[]>("runs") ?? []).filter((at) => now - at < 3_600_000);
    if (recent.length >= 12) return publicError("本小时对话次数已用完，请稍后再来。", 429);
    await this.ctx.storage.put("runs", [...recent, now]);
    const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
    const session = typeof payload.sessionId === "string" ? sessions.find((item) => item.id === payload.sessionId) : sessions[0];
    if (payload.sessionId && !session) return publicError("会话不存在。", 404);
    const time = new Date().toISOString();
    return { message: payload.message.trim(), token: payload.token,
      session: session ?? { id: crypto.randomUUID(), title: "新对话", createdAt: time, updatedAt: time, messages: [] } };
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
        body: JSON.stringify({ message: payload.message, token: payload.token, sessionId: payload.session.id }),
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
      const saved = await this.persistRun(payload.message, { text: result.text, sessionId: result.sessionId }, payload.session);
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

async function userRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const token = cookieToken(request);
  const user = await currentUser(token);
  if (!user || !token) return publicError("请先登录。", 401);
  const container = getContainer(env.BIBO_USER, `user:${user.id}`);
  if (path === "/api/sessions" && request.method === "GET") return await container.fetch("https://bibo.internal/sessions");
  if (path === "/api/sessions" && request.method === "POST") return await container.fetch("https://bibo.internal/sessions/new", { method: "POST" });
  if (path === "/api/sessions/rename" && request.method === "POST") return await container.fetch("https://bibo.internal/sessions/rename", {
    method: "POST", headers: { "content-type": "application/json" }, body: await request.text(),
  });
  if (path === "/api/sessions/delete" && request.method === "POST") return await container.fetch("https://bibo.internal/sessions/delete", {
    method: "POST", headers: { "content-type": "application/json" }, body: await request.text(),
  });
  if (path === "/api/history" && request.method === "GET") return await container.fetch(`https://bibo.internal/history${url.search}`);
  if (path === "/api/space" && request.method === "POST") return await container.fetch("https://bibo.internal/space", {
    method: "POST", headers: { "content-type": "application/json" }, body: await request.text(),
  });
  if (path === "/api/reset" && request.method === "POST") return await container.fetch("https://bibo.internal/reset", { method: "POST" });
  if (path === "/api/cancel" && request.method === "POST") return await container.fetch("https://bibo.internal/cancel", {
    method: "POST", headers: { "content-type": "application/json" }, body: await request.text(),
  });
  if (path === "/api/chat" && request.method === "POST") {
    const body = await request.json() as { message?: unknown; sessionId?: unknown };
    return await container.fetch("https://bibo.internal/run", {
      method: "POST",
      headers: { "content-type": "application/json", ...(request.headers.get("accept")?.includes("text/event-stream") ? { accept: "text/event-stream" } : {}) },
      body: JSON.stringify({ message: body.message, sessionId: body.sessionId, token }),
    });
  }
  return publicError("Not found", 404);
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
        return await userRoute(request, env, url);
      } catch (error) {
        console.error("bibo-edge-error", error instanceof Error ? error.message : String(error));
        return publicError("Bibo 暂时无法连接，请稍后重试。", 503);
      }
    }
    return await env.ASSETS.fetch(request);
  },
};
