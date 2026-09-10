/** Drains accepted ingress work before the restart owner snapshots active runs. */
export class AgentRunAdmissionService {
  private open = true;
  private active = 0;
  private readonly waiters = new Set<() => void>();

  suspend = async (): Promise<void> => {
    this.open = false;
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
