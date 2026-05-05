import type {
  CompanionAgentProfile,
  CompanionAvatarView,
  CompanionSessionSummary
} from "../types/companion.types.js";
import { CompanionSessionViewService } from "./companion-session-view.service.js";

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
  private viewService: CompanionSessionViewService | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private subscription: { close: () => void } | null = null;

  constructor(private readonly baseUrl: string) {}

  readonly start = async (onView: (view: CompanionAvatarView) => void): Promise<void> => {
    await this.ensureClient();
    await this.refresh(onView);
    const client = await this.ensureClient();
    this.subscription = client.sessions.subscribe(
      async () => {
        await this.refresh(onView);
      },
      {
        reconnectDelayMs: 1000,
        onError: async () => {
          await this.refresh(onView);
        }
      }
    );
    this.refreshTimer = setInterval(() => {
      void this.refresh(onView);
    }, 10000);
  };

  readonly stop = (): void => {
    this.subscription?.close();
    this.subscription = null;
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  };

  private readonly refresh = async (onView: (view: CompanionAvatarView) => void): Promise<void> => {
    try {
      const client = await this.ensureClient();
      const [agents, sessions] = await Promise.all([
        client.agents.list(),
        client.sessions.list()
      ]);
      onView(
        this.ensureViewService(client).selectView({
          agents,
          sessions: sessions.sessions
        })
      );
    } catch (error) {
      console.error("[companion] refresh failed", error);
      onView(
        this.createOfflineView(
          error instanceof Error
            ? { summary: this.summarizeOfflineError(error.message) }
            : undefined
        )
      );
    }
  };

  private readonly ensureClient = async (): Promise<CompanionSdkClient> => {
    if (this.client) {
      return this.client;
    }
    const sdkModule = await import("@nextclaw/client-sdk");
    this.client = sdkModule.createNextClawClient({ baseUrl: this.baseUrl }) as CompanionSdkClient;
    return this.client;
  };

  private readonly ensureViewService = (client: CompanionSdkClient): CompanionSessionViewService => {
    if (this.viewService) {
      return this.viewService;
    }
    this.viewService = new CompanionSessionViewService(this.baseUrl, client.agents.resolveAvatarUrl);
    return this.viewService;
  };

  private readonly createOfflineView = (reason?: { summary: string }): CompanionAvatarView => {
    const viewService =
      this.viewService ??
      new CompanionSessionViewService(this.baseUrl, (agentId) => `${this.baseUrl}/api/agents/${encodeURIComponent(agentId)}/avatar`);
    return viewService.createOfflineView(reason);
  };

  private readonly summarizeOfflineError = (message: string): string => {
    if (/fetch failed/i.test(message)) {
      return "Cannot reach runtime";
    }
    if (/timed out/i.test(message)) {
      return "Runtime timeout";
    }
    const trimmed = message.trim();
    return trimmed.length > 28 ? `${trimmed.slice(0, 25)}...` : trimmed || "Runtime unavailable";
  };
}
