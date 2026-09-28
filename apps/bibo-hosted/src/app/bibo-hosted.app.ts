import { Container } from "@cloudflare/containers";
import { readRunResult, readRunStream, streamEvent, type RunResult } from "./bibo-run-stream.utils";
import { json, publicError } from "./bibo-auth.utils";
import { biboFetch } from "./routes/bibo-http.route";
import { BiboSpaceService, BiboSpaceError, type BiboSpaceState } from "@/features/bibo-domain";
import { BiboSpaceStateStore } from "./bibo-space-state.service";
import { BiboRunError, errorDetails, logDiagnostic, readTrace, readRunFailure, runFailure, traceHeaders, type RunTrace } from "./diagnostics/bibo-diagnostics.utils";
export { BiboModelBudget } from "./bibo-model-gateway.service";

const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;
type Message = { role: "user" | "assistant"; text: string; at: string };
type Session = { id: string; title: string; createdAt: string; updatedAt: string; messages: Message[] };
type ActiveRun = RunTrace & { id: string; phase: "generating" | "saving"; controller: AbortController };

export class BiboUserContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "1m";
  enableInternet = true;
  private inFlight = false;
  private spaceQueue: Promise<void> = Promise.resolve();
  private readonly spaceState = new BiboSpaceStateStore(this.ctx.storage);
  private readonly structuredSpace = new BiboSpaceService("/data", {
    load: () => this.loadSpaceState(),
    save: (state) => this.spaceState.save(state),
  });
  private activeRun: ActiveRun | null = null;

  override async onStart(): Promise<void> {
    const snapshotKey = await this.ctx.storage.get<string>("snapshotKey");
    const archive = await this.env.SNAPSHOTS.get(snapshotKey ?? this.ctx.id.toString());
    if (snapshotKey && !archive?.body) throw new Error("Bibo committed snapshot is unavailable");
    if (archive?.body) {
      const response = await this.containerFetch("http://localhost/restore", { method: "POST", body: archive.body });
      await response.arrayBuffer();
      if (!response.ok) throw new Error(`Bibo snapshot restore failed: ${response.status}`);
    }
    const state = await this.spaceState.load();
    if (state) await this.syncContainerSpace(state);
  }

  private loadSpaceState = async (): Promise<BiboSpaceState | undefined> => {
    const state = await this.spaceState.load();
    if (state) return state;
    const snapshotKey = await this.ctx.storage.get<string>("snapshotKey");
    if (!snapshotKey && !await this.env.SNAPSHOTS.head(this.ctx.id.toString())) return undefined;
    const loaded = await this.readContainerSpace();
    await this.spaceState.save(loaded);
    return loaded;
  };

  private readContainerSpace = async (): Promise<BiboSpaceState> => {
    const response = await this.containerFetch("http://localhost/space/state");
    if (!response.ok) throw new Error(`Bibo space read failed: ${response.status}`);
    const { state } = await response.json() as { state: BiboSpaceState };
    return BiboSpaceService.parseState(state);
  };

  private syncContainerSpace = async (state: BiboSpaceState): Promise<void> => {
    const response = await this.containerFetch("http://localhost/space/state", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state }),
    });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`Bibo space sync failed: ${response.status}`);
  };

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
      logDiagnostic("worker", "run.cancelled", { ...active, stage: active.phase });
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
    if (route === "/sessions/delete" && request.method === "POST") return this.deleteSession(request);
    const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
    if (route === "/sessions" && request.method === "GET") {
      return json({ sessions: sessions.map(({ messages, ...session }) => ({ ...session, messageCount: messages.length })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
    }
    if (route === "/sessions/new" && request.method === "POST") {
      const time = new Date().toISOString();
      const session: Session = { id: crypto.randomUUID(), title: "新对话", createdAt: time, updatedAt: time, messages: [] };
      await this.ctx.storage.put("sessions", [session, ...sessions]);
      return json({ session });
    }
    if (route === "/sessions/rename" && request.method === "POST") {
      const body = await request.json().catch(() => null) as { id?: unknown; title?: unknown } | null;
      if (!body || typeof body.id !== "string" || typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 100) return publicError("会话名称不正确。", 400);
      const session = sessions.find((item) => item.id === body.id);
      if (!session) return publicError("会话不存在。", 404);
      session.title = body.title.trim(); session.updatedAt = new Date().toISOString();
      await this.ctx.storage.put("sessions", sessions);
      return json({ session });
    }
    if (route === "/history") {
      const session = typeof url.searchParams.get("id") === "string" ? sessions.find((item) => item.id === url.searchParams.get("id")) : sessions[0];
      if (url.searchParams.has("id") && !session) return publicError("会话不存在或已删除。", 404);
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
      await this.syncContainerSpace(await this.structuredSpace.exportState());
      needsRestore = true;
      const response = await this.containerFetch("http://localhost/sessions/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: body.id }) });
      await response.arrayBuffer();
      if (!response.ok) return publicError("会话删除失败，请稍后再试。", 503);
      const failed = await this.commitSnapshot({ sessions: sessions.filter((item) => item.id !== body.id) });
      if (failed) return failed;
      needsRestore = false;
      return json({ ok: true });
    } catch (error) {
      logDiagnostic("worker", "session.delete-failed", { ...readTrace(request.headers), ...errorDetails(error), errorCode: "SESSION_DELETE_FAILED" }, "error");
      return publicError("会话删除失败，请稍后再试。", 503);
    } finally {
      if (needsRestore) await this.stop().catch(() => undefined);
    }
  };

  private commitSnapshot = async (metadata: Record<string, unknown> = {}): Promise<Response | null> => {
    const trace = this.activeRun ?? { runId: crypto.randomUUID() };
    logDiagnostic("worker", "snapshot.started", trace);
    const spaceState = await this.readContainerSpace();
    const snapshot = await this.containerFetch("http://localhost/snapshot", { headers: traceHeaders(trace) });
    if (!snapshot.ok) {
      await snapshot.body?.cancel();
      logDiagnostic("worker", "snapshot.failed", { ...trace, status: snapshot.status, errorCode: "SNAPSHOT_FAILED" }, "error");
      return publicError("结果未能保存，请重试。", 503);
    }
    const archive = await snapshot.arrayBuffer();
    logDiagnostic("worker", "snapshot.created", { ...trace, snapshotBytes: archive.byteLength });
    if (archive.byteLength > MAX_SNAPSHOT_BYTES) return publicError("个人空间已达到当前容量限制。", 507);
    const oldKey = await this.ctx.storage.get<string>("snapshotKey") ?? this.ctx.id.toString();
    const nextKey = `${this.ctx.id.toString()}/snapshots/${crypto.randomUUID()}`;
    await this.env.SNAPSHOTS.put(nextKey, archive);
    try { await this.spaceState.save(spaceState, { snapshotKey: nextKey, ...metadata }); }
    catch (error) {
      await this.env.SNAPSHOTS.delete(nextKey).catch(() => undefined);
      throw error;
    }
    logDiagnostic("worker", "snapshot.committed", { ...trace, persisted: true });
    await this.env.SNAPSHOTS.delete(oldKey).catch((error: unknown) => logDiagnostic("worker", "snapshot.cleanup-failed", { ...trace, ...errorDetails(error), errorCode: "SNAPSHOT_CLEANUP_FAILED" }, "warn"));
    return null;
  };

  private persistRun = async (message: string, result: RunResult, session: Session): Promise<Response> => {
    const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
    const at = new Date().toISOString();
    const updated: Session = { ...session, title: session.messages.length === 0 && session.title === "新对话" ? message.slice(0, 40) : session.title, updatedAt: at,
      messages: [...session.messages.slice(-98), { role: "user", text: message, at }, { role: "assistant", text: result.text, at }] };
    const nextSessions = [updated, ...sessions.filter((item) => item.id !== updated.id)];
    const failed = await this.commitSnapshot({ sessions: nextSessions });
    return failed ?? json({ text: result.text, messages: updated.messages, displayEvents: result.displayEvents ?? [], session: { id: updated.id, title: updated.title, updatedAt: updated.updatedAt } });
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
      if (/^(task|project|event)\./.test(body.action)) {
        const started = performance.now();
        const result = await this.structuredSpace.execute(body.action, body.input ?? {});
        return json({ result }, 200, { "server-timing": `space;dur=${(performance.now() - started).toFixed(1)}` });
      }
      await this.syncContainerSpace(await this.structuredSpace.exportState());
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
      if (error instanceof BiboSpaceError) return publicError(error.message, error.status);
      logDiagnostic("worker", "space.failed", { ...readTrace(request.headers), ...errorDetails(error), errorCode: "SPACE_FAILED" }, "error");
      return publicError("操作未能保存，请保留内容后重试。", 503);
    } finally {
      if (needsRestore) await this.stop().catch(() => undefined);
      this.inFlight = false;
    }
  };

  private run = async (request: Request): Promise<Response> => {
    const trace = readTrace(request.headers);
    if (this.inFlight) {
      logDiagnostic("worker", "run.rejected", { ...trace, status: 429, errorCode: "RUN_BUSY" }, "warn");
      return publicError("Bibo 正在处理上一条消息，请稍后再试。", 429);
    }
    this.inFlight = true;
    const streaming = request.headers.get("accept")?.includes("text/event-stream") ?? false;
    const active: ActiveRun = { ...trace, id: trace.runId, phase: "generating", controller: new AbortController() };
    this.activeRun = active;
    logDiagnostic("worker", "run.accepted", active);
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
              const value = await response.json() as { error?: string; code?: string; text?: string; messages?: Message[]; displayEvents?: RunResult["displayEvents"] };
              if (!response.ok) return send("error", { error: value.error ?? "Bibo 暂时无法完成这次任务。", code: value.code, runId: active.id });
              for (const event of value.displayEvents ?? []) send("show-content", event);
              send("committed", value);
            })
            .catch((error: unknown) => {
              logDiagnostic("worker", "stream.failed", { ...active, errorCode: runFailure(error).code }, "error");
              send("error", { error: "Bibo 暂时无法完成这次任务，请稍后重试。", runId: active.id });
            })
            .finally(() => { if (!disconnected) controller.close(); });
          this.ctx.waitUntil(operation);
        },
        cancel: () => {
          disconnected = true;
          logDiagnostic("worker", "client.disconnected", { ...active, stage: active.phase });
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
    if (recent.length >= 100) return publicError("本小时对话次数已用完，请稍后再来。", 429);
    await this.ctx.storage.put("runs", [...recent, now]);
    const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
    const session = typeof payload.sessionId === "string" ? sessions.find((item) => item.id === payload.sessionId) : sessions[0];
    if (payload.sessionId && !session) return publicError("会话不存在。", 404);
    const time = new Date().toISOString();
    return { message: payload.message.trim(), token: payload.token,
      session: session ?? { id: crypto.randomUUID(), title: "新对话", createdAt: time, updatedAt: time, messages: [] } };
  };

  private generateRun = async (payload: { message: string; token: string; session: Session }, active: ActiveRun, onDelta?: (text: string) => void): Promise<RunResult> => {
    const response = await this.containerFetch("http://localhost/run", {
      method: "POST",
      headers: { "content-type": "application/json", ...traceHeaders(active), ...(onDelta ? { accept: "text/event-stream" } : {}) },
      body: JSON.stringify({ message: payload.message, token: payload.token, sessionId: payload.session.id, searchEnabled: Boolean(this.env.BIBO_EXA_API_KEY) }),
      signal: active.controller.signal,
    });
    if (response.status === 429) {
      logDiagnostic("worker", "run.rejected", { ...active, stage: "generate", status: 429, errorCode: "RUNNER_BUSY_OR_LIMITED" }, "warn");
      const limited = await response.json().catch(() => null) as { error?: string } | null;
      throw new BiboRunError("MODEL_RATE_LIMITED", 429, limited?.error ?? "今日试用额度已用完，请明天再试。");
    }
    if (!response.ok) {
      const failure = readRunFailure(await response.json().catch(() => null));
      throw failure.code === "RUN_FAILED" ? new BiboRunError("RUNNER_REQUEST_FAILED", 502, failure.message) : failure;
    }
    const result = response.headers.get("content-type")?.includes("text/event-stream")
      ? await readRunStream(response, onDelta ?? (() => undefined))
      : readRunResult(await response.json() as RunResult);
    if (active.controller.signal.aborted) throw runFailure(null, true);
    if (typeof result.text !== "string" || !result.text || result.sessionId !== payload.session.id) throw new Error("Runner result is invalid");
    return result;
  };

  private executeRun = async (request: Request, active: ActiveRun, onDelta?: (text: string) => void, onSaving?: () => void): Promise<Response> => {
    let attemptedRun = false;
    let persisted = false;
    let stage = "prepare";
    const started = Date.now();
    try {
      const payload = await this.prepareRun(request);
      if (payload instanceof Response) {
        logDiagnostic("worker", "run.rejected", { ...active, stage, status: payload.status, errorCode: "RUN_INVALID_OR_LIMITED" }, "warn");
        return payload;
      }
      active.sessionId = payload.session.id;
      logDiagnostic("worker", "run.started", active);
      attemptedRun = true;
      stage = "restore-and-sync";
      await this.syncContainerSpace(await this.structuredSpace.exportState());
      stage = "generate";
      const result = await this.generateRun(payload, active, onDelta);
      active.phase = "saving";
      stage = "save";
      logDiagnostic("worker", "run.saving", active);
      onSaving?.();
      const saved = await this.persistRun(payload.message, result, payload.session);
      persisted = saved.ok;
      if (!persisted) logDiagnostic("worker", "run.save-failed", { ...active, stage, status: saved.status, errorCode: "RUN_SAVE_FAILED" }, "error");
      return saved;
    } catch (error) {
      const failure = runFailure(error, active.controller.signal.aborted);
      logDiagnostic("worker", "run.failed", { ...active, ...errorDetails(error), stage, status: failure.status, errorCode: failure.code }, "error");
      return json({ error: failure.message, code: failure.code, runId: active.id }, failure.status);
    } finally {
      await this.finishRun(active, { attemptedRun, persisted, stage, started });
    }
  };

  private finishRun = async (active: ActiveRun, result: { attemptedRun: boolean; persisted: boolean; stage: string; started: number }): Promise<void> => {
    if (result.attemptedRun && !result.persisted) {
      try { await this.stop(); logDiagnostic("worker", "run.rollback", { ...active, persisted: false }); }
      catch (error) { logDiagnostic("worker", "run.rollback-failed", { ...active, ...errorDetails(error), errorCode: "ROLLBACK_FAILED" }, "error"); }
    }
    logDiagnostic("worker", "run.finished", { ...active, stage: result.stage, persisted: result.persisted, durationMs: Date.now() - result.started });
    this.inFlight = false;
    if (this.activeRun === active) this.activeRun = null;
  };
}

export default { fetch: biboFetch };
