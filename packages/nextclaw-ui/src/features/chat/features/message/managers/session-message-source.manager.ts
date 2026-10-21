import { nextclawClient } from "@/shared/lib/api/managers/client.manager";
import { NextClawClientError } from "@nextclaw/client-sdk";

type SourceState = { status: "idle" | "loading" | "ready" | "error"; content: string; part: number; displayedPart?: number; nextCursor?: string; revision?: string; hasMore: boolean };

/** A source reader retains one bounded fragment, never the accumulated archived body. */
export class SessionMessageSourceManager {
  private state: SourceState = { status: "idle", content: "", part: 0, hasMore: true };
  private readonly listeners = new Set<() => void>();
  private controller?: AbortController;
  constructor(private readonly sessionId: string, private readonly messageId: string, private readonly partCount: number) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set = (state: SourceState) => { this.state = state; for (const listener of this.listeners) listener(); };
  selectPart = (part: number): void => {
    if (!Number.isSafeInteger(part) || part < 0 || part >= this.partCount) return;
    this.controller?.abort(); this.set({ status: "idle", part, content: "", hasMore: true });
  };
  read = async (): Promise<void> => {
    if (this.state.status === "loading" || !this.state.hasMore) return;
    const before = this.state;
    const controller = new AbortController(); this.controller = controller;
    this.set({ ...before, status: "loading" });
    try {
      const page = await nextclawClient.sessions.readMessagePart(this.sessionId, this.messageId, before.part, before.nextCursor, controller.signal);
      if (controller.signal.aborted) return;
      if (before.revision && page.revision !== before.revision) throw new Error("History source revision changed.");
      this.set({ status: "ready", content: page.content, revision: page.revision,
        displayedPart: before.part,
        part: page.nextCursor ? before.part : before.part + 1,
        nextCursor: page.nextCursor ?? undefined, hasMore: Boolean(page.nextCursor) || before.part + 1 < this.partCount });
    } catch (error) {
      if (!controller.signal.aborted) this.set({ ...before, status: "error",
        ...(error instanceof NextClawClientError && error.code === "INVALID_CURSOR" ? { nextCursor: undefined, revision: undefined } : {}) });
    }
  };
  dispose = (): void => { this.controller?.abort(); this.listeners.clear(); };
}
