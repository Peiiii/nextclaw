import type { CompanionAgentProfile, CompanionSessionSummary } from "../types/companion.types.js";

type CompanionSdkClient = {
  agents: {
    list: () => Promise<CompanionAgentProfile[]>;
    resolveAvatarUrl: (agentId: string) => string;
  };
  sessions: {
    list: () => Promise<{ sessions: CompanionSessionSummary[] }>;
    subscribe: (
      handler: (event: unknown) => void,
      options: { reconnectDelayMs?: number; onError?: (error: unknown) => void }
    ) => { close: () => void };
  };
};

export class CompanionRuntimeClientService {
  private client: CompanionSdkClient | null = null;

  constructor(private readonly baseUrl: string) {}

  readonly listAgents = async (): Promise<CompanionAgentProfile[]> => {
    return await this.ensureClient().agents.list();
  };

  readonly listSessions = async (): Promise<{ sessions: CompanionSessionSummary[] }> => {
    return await this.ensureClient().sessions.list();
  };

  readonly subscribeToSessions = (
    handler: (event: unknown) => void,
    options: { reconnectDelayMs?: number; onError?: (error: unknown) => void }
  ): { close: () => void } => {
    return this.ensureClient().sessions.subscribe(handler, options);
  };

  readonly resolveAvatarUrl = (agentId: string): string => {
    return `${this.baseUrl}/api/agents/${encodeURIComponent(agentId)}/avatar`;
  };

  private readonly ensureClient = (): CompanionSdkClient => {
    if (this.client) {
      return this.client;
    }
    throw new Error("Companion runtime client has not been initialized.");
  };

  readonly initialize = async (): Promise<void> => {
    if (this.client) {
      return;
    }
    const sdkModule = await import("@nextclaw/client-sdk");
    this.client = new sdkModule.NextClawClient({ baseUrl: this.baseUrl }) as CompanionSdkClient;
  };
}
