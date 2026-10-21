import type { SessionHistoryPreparation } from "@kernel/types/session.types.js";

type Job = { state: SessionHistoryPreparation; controller: AbortController; completion: Promise<void> };

/** One global maintenance lane; control requests never wait for an archive scan. */
export class SessionMessagePreparationStore {
  private static lane: Promise<void> = Promise.resolve();
  private static pending = 0;
  private readonly jobs = new Map<string, Job>();
  constructor(private readonly prepare: (sessionId: string, signal: AbortSignal, progress: (bytes: number, total: number) => void) => Promise<void>) {}

  get = (sessionId: string): SessionHistoryPreparation | null => {
    const state = this.jobs.get(sessionId)?.state;
    return state ? { ...state } : null;
  };

  start = (sessionId: string, totalBytes: number, retry = false): SessionHistoryPreparation => {
    const existing = this.jobs.get(sessionId);
    if (existing && (!retry || ["queued", "preparing"].includes(existing.state.status))) return { ...existing.state };
    if (SessionMessagePreparationStore.pending >= 128) return { status: "queued", processedBytes: 0, totalBytes };
    if (this.jobs.size >= 512) {
      for (const [id, job] of this.jobs) if (!["queued", "preparing"].includes(job.state.status)) { this.jobs.delete(id); break; }
    }
    const controller = new AbortController();
    const state: SessionHistoryPreparation = { status: "queued", processedBytes: 0, totalBytes };
    const job: Job = { state, controller, completion: Promise.resolve() };
    SessionMessagePreparationStore.pending += 1;
    const completion = SessionMessagePreparationStore.lane.then(async () => {
      controller.signal.throwIfAborted();
      state.status = "preparing";
      await this.prepare(sessionId, controller.signal, (bytes, total) => { state.processedBytes = bytes; state.totalBytes = total; });
      state.status = "ready"; state.processedBytes = state.totalBytes;
    }).catch(error => {
      state.status = controller.signal.aborted ? "cancelled" : "failed";
      if (!controller.signal.aborted) state.error = error instanceof Error ? error.message : String(error);
    }).finally(() => { SessionMessagePreparationStore.pending -= 1; });
    job.completion = completion;
    this.jobs.set(sessionId, job);
    SessionMessagePreparationStore.lane = completion;
    return { ...state };
  };

  wait = async (sessionId: string): Promise<void> => {
    const job = this.jobs.get(sessionId);
    if (!job) throw new Error("Session preparation is waiting for maintenance capacity; retry shortly.");
    await job.completion;
    if (job.state.status !== "ready") throw new Error(job.state.error ?? `Session preparation ${job.state.status}`);
  };

  cancel = (sessionId: string): boolean => {
    const job = this.jobs.get(sessionId);
    if (!job || !["queued", "preparing"].includes(job.state.status)) return false;
    job.controller.abort(new DOMException("Session preparation cancelled", "AbortError"));
    return true;
  };
}
