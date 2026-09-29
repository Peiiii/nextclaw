import { DurableObject } from "cloudflare:workers";
import { streamEvent, type RunResult } from "./bibo-run-stream.utils";
import { json, publicError } from "./bibo-auth.utils";
import { biboFetch } from "./routes/bibo-http.route";
import { BiboSpaceError } from "@/features/bibo-domain";
import { BiboSpaceStateStore } from "./bibo-space-state.service";
import { BiboConversationService, type BiboEdgeRunResult } from "./services/bibo-conversation.service";
import { biboSessionRoute, resetBiboSessions } from "./routes/bibo-session.route";
import { createBiboModel } from "./services/model/bibo-model.service";
import { createBiboEdgeWebTools } from "./services/bibo-edge-web.service";
import { BiboExecutionService } from "./services/bibo-execution.service";
import { BiboWorkspaceFileService } from "./services/bibo-workspace-file.service";
import { BiboWorkspaceStore } from "./stores/bibo-workspace.store";
import { BiboSpaceActionService } from "./services/bibo-edge-space.service";
import { BiboRunError, errorDetails, logDiagnostic, readTrace, runFailure, type RunTrace } from "./diagnostics/bibo-diagnostics.utils";
import { parseBiboSpaceRequest } from "./utils/bibo-space-request.utils";
import { prepareBiboSessionRun, type BiboSession } from "./utils/bibo-session.utils";
import { prepareBiboRun, type PreparedBiboRun } from "./utils/bibo-run-preparation.utils";
export { BiboModelBudget } from "./bibo-model-gateway.service";
export { Sandbox, ContainerProxy } from "@cloudflare/sandbox";

type Message = BiboSession["messages"][number];
type Session = BiboSession;
type PreparedRun = PreparedBiboRun;
type ActiveRun = RunTrace & { id: string; phase: "generating" | "saving"; controller: AbortController; acceptedAt: number;
  finished: Promise<void>; complete: () => void };

export class BiboUserContainer extends DurableObject<Env> {
  private maintenance = false;
  private spaceQueue: Promise<void> = Promise.resolve();
  private sessionChanges: Promise<void> = Promise.resolve();
  private readonly spaceState = new BiboSpaceStateStore(this.ctx.storage, this.env.SNAPSHOTS, this.ctx.id.toString());
  private readonly workspace = new BiboWorkspaceStore(this.env.SNAPSHOTS, this.ctx.id.toString());
  private readonly workspaceFiles = new BiboWorkspaceFileService(this.workspace);
  private readonly spaceActions = new BiboSpaceActionService(this.ctx.storage, this.spaceState, this.workspaceFiles);
  private readonly activeRuns = new Map<string, ActiveRun>();
  private readonly activeSessions = new Map<string, string>();
  private conversation: BiboConversationService | undefined;
  private readonly modelScopes = new Map<string, ReturnType<typeof createBiboModel>>();

  private modelForSession = (sessionId: string | undefined): ReturnType<typeof createBiboModel> => {
    const model = sessionId ? this.modelScopes.get(sessionId) : undefined;
    if (!model) throw new Error("No authenticated model access exists for this session run.");
    return model;
  };

  private getConversation = (): BiboConversationService => this.conversation ??= new BiboConversationService(
    this.ctx.storage, this.spaceActions,
    { generate: (input, options) => this.modelForSession(options?.sessionId).llmApi.generate(input, options) },
    { chat: (input) => this.modelForSession(input.sessionId).summaryProvider.chat(input) },
    this.workspaceFiles, Boolean(this.env.BIBO_EXA_API_KEY),
  );

  private releaseConversation = async (): Promise<void> => {
    const conversation = this.conversation;
    this.conversation = undefined;
    await conversation?.dispose();
  };

  private queueSessionChange = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = this.sessionChanges.then(operation);
    this.sessionChanges = result.then(() => undefined, () => undefined);
    return result;
  };

  override async alarm(): Promise<void> {
    if (this.maintenance || this.activeRuns.size) {
      await this.ctx.storage.setAlarm(Date.now() + 60_000);
      return;
    }
    const execution = new BiboExecutionService(this.env.BIBO_SANDBOX, this.ctx.id.toString(),
      new AbortController().signal, this.workspace, this.ctx.storage);
    this.maintenance = true;
    try { await execution.reclaimExpired(); }
    finally { this.maintenance = false; }
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const route = url.pathname;
    if (route === "/workspace/file" && request.method === "GET") {
      try { return await this.workspaceFiles.download(url.searchParams.get("path")); }
      catch (error) { return publicError(error instanceof Error ? error.message : "文件暂时无法下载。",
        error instanceof BiboSpaceError ? error.status : 500); }
    }
    if (route.startsWith("/sessions") || route === "/history") {
      const mutation = request.method === "POST";
      if (mutation && (this.maintenance || (route !== "/sessions/new" && this.activeRuns.size))) {
        return publicError("Bibo 正在处理另一项操作，请稍后再试。", 429);
      }
      if (mutation) this.maintenance = true;
      try {
        if (mutation && route !== "/sessions/new") await this.releaseConversation();
        return mutation
          ? await this.queueSessionChange(() => biboSessionRoute(request, url, this.ctx.storage))
          : await biboSessionRoute(request, url, this.ctx.storage);
      }
      finally { if (mutation) this.maintenance = false; }
    }
    if (route === "/reset" && request.method === "POST") return this.reset();
    if (route === "/cancel" && request.method === "POST") {
      const body = await request.json().catch(() => null) as { runId?: unknown } | null;
      const active = typeof body?.runId === "string" ? this.activeRuns.get(body.runId) : undefined;
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
    if (this.maintenance || this.activeRuns.size) return publicError("Bibo 正在处理任务，请完成后再清空。", 429);
    this.maintenance = true;
    try {
      await this.spaceQueue;
      await this.releaseConversation();
      const execution = new BiboExecutionService(this.env.BIBO_SANDBOX, this.ctx.id.toString(),
        new AbortController().signal, this.workspace, this.ctx.storage);
      await execution.releaseAll();
      return await resetBiboSessions(this.ctx.storage, this.env.SNAPSHOTS, this.ctx.id.toString());
    } finally { this.maintenance = false; }
  };

  private persistEdgeRun = (payload: PreparedRun, result: BiboEdgeRunResult, edge: BiboConversationService): Promise<Response> => this.queueSessionChange(async () => {
    const sessions = await this.ctx.storage.get<Session[]>("sessions") ?? [];
    const prepared = prepareBiboSessionRun(sessions, payload, { text: result.text, content: result.content, sessionId: payload.session.id,
      displayEvents: result.displayEvents, questions: result.questions }, result.ncpSession.messages);
    const edgeRunCount = await this.ctx.storage.get<number>("edgeRunCount") ?? 0;
    await edge.commit(payload.session.id, { sessions: prepared.sessions, edgeRunCount: edgeRunCount + 1,
      ...(payload.clientRequestId ? { [`edgeRunReceipt:${payload.clientRequestId}`]: { sessionId: payload.session.id } } : {}) });
    return json(prepared.response);
  });

  private space = async (request: Request): Promise<Response> => {
    try {
      const parsed = await parseBiboSpaceRequest(request);
      if (parsed instanceof Response) return parsed;
      const { action, input } = parsed;
      if (this.maintenance) return publicError("Bibo 正在处理另一项操作，请稍后再试。", 429);
      const started = performance.now();
      const result = await this.spaceActions.execute(action, input);
      return json({ result }, 200, { "server-timing": `space;dur=${(performance.now() - started).toFixed(1)}` });
    } catch (error) {
      if (error instanceof BiboSpaceError) return publicError(error.message, error.status);
      logDiagnostic("worker", "space.failed", { ...readTrace(request.headers), ...errorDetails(error), errorCode: "SPACE_FAILED" }, "error");
      return publicError("操作未能保存，请保留内容后重试。", 503);
    }
  };

  private run = async (request: Request): Promise<Response> => {
    const trace = readTrace(request.headers);
    if (this.maintenance) {
      logDiagnostic("worker", "run.rejected", { ...trace, status: 429, errorCode: "RUN_BUSY" }, "warn");
      return publicError("Bibo 正在处理上一条消息，请稍后再试。", 429);
    }
    const streaming = request.headers.get("accept")?.includes("text/event-stream") ?? false;
    let complete!: () => void;
    const finished = new Promise<void>((resolve) => { complete = resolve; });
    const active: ActiveRun = { ...trace, id: trace.runId, phase: "generating", controller: new AbortController(), acceptedAt: Date.now(), finished, complete };
    this.activeRuns.set(active.id, active);
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

  private executeRun = async (request: Request, active: ActiveRun, onDelta?: (text: string) => void, onSaving?: () => void): Promise<Response> => {
    let persisted = false;
    let stage = "prepare";
    const started = Date.now();
    try {
      const payload = await prepareBiboRun(request, this.ctx.storage);
      if (payload instanceof Response) {
        logDiagnostic("worker", "run.rejected", { ...active, stage, status: payload.status, errorCode: "RUN_INVALID_OR_LIMITED" }, "warn");
        return payload;
      }
      active.sessionId = payload.session.id;
      if (this.activeSessions.has(payload.session.id)) {
        return publicError("这个会话仍在处理上一条消息，请等待完成或停止后重试。", 429);
      }
      this.activeSessions.set(payload.session.id, active.id);
      logDiagnostic("worker", "run.started", active);
      if (!payload.userId) throw new BiboRunError("EDGE_INPUT_UNSUPPORTED", 503, "Bibo 暂时无法继续这次会话，请稍后重试。");
      const model = createBiboModel(this.env, payload.userId, active, () =>
        logDiagnostic("worker", "run.model-started", { ...active, durationMs: Date.now() - active.acceptedAt }));
      this.modelScopes.set(payload.session.id, model);
      const edge = this.getConversation();
      const runExecution = new BiboExecutionService(this.env.BIBO_SANDBOX, this.ctx.id.toString(),
        active.controller.signal, this.workspace, this.ctx.storage);
      stage = "generate";
      const timeout = setTimeout(() => active.controller.abort(new BiboRunError("RUN_TIMEOUT", 504, "本次回复超时，已完成的操作仍保留。请查看结果后继续。")), 85_000);
      let firstDelta = true;
      let result: BiboEdgeRunResult;
      try {
        result = await edge.run({ sessionId: payload.session.id, message: payload.message,
          ...(payload.question ? { question: { id: payload.question.id, action: payload.question.action, answer: payload.message } } : {}),
          tools: createBiboEdgeWebTools(this.env, payload.userId, payload.token),
          createTools: () => runExecution.tools(),
          runId: active.id, signal: active.controller.signal,
          onDelta: (delta) => {
            if (firstDelta && delta) { firstDelta = false; logDiagnostic("worker", "run.first-delta", { ...active, durationMs: Date.now() - active.acceptedAt }); }
            onDelta?.(delta);
          } });
      } finally {
        clearTimeout(timeout);
        try { await runExecution.dispose(); }
        catch (error) { logDiagnostic("worker", "run.execution-cleanup-failed",
          { ...active, ...errorDetails(error), errorCode: "EXECUTION_CLEANUP_FAILED" }, "error"); }
      }
      active.phase = "saving";
      stage = "save";
      logDiagnostic("worker", "run.saving", active);
      onSaving?.();
      const saved = await this.persistEdgeRun(payload, result, edge);
      persisted = saved.ok;
      if (!persisted) logDiagnostic("worker", "run.save-failed", { ...active, stage, status: saved.status, errorCode: "RUN_SAVE_FAILED" }, "error");
      return saved;
    } catch (error) {
      const failure = runFailure(error, active.controller.signal.aborted);
      logDiagnostic("worker", "run.failed", { ...active, ...errorDetails(error), stage, status: failure.status, errorCode: failure.code }, "error");
      return json({ error: failure.message, code: failure.code, runId: active.id }, failure.status);
    } finally {
      if (active.sessionId && this.activeSessions.get(active.sessionId) === active.id) {
        this.modelScopes.delete(active.sessionId);
        this.activeSessions.delete(active.sessionId);
      }
      this.finishRun(active, { persisted, stage, started });
    }
  };

  private finishRun = (active: ActiveRun, result: { persisted: boolean; stage: string; started: number }): void => {
    logDiagnostic("worker", "run.finished", { ...active, stage: result.stage, persisted: result.persisted, durationMs: Date.now() - result.started });
    this.activeRuns.delete(active.id);
    active.complete();
  };
}

export default { fetch: biboFetch };
