export type CodexLiveOutputChannel = "reasoning" | "text";

export type CodexLiveOutputEvent =
  | { type: "delta"; channel: CodexLiveOutputChannel; delta: string }
  | { type: "end"; channel: CodexLiveOutputChannel }
  | { type: "done" };

export class CodexLiveOutputStream {
  private eventsQueue: CodexLiveOutputEvent[] = [];
  private waiters: Array<() => void> = [];
  private done = false;
  private reasoningEnded = false;
  private textEnded = false;

  reset = (): void => {
    this.eventsQueue = [];
    this.done = false;
    this.reasoningEnded = false;
    this.textEnded = false;
  };

  onReasoningDelta = (delta: string): void => {
    this.pushDelta("reasoning", delta);
  };

  onReasoningDone = (): void => {
    this.pushEnd("reasoning");
  };

  onTextDelta = (delta: string): void => {
    this.pushDelta("text", delta);
  };

  onTextDone = (): void => {
    this.pushEnd("text");
  };

  onDone = (): void => {
    if (this.done) {
      return;
    }
    this.done = true;
    this.push({ type: "done" });
  };

  events = async function* (
    this: CodexLiveOutputStream,
    signal?: AbortSignal,
  ): AsyncGenerator<CodexLiveOutputEvent> {
    while (!signal?.aborted) {
      const event = this.eventsQueue.shift();
      if (event) {
        yield event;
        if (event.type === "done") {
          return;
        }
        continue;
      }

      await new Promise<void>((resolve) => {
        const abort = () => {
          signal?.removeEventListener("abort", abort);
          resolve();
        };
        this.waiters.push(() => {
          signal?.removeEventListener("abort", abort);
          resolve();
        });
        signal?.addEventListener("abort", abort, { once: true });
      });
    }
  };

  private pushDelta = (channel: CodexLiveOutputChannel, delta: string): void => {
    if (!delta || this.done) {
      return;
    }
    this.push({ type: "delta", channel, delta });
  };

  private pushEnd = (channel: CodexLiveOutputChannel): void => {
    if (this.done) {
      return;
    }
    if (channel === "reasoning") {
      if (this.reasoningEnded) {
        return;
      }
      this.reasoningEnded = true;
    } else {
      if (this.textEnded) {
        return;
      }
      this.textEnded = true;
    }
    this.push({ type: "end", channel });
  };

  private push = (event: CodexLiveOutputEvent): void => {
    this.eventsQueue.push(event);
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) {
      waiter();
    }
  };
}
