/** Drains accepted ingress work before the restart owner snapshots active runs. */
export class AgentRunAdmissionService {
  private open = true;
  private active = 0;
  private readonly waiters = new Set<() => void>();
  private executing = 0;
  private readonly executionWaiters: Array<{ grant: () => void; reject: (error: unknown) => void }> = [];

  /** Bound resident active windows. Queued acquisitions are cancellable and never hold a claim. */
  acquireExecution = async (signal: AbortSignal): Promise<() => void> => {
    signal.throwIfAborted();
    if (this.executing >= 8) {
      if (!this.open) throw new Error("Execution admission cancelled for a planned restart; retry after restart.");
      if (this.executionWaiters.length >= 16) throw Object.assign(new Error("Agent execution capacity is full; retry shortly."), { code: "SESSION_CAPACITY_EXCEEDED" });
      await new Promise<void>((resolve, reject) => {
        const waiter = { grant: () => { signal.removeEventListener("abort", abort); resolve(); },
          reject: (error: unknown) => { signal.removeEventListener("abort", abort); reject(error); } };
        const abort = () => {
          const index = this.executionWaiters.indexOf(waiter);
          if (index >= 0) this.executionWaiters.splice(index, 1);
          reject(signal.reason ?? new Error("Execution admission cancelled."));
        };
        this.executionWaiters.push(waiter);
        signal.addEventListener("abort", abort, { once: true });
      });
    } else this.executing += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.executionWaiters.shift();
      if (next) next.grant(); else this.executing -= 1;
    };
  };

  suspend = async (): Promise<void> => {
    this.open = false;
    for (const waiter of this.executionWaiters.splice(0)) waiter.reject(new Error("Execution admission cancelled for a planned restart; retry after restart."));
    if (this.active === 0) return;
    await new Promise<void>((resolveDrain) => this.waiters.add(resolveDrain));
  };

  resume = (): void => { this.open = true; };

  accept = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (!this.open) throw new Error("Agent run admissions are suspended for a planned restart.");
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
      if (this.active === 0) {
        for (const resolveDrain of this.waiters) resolveDrain();
        this.waiters.clear();
      }
    }
  };
}
