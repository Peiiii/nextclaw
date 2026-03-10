import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  getDataDir,
  parseAgentScopedSessionKey,
  safeFilename,
  type SessionEvent,
  type SessionManager
} from "@nextclaw/core";
import type {
  ChatRunListView,
  ChatRunState,
  ChatRunView,
  ChatTurnRequest,
  ChatTurnStopRequest,
  ChatTurnStopResult,
  ChatTurnStreamEvent,
  SessionEventView
} from "@nextclaw/server";
import type { GatewayAgentRuntimePool } from "./agent-runtime-pool.js";

type ResolvedTurnRequest = {
  runId: string;
  message: string;
  sessionKey: string;
  agentId?: string;
  model?: string;
  metadata: Record<string, unknown>;
  channel: string;
  chatId: string;
};

type ChatRunRecord = {
  runId: string;
  sessionKey: string;
  agentId?: string;
  model?: string;
  state: ChatRunState;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  stopSupported: boolean;
  stopReason?: string;
  error?: string;
  reply?: string;
  events: ChatTurnStreamEvent[];
  waiters: Set<() => void>;
  abortController: AbortController | null;
  cancelRequested: boolean;
  requestedModel?: string;
};

type PersistedRunRecord = Omit<ChatRunRecord, "waiters" | "abortController" | "cancelRequested">;

type UiChatRunCoordinatorOptions = {
  runtimePool: GatewayAgentRuntimePool;
  sessionManager: SessionManager;
  onRunUpdated?: (run: ChatRunView) => void;
};

const RUNS_DIR = join(getDataDir(), "runs");
const NON_TERMINAL_STATES = new Set<ChatRunState>(["queued", "running"]);
const DEFAULT_SESSION_TYPE = "native";
const SESSION_TYPE_METADATA_KEY = "session_type";

function createRunId(): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `run-${now}-${rand}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return true;
    }
    const message = error.message.toLowerCase();
    if (message.includes("aborted") || message.includes("abort")) {
      return true;
    }
  }
  return false;
}

function cloneEvent<T>(event: T): T {
  return JSON.parse(JSON.stringify(event)) as T;
}

function hasToolSessionEvent(run: ChatRunRecord): boolean {
  for (const item of run.events) {
    if (item.type !== "session_event") {
      continue;
    }
    const message = item.event?.message;
    if (!message || typeof message.role !== "string") {
      continue;
    }
    const role = message.role.trim().toLowerCase();
    if (role === "tool" || role === "tool_result" || role === "toolresult" || role === "function") {
      return true;
    }
    if (role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      return true;
    }
  }
  return false;
}

export class UiChatRunCoordinator {
  private runs = new Map<string, ChatRunRecord>();
  private sessionRuns = new Map<string, Set<string>>();

  constructor(private options: UiChatRunCoordinatorOptions) {
    mkdirSync(RUNS_DIR, { recursive: true });
    this.loadPersistedRuns();
  }

  startRun(input: ChatTurnRequest): ChatRunView {
    const request = this.resolveRequest(input);
    const resolvedSessionType = this.resolveSessionTypeForRun(request.sessionKey, request.metadata);
    request.metadata[SESSION_TYPE_METADATA_KEY] = resolvedSessionType;
    const stopCapability = this.options.runtimePool.supportsTurnAbort({
      sessionKey: request.sessionKey,
      agentId: request.agentId,
      channel: request.channel,
      chatId: request.chatId,
      metadata: request.metadata
    });

    const run: ChatRunRecord = {
      runId: request.runId,
      sessionKey: request.sessionKey,
      ...(request.agentId ? { agentId: request.agentId } : {}),
      ...(request.model ? { model: request.model, requestedModel: request.model } : {}),
      state: "queued",
      requestedAt: new Date().toISOString(),
      stopSupported: stopCapability.supported,
      ...(stopCapability.reason ? { stopReason: stopCapability.reason } : {}),
      events: [],
      waiters: new Set(),
      abortController: null,
      cancelRequested: false
    };

    this.runs.set(run.runId, run);
    this.bindRunToSession(run.sessionKey, run.runId);
    this.syncSessionRunState(run);
    this.persistRun(run);
    this.emitRunUpdated(run);

    void this.executeRun(run, request);
    return this.toRunView(run);
  }

  getRun(params: { runId: string }): ChatRunView | null {
    const run = this.getRunRecord(params.runId);
    return run ? this.toRunView(run) : null;
  }

  listRuns(params: { sessionKey?: string; states?: ChatRunState[]; limit?: number } = {}): ChatRunListView {
    const sessionKey = readOptionalString(params.sessionKey);
    const stateFilter = Array.isArray(params.states) && params.states.length > 0 ? new Set(params.states) : null;
    const limit = Number.isFinite(params.limit) ? Math.max(0, Math.trunc(params.limit as number)) : 0;

    const records = Array.from(this.runs.values())
      .filter((run) => {
        if (sessionKey && run.sessionKey !== sessionKey) {
          return false;
        }
        if (stateFilter && !stateFilter.has(run.state)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => Date.parse(right.requestedAt) - Date.parse(left.requestedAt));

    const total = records.length;
    const runs = (limit > 0 ? records.slice(0, limit) : records).map((run) => this.toRunView(run));
    return { runs, total };
  }

  async *streamRun(params: {
    runId: string;
    fromEventIndex?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<ChatTurnStreamEvent> {
    const run = this.getRunRecord(params.runId);
    if (!run) {
      throw new Error(`chat run not found: ${params.runId}`);
    }

    let cursor = Number.isFinite(params.fromEventIndex)
      ? Math.max(0, Math.trunc(params.fromEventIndex as number))
      : 0;
    while (true) {
      while (cursor < run.events.length) {
        yield cloneEvent(run.events[cursor]);
        cursor += 1;
      }

      if (!NON_TERMINAL_STATES.has(run.state)) {
        return;
      }
      if (params.signal?.aborted) {
        return;
      }
      await this.waitForRunUpdate(run, params.signal);
    }
  }

  async stopRun(params: ChatTurnStopRequest): Promise<ChatTurnStopResult> {
    const runId = readOptionalString(params.runId) ?? "";
    if (!runId) {
      return {
        stopped: false,
        runId: "",
        reason: "runId is required"
      };
    }

    const run = this.getRunRecord(runId);
    if (!run) {
      return {
        stopped: false,
        runId,
        ...(readOptionalString(params.sessionKey) ? { sessionKey: readOptionalString(params.sessionKey) } : {}),
        reason: "run not found or already completed"
      };
    }

    const requestedSessionKey = readOptionalString(params.sessionKey);
    if (requestedSessionKey && requestedSessionKey !== run.sessionKey) {
      return {
        stopped: false,
        runId,
        sessionKey: run.sessionKey,
        reason: "session key mismatch"
      };
    }

    if (!run.stopSupported) {
      return {
        stopped: false,
        runId,
        sessionKey: run.sessionKey,
        reason: run.stopReason ?? "run stop is not supported"
      };
    }

    if (!NON_TERMINAL_STATES.has(run.state)) {
      return {
        stopped: false,
        runId,
        sessionKey: run.sessionKey,
        reason: `run already ${run.state}`
      };
    }

    run.cancelRequested = true;
    this.finalizeRunAsStopped(run);
    if (run.abortController) {
      run.abortController.abort(new Error("chat turn stopped by user"));
    }

    return {
      stopped: true,
      runId,
      sessionKey: run.sessionKey
    };
  }

  private resolveRequest(input: ChatTurnRequest): ResolvedTurnRequest {
    const message = readOptionalString(input.message) ?? "";
    const sessionKey =
      readOptionalString(input.sessionKey) ??
      `ui:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
    const explicitAgentId = readOptionalString(input.agentId);
    const parsedAgentId = parseAgentScopedSessionKey(sessionKey)?.agentId;
    const agentId = explicitAgentId ?? readOptionalString(parsedAgentId);
    const model = readOptionalString(input.model);

    const metadata = isRecord(input.metadata) ? { ...input.metadata } : {};
    if (model) {
      metadata.model = model;
    }

    const runId = readOptionalString(input.runId) ?? createRunId();
    return {
      runId,
      message,
      sessionKey,
      ...(agentId ? { agentId } : {}),
      ...(model ? { model } : {}),
      metadata,
      channel: readOptionalString(input.channel) ?? "ui",
      chatId: readOptionalString(input.chatId) ?? "web-ui"
    };
  }

  private readRequestedSessionType(metadata: Record<string, unknown>): string | undefined {
    const value = readOptionalString(metadata.session_type) ?? readOptionalString(metadata.sessionType);
    return value ? value.toLowerCase() : undefined;
  }

  private readStoredSessionType(metadata: Record<string, unknown>): string {
    const value = readOptionalString(metadata[SESSION_TYPE_METADATA_KEY]);
    return value ? value.toLowerCase() : DEFAULT_SESSION_TYPE;
  }

  private countUserMessages(session: { messages: Array<{ role?: unknown }> }): number {
    return session.messages.reduce((count, message) => {
      const role = typeof message.role === "string" ? message.role.trim().toLowerCase() : "";
      return role === "user" ? count + 1 : count;
    }, 0);
  }

  private ensureSessionTypeAvailable(sessionType: string): void {
    const available = new Set(this.options.runtimePool.listAvailableEngineKinds());
    available.add(DEFAULT_SESSION_TYPE);
    if (!available.has(sessionType)) {
      throw new Error(
        `session type "${sessionType}" is unavailable. Re-enable the related plugin or create a native session.`
      );
    }
  }

  private resolveSessionTypeForRun(sessionKey: string, metadata: Record<string, unknown>): string {
    const requestedType = this.readRequestedSessionType(metadata);
    const session = this.options.sessionManager.getOrCreate(sessionKey);
    const storedType = this.readStoredSessionType(session.metadata);
    const userMessageCount = this.countUserMessages(session);
    const locked = userMessageCount > 0;

    if (locked) {
      if (requestedType && requestedType !== storedType) {
        throw new Error(
          `session type is locked to "${storedType}" after the first user message; create a new session to switch type`
        );
      }
      this.ensureSessionTypeAvailable(storedType);
      if (session.metadata[SESSION_TYPE_METADATA_KEY] !== storedType) {
        session.metadata[SESSION_TYPE_METADATA_KEY] = storedType;
        session.updatedAt = new Date();
        this.options.sessionManager.save(session);
      }
      return storedType;
    }

    const nextType = requestedType ?? storedType;
    this.ensureSessionTypeAvailable(nextType);
    if (session.metadata[SESSION_TYPE_METADATA_KEY] !== nextType) {
      session.metadata[SESSION_TYPE_METADATA_KEY] = nextType;
      session.updatedAt = new Date();
      this.options.sessionManager.save(session);
    }
    return nextType;
  }

  private async executeRun(run: ChatRunRecord, request: ResolvedTurnRequest): Promise<void> {
    if (run.cancelRequested) {
      this.finalizeRunAsStopped(run);
      return;
    }

    this.transitionState(run, "running");
    const abortController = run.stopSupported ? new AbortController() : null;
    run.abortController = abortController;
    const assistantDeltaParts: string[] = [];

    try {
      const reply = await this.options.runtimePool.processDirect({
        content: request.message,
        sessionKey: request.sessionKey,
        channel: request.channel,
        chatId: request.chatId,
        agentId: request.agentId,
        metadata: request.metadata,
        ...(abortController ? { abortSignal: abortController.signal } : {}),
        onAssistantDelta: (delta) => {
          if (run.cancelRequested) {
            return;
          }
          if (typeof delta !== "string" || delta.length === 0) {
            return;
          }
          assistantDeltaParts.push(delta);
          this.pushStreamEvent(run, { type: "delta", delta });
        },
        onSessionEvent: (event) => {
          if (run.cancelRequested) {
            return;
          }
          this.pushStreamEvent(run, {
            type: "session_event",
            event: this.mapSessionEvent(event)
          });
        }
      });

      if (run.cancelRequested) {
        this.finalizeRunAsStopped(run);
        return;
      }

      this.pushStreamEvent(run, {
        type: "final",
        result: {
          reply,
          sessionKey: request.sessionKey,
          ...(request.agentId ? { agentId: request.agentId } : {}),
          ...(request.model ? { model: request.model } : {})
        }
      });
      run.reply = reply;
      this.transitionState(run, "completed");
    } catch (error) {
      const aborted = (abortController?.signal.aborted ?? false) || isAbortError(error);
      if (aborted) {
        if (run.cancelRequested) {
          this.finalizeRunAsStopped(run);
          return;
        }
        const partialReply = assistantDeltaParts.join("");
        const shouldPersistPartialReply = partialReply.trim().length > 0 && !hasToolSessionEvent(run);
        if (shouldPersistPartialReply) {
          this.persistAbortedAssistantReply(run.sessionKey, partialReply);
        }
        this.pushStreamEvent(run, {
          type: "final",
          result: {
            reply: partialReply,
            sessionKey: request.sessionKey,
            ...(request.agentId ? { agentId: request.agentId } : {}),
            ...(request.model ? { model: request.model } : {})
          }
        });
        run.reply = partialReply;
        this.transitionState(run, "aborted", {
          error:
            abortController?.signal.reason instanceof Error
              ? abortController.signal.reason.message
              : readOptionalString(abortController?.signal.reason)
        });
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.pushStreamEvent(run, {
        type: "error",
        error: errorMessage
      });
      this.transitionState(run, "failed", { error: errorMessage });
    } finally {
      run.abortController = null;
      this.persistRun(run);
      this.notifyRunWaiters(run);
    }
  }

  private transitionState(run: ChatRunRecord, next: ChatRunState, options: { error?: string } = {}): void {
    run.state = next;
    if (next === "running") {
      run.startedAt = new Date().toISOString();
    }
    if (!NON_TERMINAL_STATES.has(next)) {
      run.completedAt = new Date().toISOString();
    }
    if (options.error) {
      run.error = options.error;
    } else if (next === "completed") {
      run.error = undefined;
    }

    this.syncSessionRunState(run);
    this.persistRun(run);
    this.emitRunUpdated(run);
    this.notifyRunWaiters(run);
  }

  private finalizeRunAsStopped(run: ChatRunRecord): void {
    const partialReply = this.collectAssistantReplyFromEvents(run.events);
    if (!this.hasFinalStreamEvent(run.events)) {
      this.pushStreamEvent(run, {
        type: "final",
        result: {
          reply: partialReply,
          sessionKey: run.sessionKey,
          ...(run.agentId ? { agentId: run.agentId } : {}),
          ...(run.model ? { model: run.model } : {})
        }
      });
    }
    run.reply = partialReply;
    const shouldPersistPartialReply = partialReply.trim().length > 0 && !hasToolSessionEvent(run);
    if (shouldPersistPartialReply) {
      this.persistAbortedAssistantReply(run.sessionKey, partialReply);
    }
    if (run.state !== "aborted") {
      this.transitionState(run, "aborted", {
        error: "chat turn stopped by user"
      });
    }
  }

  private hasFinalStreamEvent(events: ChatTurnStreamEvent[]): boolean {
    return events.some((event) => event.type === "final");
  }

  private collectAssistantReplyFromEvents(events: ChatTurnStreamEvent[]): string {
    const chunks: string[] = [];
    for (const event of events) {
      if (event.type === "delta" && event.delta.length > 0) {
        chunks.push(event.delta);
      }
    }
    return chunks.join("");
  }

  private pushStreamEvent(run: ChatRunRecord, event: ChatTurnStreamEvent): void {
    run.events.push(event);
    this.persistRun(run);
    this.notifyRunWaiters(run);
    this.emitRunUpdated(run);
  }

  private waitForRunUpdate(run: ChatRunRecord, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const wake = () => {
        cleanup();
        resolve();
      };
      const onAbort = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        run.waiters.delete(wake);
        signal?.removeEventListener("abort", onAbort);
      };
      run.waiters.add(wake);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  private notifyRunWaiters(run: ChatRunRecord): void {
    if (run.waiters.size === 0) {
      return;
    }
    const waiters = Array.from(run.waiters);
    run.waiters.clear();
    for (const wake of waiters) {
      wake();
    }
  }

  private bindRunToSession(sessionKey: string, runId: string): void {
    const existing = this.sessionRuns.get(sessionKey);
    if (existing) {
      existing.add(runId);
      return;
    }
    this.sessionRuns.set(sessionKey, new Set([runId]));
  }

  private syncSessionRunState(run: ChatRunRecord): void {
    const session = this.options.sessionManager.getOrCreate(run.sessionKey);
    const metadata = session.metadata;
    metadata.ui_last_run_id = run.runId;
    metadata.ui_last_run_state = run.state;
    metadata.ui_last_run_updated_at = new Date().toISOString();
    if (NON_TERMINAL_STATES.has(run.state)) {
      metadata.ui_active_run_id = run.runId;
      metadata.ui_run_state = run.state;
      metadata.ui_run_requested_at = run.requestedAt;
      if (run.startedAt) {
        metadata.ui_run_started_at = run.startedAt;
      }
    } else if (metadata.ui_active_run_id === run.runId) {
      delete metadata.ui_active_run_id;
      delete metadata.ui_run_state;
      delete metadata.ui_run_requested_at;
      delete metadata.ui_run_started_at;
    }
    session.updatedAt = new Date();
    this.options.sessionManager.save(session);
  }

  private persistAbortedAssistantReply(sessionKey: string, partialReply: string): void {
    const session = this.options.sessionManager.getOrCreate(sessionKey);
    const latest = session.messages.length > 0 ? session.messages[session.messages.length - 1] : null;
    if (latest?.role === "assistant" && typeof latest.content === "string" && latest.content === partialReply) {
      return;
    }
    this.options.sessionManager.addMessage(session, "assistant", partialReply);
    this.options.sessionManager.save(session);
  }

  private mapSessionEvent(event: SessionEvent): SessionEventView {
    const raw = event.data?.message;
    const messageRecord = raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
    const message = messageRecord && typeof messageRecord.role === "string"
      ? {
          role: messageRecord.role,
          content: messageRecord.content,
          timestamp: typeof messageRecord.timestamp === "string" ? messageRecord.timestamp : event.timestamp,
          ...(typeof messageRecord.name === "string" ? { name: messageRecord.name } : {}),
          ...(typeof messageRecord.tool_call_id === "string" ? { tool_call_id: messageRecord.tool_call_id } : {}),
          ...(Array.isArray(messageRecord.tool_calls)
            ? { tool_calls: messageRecord.tool_calls as Array<Record<string, unknown>> }
            : {}),
          ...(typeof messageRecord.reasoning_content === "string"
            ? { reasoning_content: messageRecord.reasoning_content }
            : {})
        }
      : undefined;

    return {
      seq: event.seq,
      type: event.type,
      timestamp: event.timestamp,
      ...(message ? { message } : {})
    };
  }

  private emitRunUpdated(run: ChatRunRecord): void {
    this.options.onRunUpdated?.(this.toRunView(run));
  }

  private toRunView(run: ChatRunRecord): ChatRunView {
    return {
      runId: run.runId,
      sessionKey: run.sessionKey,
      ...(run.agentId ? { agentId: run.agentId } : {}),
      ...(run.model ? { model: run.model } : {}),
      state: run.state,
      requestedAt: run.requestedAt,
      ...(run.startedAt ? { startedAt: run.startedAt } : {}),
      ...(run.completedAt ? { completedAt: run.completedAt } : {}),
      stopSupported: run.stopSupported,
      ...(run.stopReason ? { stopReason: run.stopReason } : {}),
      ...(run.error ? { error: run.error } : {}),
      ...(typeof run.reply === "string" ? { reply: run.reply } : {}),
      eventCount: run.events.length
    };
  }

  private getRunPath(runId: string): string {
    return join(RUNS_DIR, `${safeFilename(runId)}.json`);
  }

  private persistRun(run: ChatRunRecord): void {
    const persisted: PersistedRunRecord = {
      runId: run.runId,
      sessionKey: run.sessionKey,
      ...(run.agentId ? { agentId: run.agentId } : {}),
      ...(run.model ? { model: run.model } : {}),
      state: run.state,
      requestedAt: run.requestedAt,
      ...(run.startedAt ? { startedAt: run.startedAt } : {}),
      ...(run.completedAt ? { completedAt: run.completedAt } : {}),
      stopSupported: run.stopSupported,
      ...(run.stopReason ? { stopReason: run.stopReason } : {}),
      ...(run.error ? { error: run.error } : {}),
      ...(typeof run.reply === "string" ? { reply: run.reply } : {}),
      events: run.events
    };
    writeFileSync(this.getRunPath(run.runId), `${JSON.stringify(persisted, null, 2)}\n`);
  }

  private loadPersistedRuns(): void {
    if (!existsSync(RUNS_DIR)) {
      return;
    }

    for (const entry of readdirSync(RUNS_DIR, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }
      const path = join(RUNS_DIR, entry.name);
      try {
        const parsed = JSON.parse(readFileSync(path, "utf-8")) as Partial<PersistedRunRecord>;
        const runId = readOptionalString(parsed.runId);
        const sessionKey = readOptionalString(parsed.sessionKey);
        if (!runId || !sessionKey) {
          continue;
        }

        const state = this.normalizeRunState(parsed.state);
        const events = Array.isArray(parsed.events) ? parsed.events : [];
        const run: ChatRunRecord = {
          runId,
          sessionKey,
          ...(readOptionalString(parsed.agentId) ? { agentId: readOptionalString(parsed.agentId) } : {}),
          ...(readOptionalString(parsed.model) ? { model: readOptionalString(parsed.model) } : {}),
          state,
          requestedAt: readOptionalString(parsed.requestedAt) ?? new Date().toISOString(),
          ...(readOptionalString(parsed.startedAt) ? { startedAt: readOptionalString(parsed.startedAt) } : {}),
          ...(readOptionalString(parsed.completedAt) ? { completedAt: readOptionalString(parsed.completedAt) } : {}),
          stopSupported: Boolean(parsed.stopSupported),
          ...(readOptionalString(parsed.stopReason) ? { stopReason: readOptionalString(parsed.stopReason) } : {}),
          ...(readOptionalString(parsed.error) ? { error: readOptionalString(parsed.error) } : {}),
          ...(typeof parsed.reply === "string" ? { reply: parsed.reply } : {}),
          events: events as ChatTurnStreamEvent[],
          waiters: new Set(),
          abortController: null,
          cancelRequested: false
        };

        if (NON_TERMINAL_STATES.has(run.state)) {
          run.state = "failed";
          run.error = run.error ?? "run interrupted by service restart";
          run.completedAt = new Date().toISOString();
          this.persistRun(run);
        }

        this.runs.set(run.runId, run);
        this.bindRunToSession(run.sessionKey, run.runId);
      } catch {
        // ignore malformed run snapshots
      }
    }
  }

  private normalizeRunState(value: unknown): ChatRunState {
    if (value === "queued" || value === "running" || value === "completed" || value === "failed" || value === "aborted") {
      return value;
    }
    return "failed";
  }

  private getRunRecord(runId: string): ChatRunRecord | null {
    const normalized = readOptionalString(runId);
    if (!normalized) {
      return null;
    }
    return this.runs.get(normalized) ?? null;
  }
}
