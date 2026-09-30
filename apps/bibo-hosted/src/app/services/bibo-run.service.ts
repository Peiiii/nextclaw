import type { BiboRunSnapshot, BiboRunState } from "@nextclaw/bibo-client";
import { streamEvent } from "../bibo-run-stream.utils";
import { json, publicError } from "../bibo-auth.utils";
import { BiboRunError, logDiagnostic, runFailure } from "../diagnostics/bibo-diagnostics.utils";

export type BiboActiveRun = { id: string; runId: string; sessionId: string; controller: AbortController;
  acceptedAt: number; phase: "generating" | "saving" };
type Subscriber = { send: (event: string, value: unknown) => void; close: () => void };
type RunRecord = BiboRunSnapshot & { committedMessageCount?: number };
type Run = { state: RunRecord; active?: BiboActiveRun; subscribers: Set<Subscriber>; result?: unknown; completion?: Promise<void>; status?: number };
const running = (state: BiboRunSnapshot) => state.phase === "generating" || state.phase === "saving";
const key = (sessionId: string) => `runState:${sessionId}`;

/** Owns hosted task lifetime. A page is only an observer, never its cancellation authority. */
export class BiboRunService {
  private readonly runs = new Map<string, Run>();
  private admission: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: DurableObjectStorage,
    private readonly waitUntil: (operation: Promise<unknown>) => void,
    private readonly readResult: (run: RunRecord) => Promise<unknown>) {}

  initialize = async (): Promise<void> => {
    const records = await this.storage.list<RunRecord>({ prefix: "runState:" });
    for (const [recordKey, saved] of records) {
      const state: RunRecord = running(saved) ? { ...saved, phase: "failed", updatedAt: Date.now(),
        error: { code: "RUN_INTERRUPTED", message: "服务发生中断，这次任务未能完成。已执行的操作仍保留，请查看结果后继续。" } } : saved;
      if (state !== saved) {
        await this.storage.put(recordKey, state);
        logDiagnostic("worker", "run.interrupted", { runId: state.runId, sessionId: state.sessionId, errorCode: "RUN_INTERRUPTED" }, "error");
      }
      this.runs.set(state.sessionId, { state, subscribers: new Set() });
    }
  };
  get size(): number { return [...this.runs.values()].filter((run) => run.active).length; }
  clear = (): void => { this.runs.clear(); };
  state = (sessionId?: string): BiboRunState => ({
    run: sessionId ? this.runs.get(sessionId)?.state ?? null : null,
    activeRuns: [...this.runs.values()].filter((run) => run.active).map((run) => run.state),
  });
  private find = (runId: string): Run | undefined => [...this.runs.values()].find((run) => run.state.runId === runId);

  start = (input: { runId: string; sessionId: string; message: string; clientRequestId?: string },
    execute: (active: BiboActiveRun) => Promise<Response>): Promise<BiboActiveRun> => {
    const operation = this.admission.then(async () => {
      if (this.runs.get(input.sessionId)?.active) throw new BiboRunError("RUN_BUSY", 429, "这个会话仍在工作，请等待完成或停止任务。");
      const active: BiboActiveRun = { ...input, id: input.runId, phase: "generating", controller: new AbortController(), acceptedAt: Date.now() };
      const run: Run = { state: { ...input, phase: "generating", startedAt: active.acceptedAt,
        updatedAt: active.acceptedAt, partial: "" }, active, subscribers: new Set() };
      await this.storage.put(key(input.sessionId), run.state);
      this.runs.set(input.sessionId, run);
      logDiagnostic("worker", "run.accepted", active);
      run.completion = this.execute(run, active, execute);
      this.waitUntil(run.completion);
      return active;
    });
    this.admission = operation.catch(() => undefined);
    return operation;
  };

  private execute = async (run: Run, active: BiboActiveRun, execute: (active: BiboActiveRun) => Promise<Response>): Promise<void> => {
    try {
      const response = await execute(active);
      const value = await response.json() as { error?: string; code?: string; displayEvents?: unknown[]; messages?: unknown[] };
      if (!response.ok) throw new BiboRunError(value.code ?? "RUN_FAILED", response.status, value.error ?? "这次任务未能完成。");
      run.result = value;
      run.state = { ...run.state, committedMessageCount: value.messages?.length };
      await this.finish(run, "completed");
      for (const event of value.displayEvents ?? []) this.publish(run, "show-content", event);
      this.publish(run, "committed", value);
    } catch (error) {
      const failure = runFailure(error);
      run.status = failure.status;
      run.state = { ...run.state, error: { code: failure.code, message: failure.message } };
      try { await this.finish(run, "failed"); }
      catch { logDiagnostic("worker", "run.status-save-failed", { runId: active.id, sessionId: active.sessionId }, "error"); }
      this.publish(run, "error", { error: failure.message, code: failure.code, runId: active.id });
    } finally {
      run.active = undefined;
      for (const subscriber of run.subscribers) subscriber.close();
      run.subscribers.clear();
      run.result = undefined;
      run.state = { ...run.state, partial: "" };
    }
  };
  private finish = async (run: Run, phase: "completed" | "failed"): Promise<void> => {
    run.state = { ...run.state, phase, updatedAt: Date.now(), activity: undefined };
    await this.storage.put(key(run.state.sessionId), { ...run.state, partial: "" });
  };
  private publish = (run: Run, event: string, value: unknown): void => {
    for (const subscriber of run.subscribers) subscriber.send(event, value);
  };
  delta = (runId: string, text: string): void => {
    const run = this.find(runId);
    if (!run?.active) return;
    run.state = { ...run.state, partial: run.state.partial + text, updatedAt: Date.now() };
    this.publish(run, "delta", { text });
  };
  activity = (runId: string, activity?: string): void => {
    const run = this.find(runId);
    if (!run?.active) return;
    run.state = { ...run.state, activity, updatedAt: Date.now() };
    this.publish(run, "snapshot", run.state);
  };
  saving = async (runId: string): Promise<void> => {
    const run = this.find(runId);
    if (!run?.active) return;
    run.active.phase = "saving";
    run.state = { ...run.state, phase: "saving", activity: undefined, updatedAt: Date.now() };
    await this.storage.put(key(run.state.sessionId), { ...run.state, partial: "" });
    this.publish(run, "saving", {});
  };
  cancel = (runId: string): Response => {
    const run = this.find(runId);
    if (!run?.active) return publicError("这次任务已经结束。", 409);
    if (run.active.phase === "saving") return publicError("回答正在保存，请稍后查看。", 409);
    run.active.controller.abort(new BiboRunError("RUN_CANCELLED", 409, "已停止这次任务，已完成的操作仍保留。"));
    logDiagnostic("worker", "run.cancelled", run.active);
    return json({ ok: true });
  };
  subscribe = (runId: string): Response => {
    const run = this.find(runId);
    if (!run) return publicError("任务不存在。", 404);
    let subscriber: Subscriber;
    let heartbeat: ReturnType<typeof setInterval>;
    let detach = () => {};
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        let closed = false;
        detach = () => { closed = true; clearInterval(heartbeat); run.subscribers.delete(subscriber); };
        subscriber = {
          send: (event, value) => { if (!closed) { try { controller.enqueue(new TextEncoder().encode(streamEvent(event, value))); } catch { detach(); } } },
          close: () => { if (!closed) { detach(); controller.close(); } },
        };
        subscriber.send("snapshot", run.state);
        if (run.active) {
          run.subscribers.add(subscriber);
          heartbeat = setInterval(() => subscriber.send("heartbeat", {}), 15_000);
        } else {
          this.waitUntil((async () => {
            if (run.state.phase === "completed") subscriber.send("committed", run.result ?? await this.readResult(run.state));
            else subscriber.send("error", { error: run.state.error?.message, code: run.state.error?.code, runId });
          })().catch(() => subscriber.send("error", { error: "结果暂时无法加载，请重新连接。" })).finally(subscriber.close));
        }
      },
      cancel: () => {
        detach();
        logDiagnostic("worker", "client.disconnected", { runId, sessionId: run.state.sessionId, stage: run.state.phase });
      },
    });
    return new Response(body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
  };
  result = async (runId: string): Promise<Response> => {
    const run = this.find(runId);
    if (!run) return publicError("任务不存在。", 404);
    await run.completion;
    return run.state.phase === "completed" ? json(run.result ?? await this.readResult(run.state))
      : json({ error: run.state.error?.message, code: run.state.error?.code, runId }, run.status ?? 503);
  };
}
