import { Container } from "@cloudflare/containers";
import { readRunResult, readRunStream, streamEvent, type RunResult } from "./bibo-run-stream.utils";
import { json, publicError } from "./bibo-auth.utils";
import { biboFetch } from "./routes/bibo-http.route";
import { BiboSpaceService, BiboSpaceError, type BiboSpaceState } from "@/features/bibo-domain";
import { BiboSpaceStateStore } from "./bibo-space-state.service";
import { BiboEdgeOwnerController } from "./migration/bibo-edge-owner.controller";
import { BiboEdgeConversationService, type BiboEdgeRunResult } from "./services/bibo-edge-conversation.service";
import { biboSessionRoute, resetBiboSessions } from "./routes/bibo-session.route";
import { createBiboEdgeModel } from "./services/bibo-edge-model.service";
import { createBiboEdgeWebTools } from "./services/bibo-edge-web.service";
import { executeBiboEdgeSpace } from "./services/bibo-edge-space.service";
import { deleteBiboLegacySession, executeBiboContainerSpace, restoreBiboContainer, type BiboContainerSpaceBridge } from "./services/bibo-container-space.service";
import { readCompressedContextCompactionCheckpoint, CONTEXT_COMPACTION_METADATA_KEY } from "@nextclaw/core/context-compaction";
import { buildBiboEdgeContext } from "./services/bibo-edge-context.service";
import { BiboRunError, errorDetails, logDiagnostic, readTrace, readRunFailure, runFailure, traceHeaders, type RunTrace } from "./diagnostics/bibo-diagnostics.utils";
import { parseBiboSpaceRequest } from "./utils/bibo-space-request.utils";
import { prepareBiboSessionRun, type BiboSession } from "./utils/bibo-session.utils";
import { prepareBiboRun, type PreparedBiboRun } from "./utils/bibo-run-preparation.utils";
import { readBiboConversationMode } from "./utils/bibo-conversation-mode.utils";
export { BiboModelBudget } from "./bibo-model-gateway.service";

const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;
type Message = BiboSession["messages"][number];
type Session = BiboSession;
type PreparedRun = PreparedBiboRun;
type ActiveRun = RunTrace & { id: string; phase: "generating" | "saving"; controller: AbortController; acceptedAt: number;
  finished: Promise<void>; complete: () => void };

export class BiboUserContainer extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = "5m";
  enableInternet = true;
  private inFlight = false;
  private containerReadDone: Promise<void> | null = null;
  private spaceQueue: Promise<void> = Promise.resolve();
  private readonly spaceState = new BiboSpaceStateStore(this.ctx.storage);
  private readonly structuredSpace = new BiboSpaceService("/data", {
    load: () => this.loadSpaceState(),
    save: (state) => this.spaceState.save(state),
  });
  private activeRun: ActiveRun | null = null;

  override async onStart(): Promise<void> {
    const starts = await this.ctx.storage.get<number>("containerStartCount") ?? 0;
    await this.ctx.storage.put("containerStartCount", starts + 1);
    await restoreBiboContainer(this.ctx.storage, this.env.SNAPSHOTS, this.ctx.id.toString(),
      (url, init) => this.containerFetch(url, init), (state) => this.syncContainerSpace(state));
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
      if (mutation && (this.inFlight || route === "/sessions/delete" && this.containerReadDone)) return publicError("Bibo 正在处理另一项操作，请稍后再试。", 429);
      if (mutation) this.inFlight = true;
      try { return await biboSessionRoute(request, url, this.ctx.storage, this.conversationMode, this.deleteLegacySession); }
      finally { if (mutation) this.inFlight = false; }
    }
    if (route === "/reset" && request.method === "POST") return this.reset();
    if (route === "/edge/status" && request.method === "POST") return this.edgeOwner().status();
    if (route === "/edge/migrate" && request.method === "POST") return this.migrateEdge();
    if (route === "/edge/rollback" && request.method === "POST") return this.rollbackEdge();
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
    if (this.inFlight || this.containerReadDone) return publicError("Bibo 正在处理任务，请完成后再清空。", 429);
    this.inFlight = true;
    try {
      return await resetBiboSessions(this.ctx.storage, this.env.SNAPSHOTS, this.ctx.id.toString(), () => this.stop());
    } finally { this.inFlight = false; }
  };

  private edgeOwner = (): BiboEdgeOwnerController => new BiboEdgeOwnerController({
    storage: this.ctx.storage, snapshots: this.env.SNAPSHOTS, id: this.ctx.id.toString(),
    containerFetch: (url, init) => this.containerFetch(url, init),
    syncSpace: (state) => this.syncContainerSpace(state),
    exportSpace: () => this.structuredSpace.exportState(),
    commitSnapshot: (metadata) => this.commitSnapshot(metadata),
  });

  private migrateEdge = async (): Promise<Response> => {
    if (this.inFlight || this.containerReadDone) return publicError("Bibo 正在处理任务，请稍后迁移。", 429);
    this.inFlight = true;
    try {
      await this.spaceQueue;
      const result = await this.edgeOwner().migrate();
      await this.stop().catch((error: unknown) => logDiagnostic("worker", "edge.container-stop-failed", { runId: crypto.randomUUID(), ...errorDetails(error) }, "warn"));
      return result;
    } catch (error) {
      logDiagnostic("worker", "edge.migration-failed", { runId: crypto.randomUUID(), ...errorDetails(error), errorCode: "EDGE_MIGRATION_FAILED" }, "error");
      return json({ error: "旧会话迁移校验未通过，Bibo 仍使用原有运行方式。", diagnostic: error instanceof Error ? error.message : "Unknown migration failure" }, 503);
    } finally { this.inFlight = false; }
  };

  private rollbackEdge = async (): Promise<Response> => {
    if (this.inFlight || this.containerReadDone) return publicError("Bibo 正在处理任务，请稍后回退。", 429);
    this.inFlight = true;
    let committed = false;
    try {
      await this.spaceQueue;
      const result = await this.edgeOwner().rollback();
      committed = true;
      await this.stop().catch((error: unknown) => logDiagnostic("worker", "edge.rollback-stop-failed", {
        runId: crypto.randomUUID(), ...errorDetails(error), errorCode: "EDGE_ROLLBACK_STOP_FAILED" }, "warn"));
      return result;
    } catch (error) {
      logDiagnostic("worker", "edge.rollback-failed", { runId: crypto.randomUUID(), ...errorDetails(error), errorCode: "EDGE_ROLLBACK_FAILED" }, "error");
      return publicError("会话回退校验未通过，Bibo 仍使用边缘运行方式。", 503);
    } finally {
      if (!committed) await this.stop().catch(() => undefined);
      this.inFlight = false;
    }
  };

  private conversationMode = (): Promise<"legacy" | "edge"> =>
    readBiboConversationMode(this.ctx.storage, this.env.SNAPSHOTS, this.ctx.id.toString());

  private deleteLegacySession = (id: string, sessions: Session[], request: Request): Promise<Response> =>
    deleteBiboLegacySession(this.containerSpaceBridge(), id, sessions, request);

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

  private preparePersistedRun = async (payload: PreparedRun, result: RunResult): Promise<{ sessions: Session[]; response: Record<string, unknown> }> => {
    const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
    return prepareBiboSessionRun(sessions, payload, result);
  };

  private persistRun = async (payload: PreparedRun, result: RunResult): Promise<Response> => {
    const prepared = await this.preparePersistedRun(payload, result);
    const failed = await this.commitSnapshot({ sessions: prepared.sessions });
    return failed ?? json(prepared.response);
  };

  private persistEdgeRun = async (payload: PreparedRun, result: BiboEdgeRunResult, edge: BiboEdgeConversationService): Promise<Response> => {
    const prepared = await this.preparePersistedRun(payload, { text: result.text, sessionId: payload.session.id,
      displayEvents: result.displayEvents, questions: result.questions });
    const edgeRunCount = await this.ctx.storage.get<number>("edgeRunCount") ?? 0;
    await edge.commit(payload.session.id, result, { sessions: prepared.sessions, edgeRunCount: edgeRunCount + 1,
      ...(payload.clientRequestId ? { [`edgeRunReceipt:${payload.clientRequestId}`]: { sessionId: payload.session.id } } : {}) });
    return json(prepared.response);
  };

  private containerSpaceBridge = (): BiboContainerSpaceBridge => ({
      exportSpace: () => this.structuredSpace.exportState(),
      syncSpace: (state) => this.syncContainerSpace(state),
      containerFetch: (url, init) => this.containerFetch(url, init),
      commitSnapshot: (metadata) => this.commitSnapshot(metadata),
      stop: () => this.stop(),
  });

  private space = async (request: Request): Promise<Response> => {
    let locked = false;
    let readDone: Promise<void> | null = null;
    let completeRead: () => void = () => undefined;
    try {
      const parsed = await parseBiboSpaceRequest(request);
      if (parsed instanceof Response) return parsed;
      const { raw, action, input, readOnly, structured } = parsed;
      const mode = await this.conversationMode();
      if (readOnly && !structured && mode !== "edge") while (this.activeRun) await this.activeRun.finished;
      if (this.inFlight && (!readOnly || !this.activeRun)) return publicError("Bibo 正在处理另一项操作，请稍后再试。", 429);
      if (!readOnly && this.containerReadDone) return publicError("Bibo 正在处理另一项操作，请稍后再试。", 429);
      if (!readOnly) { this.inFlight = true; locked = true; }
      if (mode === "edge") return await executeBiboEdgeSpace(this.ctx.storage, this.spaceState, action, input);
      if (structured) {
        const started = performance.now();
        const result = await this.structuredSpace.execute(action, input);
        return json({ result }, 200, { "server-timing": `space;dur=${(performance.now() - started).toFixed(1)}` });
      }
      if (readOnly) {
        readDone = new Promise<void>((resolve) => { completeRead = resolve; });
        this.containerReadDone = readDone;
      }
      return await executeBiboContainerSpace(this.containerSpaceBridge(), raw, /\.(create|update|move|delete|read|resolve)$/.test(action));
    } catch (error) {
      if (error instanceof BiboSpaceError) return publicError(error.message, error.status);
      logDiagnostic("worker", "space.failed", { ...readTrace(request.headers), ...errorDetails(error), errorCode: "SPACE_FAILED" }, "error");
      return publicError("操作未能保存，请保留内容后重试。", 503);
    } finally {
      if (readDone && this.containerReadDone === readDone) this.containerReadDone = null;
      if (readDone) completeRead();
      if (locked) this.inFlight = false;
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
    let complete!: () => void;
    const finished = new Promise<void>((resolve) => { complete = resolve; });
    const active: ActiveRun = { ...trace, id: trace.runId, phase: "generating", controller: new AbortController(), acceptedAt: Date.now(), finished, complete };
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

  private generateRun = async (payload: PreparedRun, active: ActiveRun, onDelta?: (text: string) => void): Promise<RunResult> => {
    const response = await this.containerFetch("http://localhost/run", {
      method: "POST",
      headers: { "content-type": "application/json", ...traceHeaders(active), ...(onDelta ? { accept: "text/event-stream" } : {}) },
      body: JSON.stringify({ message: payload.message, token: payload.token, sessionId: payload.session.id, searchEnabled: Boolean(this.env.BIBO_EXA_API_KEY),
        ...(payload.question ? { questionId: payload.question.id, questionAction: payload.question.action } : {}) }),
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
    let firstDelta = true;
    const result = response.headers.get("content-type")?.includes("text/event-stream")
      ? await readRunStream(response, (delta) => {
        if (firstDelta && delta) {
          firstDelta = false;
          logDiagnostic("worker", "run.first-delta", { ...active, durationMs: Date.now() - active.acceptedAt });
        }
        onDelta?.(delta);
      })
      : readRunResult(await response.json() as RunResult);
    if (active.controller.signal.aborted) throw runFailure(null, true);
    if (typeof result.text !== "string" || !result.text || result.sessionId !== payload.session.id) throw new Error("Runner result is invalid");
    return result;
  };

  private prepareContainerForRun = async (active: ActiveRun): Promise<void> => {
    const started = Date.now();
    await this.containerReadDone;
    await this.syncContainerSpace(await this.structuredSpace.exportState());
    logDiagnostic("worker", "run.space-ready", { ...active, durationMs: Date.now() - started });
  };

  private executeRun = async (request: Request, active: ActiveRun, onDelta?: (text: string) => void, onSaving?: () => void): Promise<Response> => {
    let attemptedRun = false;
    let persisted = false;
    let usedContainer = false;
    let stage = "prepare";
    const started = Date.now();
    try {
      const payload = await prepareBiboRun(request, this.ctx.storage);
      if (payload instanceof Response) {
        logDiagnostic("worker", "run.rejected", { ...active, stage, status: payload.status, errorCode: "RUN_INVALID_OR_LIMITED" }, "warn");
        return payload;
      }
      active.sessionId = payload.session.id;
      logDiagnostic("worker", "run.started", active);
      attemptedRun = true;
      if (await this.conversationMode() === "edge") {
        if (!payload.userId) throw new BiboRunError("EDGE_INPUT_UNSUPPORTED", 503, "Bibo 暂时无法继续这次会话，请稍后重试。");
        const model = createBiboEdgeModel(this.env, payload.userId, active, () =>
          logDiagnostic("worker", "run.model-started", { ...active, durationMs: Date.now() - active.acceptedAt }));
        const edge = new BiboEdgeConversationService(this.ctx.storage, this.spaceState, model.llmApi, model.summaryProvider);
        stage = "generate-edge";
        const timeout = setTimeout(() => active.controller.abort(new BiboRunError("RUN_TIMEOUT", 504, "本次生成超时，本轮未保存，请稍后重试。")), 85_000);
        let firstDelta = true;
        let result: BiboEdgeRunResult;
        try {
          result = await edge.run({ sessionId: payload.session.id, message: payload.message,
            ...(payload.question ? { question: { id: payload.question.id, action: payload.question.action, answer: payload.message } } : {}),
            tools: createBiboEdgeWebTools(this.env, payload.userId, payload.token),
            buildContext: (metadata) => buildBiboEdgeContext(this.ctx.storage, payload.session.id,
              Boolean(this.env.BIBO_EXA_API_KEY), Boolean(readCompressedContextCompactionCheckpoint(metadata[CONTEXT_COMPACTION_METADATA_KEY]))),
            runId: active.id, signal: active.controller.signal,
            onDelta: (delta) => {
              if (firstDelta && delta) { firstDelta = false; logDiagnostic("worker", "run.first-delta", { ...active, durationMs: Date.now() - active.acceptedAt }); }
              onDelta?.(delta);
            } });
        } finally { clearTimeout(timeout); }
        active.phase = "saving";
        stage = "save-edge";
        onSaving?.();
        const saved = await this.persistEdgeRun(payload, result, edge);
        persisted = saved.ok;
        return saved;
      }
      usedContainer = true;
      stage = "restore-and-sync";
      await this.prepareContainerForRun(active);
      stage = "generate";
      const result = await this.generateRun(payload, active, onDelta);
      active.phase = "saving";
      stage = "save";
      logDiagnostic("worker", "run.saving", active);
      onSaving?.();
      const saved = await this.persistRun(payload, result);
      persisted = saved.ok;
      if (!persisted) logDiagnostic("worker", "run.save-failed", { ...active, stage, status: saved.status, errorCode: "RUN_SAVE_FAILED" }, "error");
      return saved;
    } catch (error) {
      const failure = runFailure(error, active.controller.signal.aborted);
      logDiagnostic("worker", "run.failed", { ...active, ...errorDetails(error), stage, status: failure.status, errorCode: failure.code }, "error");
      return json({ error: failure.message, code: failure.code, runId: active.id }, failure.status);
    } finally {
      await this.finishRun(active, { attemptedRun: attemptedRun && usedContainer, persisted, stage, started });
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
    active.complete();
  };
}

export default { fetch: biboFetch };
