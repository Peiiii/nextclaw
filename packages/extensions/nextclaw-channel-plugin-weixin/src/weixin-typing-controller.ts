type WeixinTypingRuntime = {
  accountId: string;
  userId: string;
  contextToken: string;
  baseUrl: string;
  token: string;
};

type WeixinTypingControllerOptions = {
  heartbeatMs?: number;
  ticketTtlMs?: number;
  fetchTicket: (runtime: WeixinTypingRuntime) => Promise<string | undefined>;
  sendTyping: (params: WeixinTypingRuntime & { ticket: string; status: 1 | 2 }) => Promise<void>;
};

type TicketCacheEntry = {
  ticket: string;
  expiresAtMs: number;
};

type ActiveSession = {
  heartbeat: NodeJS.Timeout;
  ticket: string;
  runtime: WeixinTypingRuntime;
  sequence: number;
};

function buildTypingKey(accountId: string, userId: string): string {
  return `${accountId}:${userId}`;
}

export class WeixinTypingController {
  private readonly heartbeatMs: number;
  private readonly ticketTtlMs: number;
  private readonly ticketCache = new Map<string, TicketCacheEntry>();
  private readonly activeSessions = new Map<string, ActiveSession>();
  private readonly sessionSequences = new Map<string, number>();
  private readonly fetchTicket: WeixinTypingControllerOptions["fetchTicket"];
  private readonly sendTyping: WeixinTypingControllerOptions["sendTyping"];

  constructor(options: WeixinTypingControllerOptions) {
    this.heartbeatMs = Math.max(1_000, Math.trunc(options.heartbeatMs ?? 5_000));
    this.ticketTtlMs = Math.max(this.heartbeatMs, Math.trunc(options.ticketTtlMs ?? 24 * 60 * 60 * 1_000));
    this.fetchTicket = options.fetchTicket;
    this.sendTyping = options.sendTyping;
  }

  start = async (runtime: WeixinTypingRuntime): Promise<void> => {
    const key = buildTypingKey(runtime.accountId, runtime.userId);
    const sequence = this.bumpSequence(key);
    await this.clearActiveSession({
      accountId: runtime.accountId,
      userId: runtime.userId,
      sendCancel: false,
    });
    const ticket = await this.getTicket(runtime);
    if (!ticket || this.sessionSequences.get(key) !== sequence) {
      return;
    }

    await this.sendTypingSafe({
      ...runtime,
      ticket,
      status: 1,
    });

    if (this.sessionSequences.get(key) !== sequence) {
      return;
    }

    const heartbeat = setInterval(() => {
      const active = this.activeSessions.get(key);
      if (!active || active.sequence !== sequence) {
        return;
      }
      void this.sendTypingSafe({
        ...active.runtime,
        ticket: active.ticket,
        status: 1,
      });
    }, this.heartbeatMs);

    this.activeSessions.set(key, {
      heartbeat,
      ticket,
      runtime,
      sequence,
    });
  };

  stop = async (params: {
    accountId: string;
    userId: string;
    sendCancel?: boolean;
  }): Promise<void> => {
    const key = buildTypingKey(params.accountId, params.userId);
    this.bumpSequence(key);
    await this.clearActiveSession(params);
  };

  stopAll = async (): Promise<void> => {
    const sessions = Array.from(this.activeSessions.values());
    this.activeSessions.clear();
    for (const session of sessions) {
      this.bumpSequence(buildTypingKey(session.runtime.accountId, session.runtime.userId));
      clearInterval(session.heartbeat);
    }
    await Promise.allSettled(
      sessions.map(async (session) => {
        await this.sendTypingSafe({
          ...session.runtime,
          ticket: session.ticket,
          status: 2,
        });
      }),
    );
  };

  private bumpSequence = (key: string): number => {
    const next = (this.sessionSequences.get(key) ?? 0) + 1;
    this.sessionSequences.set(key, next);
    return next;
  };

  private clearActiveSession = async (params: {
    accountId: string;
    userId: string;
    sendCancel?: boolean;
  }): Promise<void> => {
    const key = buildTypingKey(params.accountId, params.userId);
    const active = this.activeSessions.get(key);
    if (!active) {
      return;
    }
    clearInterval(active.heartbeat);
    this.activeSessions.delete(key);
    if (params.sendCancel === false) {
      return;
    }
    await this.sendTypingSafe({
      ...active.runtime,
      ticket: active.ticket,
      status: 2,
    });
  };

  private getTicket = async (runtime: WeixinTypingRuntime): Promise<string | undefined> => {
    const key = buildTypingKey(runtime.accountId, runtime.userId);
    const cached = this.ticketCache.get(key);
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached.ticket;
    }

    const ticket = (await this.fetchTicket(runtime))?.trim();
    if (!ticket) {
      return undefined;
    }

    this.ticketCache.set(key, {
      ticket,
      expiresAtMs: Date.now() + this.ticketTtlMs,
    });
    return ticket;
  };

  private sendTypingSafe = async (params: WeixinTypingRuntime & { ticket: string; status: 1 | 2 }): Promise<void> => {
    try {
      await this.sendTyping(params);
    } catch {
      // Typing is best-effort and must never block the main reply path.
    }
  };
}

export type { WeixinTypingRuntime };
