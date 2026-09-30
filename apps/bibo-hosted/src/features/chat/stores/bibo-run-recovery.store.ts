import { BiboClientError, type BiboClient, type BiboChatEvent, type BiboRunSnapshot, type BiboRunState } from "@nextclaw/bibo-client";

type Observer = {
  event: (event: BiboChatEvent) => void;
  snapshot: (run: BiboRunSnapshot) => void;
  idle: () => void;
  connection: (recovering: boolean) => void;
  failure: (error: unknown) => void;
};

/** Owns the read connection and its recovery, never the server task or chat history. */
export class BiboRunRecoveryStore {
  private generation = 0;
  private controller?: AbortController;
  private syncing?: Promise<void>;
  private retry?: ReturnType<typeof setTimeout>;
  private failures = 0;
  private sessionId?: string;
  private connected = false;
  private unconfirmed?: { clientRequestId: string; error?: unknown };
  constructor(private readonly client: BiboClient, private readonly observer: Observer) {}

  private clearConnection = (): number => {
    this.generation += 1;
    this.controller?.abort();
    this.controller = undefined;
    this.connected = false;
    clearTimeout(this.retry);
    return this.generation;
  };
  dispose = (): void => { this.clearConnection(); this.syncing = undefined; this.sessionId = undefined; this.unconfirmed = undefined; };

  private listen = async (generation: number, operation: (signal: AbortSignal, onEvent: (event: BiboChatEvent) => void) => Promise<void>): Promise<void> => {
    const controller = new AbortController();
    this.controller = controller;
    this.connected = true;
    let committed = false;
    try {
      await operation(controller.signal, (event) => {
        if (generation !== this.generation) return;
        if (event.name === "delta" || event.name === "committed") this.failures = 0;
        this.observer.connection(false);
        if (event.name === "snapshot") { this.unconfirmed = undefined; this.observer.snapshot(event.value); }
        if (event.name === "accepted") this.unconfirmed = undefined;
        this.observer.event(event);
        if (event.name === "committed") committed = true;
      });
      if (generation !== this.generation) return;
      if (committed) this.observer.idle();
    } catch (error) {
      if (generation !== this.generation) return;
      if (this.unconfirmed) this.unconfirmed.error = error;
      // Read the authority even for an SSE error: the task may have finished or still be working.
      this.connected = false;
      this.observer.connection(true);
      if (this.failures === 0) { this.failures++; await this.sync(this.sessionId); }
      else this.scheduleRetry();
    } finally {
      if (generation === this.generation) { this.connected = false; this.controller = undefined; }
    }
  };
  start = (sessionId: string, clientRequestId: string, operation: (signal: AbortSignal, onEvent: (event: BiboChatEvent) => void) => Promise<void>): Promise<void> => {
    this.sessionId = sessionId;
    this.unconfirmed = { clientRequestId };
    return this.listen(this.clearConnection(), operation);
  };

  private scheduleRetry = (): void => {
    this.failures += 1;
    if (document.visibilityState !== "hidden" && navigator.onLine) {
      this.retry = setTimeout(() => { void this.sync(this.sessionId); }, Math.min(15_000, 1000 * 2 ** Math.min(4, this.failures - 1)));
    }
  };
  private restore = (state: BiboRunState, generation: number): void => {
    const run = state.activeRuns.find((run) => run.sessionId === this.sessionId) ?? state.activeRuns[0] ?? state.run;
    if (this.unconfirmed && run?.clientRequestId !== this.unconfirmed.clientRequestId) {
      this.observer.failure(this.unconfirmed.error ?? new BiboClientError("这条消息未得到接收确认，输入已保留。"));
      this.unconfirmed = undefined;
      if (!state.activeRuns.length) { this.observer.connection(false); this.observer.idle(); return; }
    }
    this.observer.connection(false);
    if (!run) { this.observer.idle(); return; }
    this.observer.snapshot(run);
    this.sessionId = run.sessionId;
    if (run.phase === "failed") {
      this.observer.failure(new BiboClientError(run.error?.message ?? "这次任务未能完成。"));
      this.observer.idle();
    } else void this.listen(generation, (signal, event) => this.client.resumeRun(run.runId, event, signal));
  };

  sync = (sessionId?: string, force = false): Promise<void> => {
    if (this.syncing) return this.syncing;
    if (this.connected && !force) return Promise.resolve();
    this.sessionId = sessionId;
    const generation = this.clearConnection();
    this.observer.connection(true);
    const operation = (async () => {
      try {
        const state = await this.client.runState(sessionId);
        if (generation !== this.generation) return;
        this.restore(state, generation);
      } catch (error) {
        if (generation !== this.generation) return;
        if (error instanceof BiboClientError && error.status === 401) {
          this.observer.failure(error);
          this.observer.connection(false);
          this.observer.idle();
          return;
        }
        this.observer.connection(true);
        this.scheduleRetry();
      }
    })();
    this.syncing = operation.finally(() => { if (this.syncing === tracked) this.syncing = undefined; });
    const tracked = this.syncing;
    return tracked;
  };
}
