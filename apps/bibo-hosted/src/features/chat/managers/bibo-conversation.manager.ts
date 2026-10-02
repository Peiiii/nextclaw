import { createStore, type StoreApi } from "zustand/vanilla";
import { BiboClientError, appendBiboTextBlock, type BiboClient, type BiboChatEvent, type BiboRunSnapshot, type BiboSession } from "@nextclaw/bibo-client";
import type { BiboDisplayMessage } from "@/features/chat/utils/chat-message.utils";

type QuestionInput = { id: string; title: string; action: "answer" | "dismiss" };
export type BiboSubmission = {
  sessionId: string | null; message: string; clientRequestId?: string; previousLastAt?: string;
  question?: QuestionInput; questionId?: string; submittedAt?: number;
};
type MessageIds = [string, string];
type ConversationState = {
  run: BiboRunSnapshot | null;
  submission: BiboSubmission | null;
  connection: "checking" | "ready" | "reconnecting";
  starting: boolean;
  stopping: boolean;
  messageIds: MessageIds | null;
};
type Results = {
  created: (session: BiboSession) => void;
  confirmed: (submission: BiboSubmission) => void;
  committed: (result: Extract<BiboChatEvent, { name: "committed" }>["value"], sessionId: string, messageIds: MessageIds | null, message: string) => void;
  failed: (submission: BiboSubmission, error: unknown) => void;
  content: (value: Extract<BiboChatEvent, { name: "show-content" }>["value"]) => void;
};
const idle = (): ConversationState => ({ run: null, submission: null, connection: "ready", starting: false, stopping: false, messageIds: null });
const active = (run: BiboRunSnapshot | null) => run?.phase === "generating" || run?.phase === "saving";

export function conversationView(state: ConversationState) {
  const { run, submission, connection, starting, stopping } = state;
  const phase = stopping ? "stopping" : starting ? "generating" : run?.phase === "generating" ? "generating"
    : run?.phase === "saving" || run?.phase === "completed" ? "saving" : "idle";
  return {
    phase, connection, busy: phase !== "idle" || connection !== "ready", recovering: connection !== "ready",
    runId: run?.runId ?? null, runSessionId: run?.sessionId ?? submission?.sessionId ?? null,
    runStartedAt: run?.startedAt ?? Infinity, partial: run?.partial ?? "", activity: run?.activity ?? null,
    pendingMessage: run?.message ?? submission?.message ?? null, pendingIds: state.messageIds,
    pendingQuestion: submission?.question ? { id: submission.question.id, title: submission.question.title,
      action: submission.question.action === "answer" ? "answered" as const : "dismissed" as const } : null,
  } as const;
}

/** Owns the browser's task projection and read connection. Only the server owns execution. */
export class BiboConversationManager {
  private readonly stateStore = createStore<ConversationState>(() => ({ ...idle(), connection: "checking" }));
  readonly store: Pick<StoreApi<ConversationState>, "getState" | "getInitialState" | "subscribe"> = this.stateStore;
  private accountId: string | null = null;
  private selectedSessionId?: string;
  private generation = 0;
  private controller?: AbortController;
  private querying?: Promise<void>;
  private retry?: ReturnType<typeof setTimeout>;
  private failures = 0;
  private retained: BiboSubmission | null = null;
  private sendError?: unknown;
  private reportedUnconfirmed = false;
  private readonly settled = new Set<string>();

  constructor(private readonly client: BiboClient, private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, private readonly results: Results) {}

  get view() { return conversationView(this.stateStore.getState()); }

  displayMessages = (history: BiboDisplayMessage[], sessionId: string | null): BiboDisplayMessage[] => {
    const { pendingIds, pendingMessage, pendingQuestion, partial, runSessionId, runStartedAt } = this.view;
    if (sessionId !== runSessionId || !pendingIds || !pendingMessage) return history;
    const { run, submission } = this.stateStore.getState();
    const timestamp = run?.startedAt ?? submission?.submittedAt;
    const at = timestamp === undefined ? "" : new Date(timestamp).toISOString();
    const blocks = run?.partialBlocks ?? (partial ? [{ id: "answer", text: partial }] : []);
    return [...history.filter((message) => Date.parse(message.at) < runStartedAt),
      { id: pendingIds[0], role: "user", text: pendingMessage, at, pending: true, ...(pendingQuestion ? { replyToQuestion: pendingQuestion } : {}) },
      { id: pendingIds[1], role: "assistant", text: partial, content: blocks.map(block => ({ type: "text" as const, text: block.text })), at, pending: true }];
  };

  bindAccount = (accountId: string | null): void => {
    if (this.accountId === accountId) return;
    this.dispose();
    this.accountId = accountId;
    if (accountId) {
      try {
        const value: unknown = JSON.parse(this.storage.getItem(this.pendingKey()) ?? "null");
        if (value && typeof value === "object") {
          const { message, sessionId, clientRequestId, previousLastAt, questionId, question, submittedAt } = value as Record<string, unknown>;
          if (typeof message === "string" && (typeof sessionId === "string" || sessionId === null) && typeof clientRequestId === "string") {
            const input = question && typeof question === "object" ? question as Record<string, unknown> : null;
            this.retained = { message, sessionId, clientRequestId,
              ...(typeof submittedAt === "number" && Number.isFinite(submittedAt) ? { submittedAt } : {}),
              ...(typeof previousLastAt === "string" ? { previousLastAt } : {}), ...(typeof questionId === "string" ? { questionId } : {}),
              ...(input && typeof input.id === "string" && typeof input.title === "string" && (input.action === "answer" || input.action === "dismiss")
                ? { question: { id: input.id, title: input.title, action: input.action } } : {}),
            };
          }
        }
      } catch { /* A local receipt is optional, never evidence of task failure. */ }
      this.stateStore.setState({ connection: "checking" });
    }
  };
  private pendingKey = () => `bibo-pending-${this.accountId}`;
  private retain = (submission: BiboSubmission | null): void => {
    this.retained = submission;
    if (!this.accountId) return;
    try {
      if (submission) this.storage.setItem(this.pendingKey(), JSON.stringify(submission));
      else this.storage.removeItem(this.pendingKey());
    } catch { /* In-memory input remains available when browser storage is unavailable. */ }
  };
  private clearConnection = (): number => {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    clearTimeout(this.retry);
    this.retry = undefined;
    this.querying = undefined;
    return this.generation;
  };
  dispose = (options?: { discardInput?: boolean }): void => {
    if (options?.discardInput) this.retain(null);
    this.clearConnection();
    this.accountId = null;
    this.selectedSessionId = undefined;
    this.retained = null;
    this.sendError = undefined;
    this.reportedUnconfirmed = false;
    this.failures = 0;
    this.settled.clear();
    this.stateStore.setState(idle());
  };

  connect = (sessionId?: string): Promise<void> => {
    const changed = this.selectedSessionId !== sessionId;
    this.selectedSessionId = sessionId;
    if (this.stateStore.getState().starting && !this.stateStore.getState().submission?.sessionId) return Promise.resolve();
    if (this.controller && active(this.stateStore.getState().run)) return Promise.resolve();
    if (changed && !active(this.stateStore.getState().run)) this.clearConnection();
    return this.reconnect();
  };
  reconnect = (): Promise<void> => {
    if (!this.accountId) return Promise.resolve();
    if (this.stateStore.getState().starting && !this.stateStore.getState().submission?.sessionId) return Promise.resolve();
    if (this.querying) return this.querying;
    const generation = this.clearConnection();
    this.stateStore.setState({ connection: this.stateStore.getState().run ? "reconnecting" : "checking" });
    const sessionId = this.retained?.sessionId ?? this.stateStore.getState().run?.sessionId ?? this.selectedSessionId;
    const operation = (async () => {
      try {
        const state = await this.client.runState(sessionId);
        if (generation !== this.generation) return;
        const matching = this.retained?.clientRequestId ? [...state.activeRuns, ...(state.run ? [state.run] : [])]
          .find((run) => run.clientRequestId === this.retained?.clientRequestId) : undefined;
        const run = matching ?? state.activeRuns.find((run) => run.sessionId === sessionId) ?? state.activeRuns[0] ?? state.run;
        if (this.retained && !matching) {
          if (!this.reportedUnconfirmed) this.results.failed(this.retained, this.sendError ?? new BiboClientError("这条消息未得到接收确认，输入已保留。"));
          this.reportedUnconfirmed = true;
          this.stateStore.setState({ submission: null, starting: false });
          // A previous completed task cannot stand in for the unaccepted submission.
          if (!active(run)) { this.stateStore.setState(idle()); return; }
        }
        this.stateStore.setState({ connection: "ready", starting: false });
        if (!run || this.settled.has(run.runId)) { this.stateStore.setState(idle()); return; }
        this.snapshot(run);
        if (run.phase === "failed") this.fail(run);
        else void this.listen(generation, (signal, event) => this.client.resumeRun(run.runId, event, signal));
      } catch (error) {
        if (generation !== this.generation) return;
        if (error instanceof BiboClientError && error.status === 401) {
          if (this.retained) this.results.failed(this.retained, error);
          this.stateStore.setState(idle());
          return;
        }
        this.stateStore.setState({ connection: "reconnecting" });
        this.scheduleRetry();
      }
    })();
    const tracked = operation.finally(() => { if (this.querying === tracked) this.querying = undefined; });
    this.querying = tracked;
    return tracked;
  };

  private snapshot = (run: BiboRunSnapshot): void => {
    const previous = this.stateStore.getState();
    if (this.reportedUnconfirmed && this.retained && this.retained.clientRequestId === run.clientRequestId) {
      this.results.confirmed(this.retained);
      this.reportedUnconfirmed = false;
    }
    this.stateStore.setState({ run, starting: false, stopping: previous.run?.runId === run.runId && previous.stopping && run.phase === "generating",
      submission: this.retained?.clientRequestId === run.clientRequestId ? this.retained : null,
      messageIds: previous.messageIds && (previous.run?.runId === run.runId || previous.submission?.clientRequestId === run.clientRequestId)
        ? previous.messageIds : [crypto.randomUUID(), crypto.randomUUID()] });
  };
  private fail = (run: BiboRunSnapshot): void => {
    if (!this.settled.has(run.runId)) {
      this.settled.add(run.runId);
      this.results.failed(this.stateStore.getState().submission ?? { sessionId: run.sessionId, message: run.message },
        new BiboClientError(run.error?.message ?? "这次任务未能完成。"));
    }
    if (this.retained?.clientRequestId === run.clientRequestId) this.retain(null);
    this.stateStore.setState(idle());
  };
  private scheduleRetry = (): void => {
    clearTimeout(this.retry);
    this.failures++;
    this.retry = setTimeout(() => { void this.reconnect(); }, Math.min(15_000, 1000 * 2 ** Math.min(4, this.failures - 1)));
  };
  private listen = async (generation: number, operation: (signal: AbortSignal, event: (event: BiboChatEvent) => void) => Promise<void>): Promise<void> => {
    const controller = new AbortController();
    this.controller = controller;
    const contents = new Map<string, Extract<BiboChatEvent, { name: "show-content" }>["value"]>();
    try {
      await operation(controller.signal, (event) => {
        if (generation !== this.generation) return;
        const { run, submission, messageIds } = this.stateStore.getState();
        this.stateStore.setState({ connection: "ready" });
        if (event.name === "snapshot") this.snapshot(event.value);
        if (event.name === "accepted" && submission?.sessionId && run?.runId !== event.value.runId) {
          const now = Date.now();
          this.stateStore.setState({ run: { runId: event.value.runId, sessionId: submission.sessionId, message: submission.message,
            phase: "generating", startedAt: now, updatedAt: now, partial: "", clientRequestId: submission.clientRequestId }, starting: false });
        }
        if (event.name === "delta" && run) {
          this.failures = 0;
          const blocks = appendBiboTextBlock(run.partialBlocks ?? (run.partial ? [{ id: "answer", text: run.partial }] : []), event.value.text, event.value.blockId);
          this.stateStore.setState({ run: { ...run, partialBlocks: blocks, partial: blocks.map(block => block.text).join("\n\n") } });
        }
        if (event.name === "saving" && run) this.stateStore.setState({ run: { ...run, phase: "saving", activity: undefined }, stopping: false });
        if (event.name === "show-content") contents.set(event.value.id, event.value);
        if (event.name === "committed" && (run || submission?.sessionId) && (!run || !this.settled.has(run.runId))) {
          if (run) this.settled.add(run.runId);
          this.failures = 0;
          if (!run || this.retained?.clientRequestId === run.clientRequestId) this.retain(null);
          this.results.committed(event.value, run?.sessionId ?? submission!.sessionId!, messageIds, run?.message ?? submission!.message);
          for (const shown of contents.values()) this.results.content(shown);
          this.stateStore.setState(idle());
        }
      });
    } catch (error) {
      if (generation !== this.generation) return;
      this.sendError = error;
      this.stateStore.setState({ connection: "reconnecting", starting: false });
      // Transport errors are not task failures. Read the authority before returning input.
      if (this.failures === 0 && !this.querying) { this.failures++; void this.reconnect(); }
      else this.scheduleRetry();
    } finally {
      if (generation === this.generation && this.controller === controller) this.controller = undefined;
    }
  };

  send = async (input: Omit<BiboSubmission, "clientRequestId" | "submittedAt">): Promise<void> => {
    if (!this.accountId || this.view.busy || !input.message.trim()) return;
    const generation = this.clearConnection();
    this.sendError = undefined;
    this.failures = 0;
    this.reportedUnconfirmed = false;
    const previous = this.retained;
    const sameUnconfirmed = previous?.message === input.message.trim() && previous.sessionId === input.sessionId &&
      previous.previousLastAt === input.previousLastAt && (previous.question?.id ?? previous.questionId) === input.question?.id;
    let submission: BiboSubmission = { ...input, message: input.message.trim(),
      clientRequestId: sameUnconfirmed && previous?.clientRequestId ? previous.clientRequestId : crypto.randomUUID(),
      submittedAt: sameUnconfirmed && previous?.submittedAt ? previous.submittedAt : Date.now() };
    this.retain(submission);
    this.stateStore.setState({ starting: true, submission, messageIds: [crypto.randomUUID(), crypto.randomUUID()] });
    if (!submission.sessionId) {
      try {
        const session = await this.client.createSession();
        if (generation !== this.generation) return;
        submission = { ...submission, sessionId: session.id };
        this.retain(submission);
        this.stateStore.setState({ submission });
        this.results.created(session);
      } catch (error) {
        if (generation !== this.generation) return;
        this.results.failed(submission, error);
        this.stateStore.setState(idle());
        return;
      }
    }
    this.retain(submission);
    await this.listen(generation, (signal, event) => this.client.chat(submission.message, event, submission.sessionId!,
      submission.question, submission.clientRequestId, signal));
  };

  stop = async (): Promise<void> => {
    const { run, connection, stopping } = this.stateStore.getState();
    if (!run?.runId || run.phase !== "generating" || connection !== "ready" || stopping) return;
    const generation = this.generation;
    this.stateStore.setState({ stopping: true });
    try { await this.client.cancel(run.runId); }
    catch (error) {
      if (generation !== this.generation || this.stateStore.getState().run?.runId !== run.runId) return;
      // Cancellation may have reached the server despite the lost response.
      this.sendError = error;
      this.stateStore.setState({ stopping: false });
      void this.reconnect();
      throw error;
    }
  };
}
