import type { HermesHttpAdapterRun } from "./hermes-http-adapter.types.js";

type SessionRunWaiter = {
  resolve: (run: HermesHttpAdapterRun) => void;
  reject: (error: Error) => void;
};

type SessionEntry = {
  hermesSessionId?: string;
  selectedModel?: string;
  pendingRun?: HermesHttpAdapterRun;
  activeAbortController?: AbortController;
  waiters: Set<SessionRunWaiter>;
};

export class HermesHttpAdapterSessionStore {
  private readonly sessions = new Map<string, SessionEntry>();

  setPendingRun = (run: HermesHttpAdapterRun): void => {
    const session = this.getOrCreateEntry(run.envelope.sessionId);
    if (session.pendingRun || session.activeAbortController) {
      throw new Error(
        `[hermes-http-adapter] session ${run.envelope.sessionId} already has an active or pending run.`,
      );
    }
    session.pendingRun = run;
    this.flushWaiters(run.envelope.sessionId, session);
  };

  waitForPendingRun = async (
    sessionId: string,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<HermesHttpAdapterRun> => {
    const entry = this.getOrCreateEntry(sessionId);
    if (entry.pendingRun) {
      const run = entry.pendingRun;
      entry.pendingRun = undefined;
      return run;
    }

    return await new Promise<HermesHttpAdapterRun>((resolve, reject) => {
      const waiter: SessionRunWaiter = {
        resolve: (run) => {
          cleanup();
          resolve(run);
        },
        reject: (error) => {
          cleanup();
          reject(error);
        },
      };

      const cleanup = (): void => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", handleAbort);
        entry.waiters.delete(waiter);
      };

      const handleAbort = (): void => {
        waiter.reject(createAbortError("stream request aborted before send arrived"));
      };

      const timeout = setTimeout(() => {
        waiter.reject(
          new Error(
            `[hermes-http-adapter] timed out waiting for /send for session ${sessionId}.`,
          ),
        );
      }, timeoutMs);

      signal.addEventListener("abort", handleAbort, { once: true });
      entry.waiters.add(waiter);
    });
  };

  setActiveAbortController = (
    sessionId: string,
    controller: AbortController,
  ): void => {
    const session = this.getOrCreateEntry(sessionId);
    session.activeAbortController = controller;
  };

  clearActiveAbortController = (sessionId: string): void => {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.activeAbortController = undefined;
    this.cleanupSession(sessionId, session);
  };

  abortSession = (sessionId: string): boolean => {
    const session = this.sessions.get(sessionId);
    if (!session?.activeAbortController) {
      return false;
    }
    session.activeAbortController.abort("session aborted");
    return true;
  };

  setHermesSessionId = (sessionId: string, hermesSessionId: string): void => {
    const session = this.getOrCreateEntry(sessionId);
    session.hermesSessionId = hermesSessionId;
  };

  readHermesSessionId = (sessionId: string): string | undefined =>
    this.sessions.get(sessionId)?.hermesSessionId;

  setSelectedModel = (sessionId: string, model: string): void => {
    const session = this.getOrCreateEntry(sessionId);
    session.selectedModel = model;
  };

  readSelectedModel = (sessionId: string): string | undefined =>
    this.sessions.get(sessionId)?.selectedModel;

  dispose = (): void => {
    for (const [sessionId, session] of this.sessions.entries()) {
      session.activeAbortController?.abort("adapter disposed");
      for (const waiter of session.waiters) {
        waiter.reject(new Error(`[hermes-http-adapter] adapter disposed for ${sessionId}.`));
      }
      session.waiters.clear();
    }
    this.sessions.clear();
  };

  private flushWaiters = (sessionId: string, session: SessionEntry): void => {
    if (!session.pendingRun || session.waiters.size === 0) {
      return;
    }
    const run = session.pendingRun;
    session.pendingRun = undefined;
    const waiters = [...session.waiters];
    session.waiters.clear();
    for (const waiter of waiters) {
      waiter.resolve(run);
    }
    this.cleanupSession(sessionId, session);
  };

  private cleanupSession = (sessionId: string, session: SessionEntry): void => {
    if (session.pendingRun || session.activeAbortController || session.waiters.size > 0) {
      return;
    }
    if (session.hermesSessionId || session.selectedModel) {
      return;
    }
    this.sessions.delete(sessionId);
  };

  private getOrCreateEntry = (sessionId: string): SessionEntry => {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }
    const created: SessionEntry = {
      waiters: new Set(),
    };
    this.sessions.set(sessionId, created);
    return created;
  };
}

function createAbortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}
