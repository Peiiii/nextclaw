import { CompanionRuntimeClientService } from "../services/companion-runtime-client.service.js";
import {
  useCompanionRuntimeStore,
  createInitialCompanionRuntimeSnapshot,
  type CompanionRuntimeConnectionState,
  type CompanionRuntimeSnapshot
} from "../stores/companion-runtime.store.js";
import type {
  CompanionAgentProfile,
  CompanionAvatarView,
  CompanionOfflineReason,
  CompanionSessionSummary
} from "../types/companion.types.js";

export class CompanionRuntimeManager {
  private clientService: CompanionRuntimeClientService | null = null;
  private baseUrl: string | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private subscription: { close: () => void } | null = null;
  private started = false;

  readonly start = async (baseUrl: string): Promise<void> => {
    if (this.started && this.baseUrl === baseUrl) {
      return;
    }
    this.stop();
    this.baseUrl = baseUrl;
    this.clientService = new CompanionRuntimeClientService(baseUrl);
    await this.clientService.initialize();
    useCompanionRuntimeStore.getState().setSnapshot(createInitialCompanionRuntimeSnapshot(baseUrl));
    await this.refresh();
    this.subscription = this.ensureClientService().subscribeToSessions(
      async () => {
        await this.refresh();
      },
      {
        reconnectDelayMs: 1000,
        onError: async () => {
          await this.refresh();
        }
      }
    );
    this.refreshTimer = setInterval(() => {
      void this.refresh();
    }, 10000);
    this.started = true;
  };

  readonly stop = (): void => {
    this.subscription?.close();
    this.subscription = null;
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.clientService = null;
    this.baseUrl = null;
    this.started = false;
    useCompanionRuntimeStore.getState().reset();
  };

  readonly getSnapshot = (): CompanionRuntimeSnapshot => {
    return useCompanionRuntimeStore.getState().snapshot;
  };

  readonly syncRuntimeSnapshot = ({
    agents,
    sessions
  }: {
    agents: CompanionAgentProfile[];
    sessions: CompanionSessionSummary[];
  }): CompanionRuntimeSnapshot => {
    const baseUrl = this.ensureBaseUrl();
    const currentView = this.resolveCurrentView({
      baseUrl,
      agents,
      sessions
    });
    const connectionState: CompanionRuntimeConnectionState = currentView.state === "running" ? "running" : "idle";
    const snapshot: CompanionRuntimeSnapshot = {
      baseUrl,
      agents,
      sessions,
      connectionState,
      offlineReason: null,
      currentView
    };
    useCompanionRuntimeStore.getState().setSnapshot(snapshot);
    return snapshot;
  };

  readonly applyOfflineState = (reason?: CompanionOfflineReason): CompanionRuntimeSnapshot => {
    const baseUrl = this.baseUrl ?? useCompanionRuntimeStore.getState().snapshot.baseUrl ?? "http://127.0.0.1:55667";
    const snapshot: CompanionRuntimeSnapshot = {
      baseUrl,
      agents: [],
      sessions: [],
      connectionState: "offline",
      offlineReason: reason ?? null,
      currentView: {
        state: "offline",
        title: "NextClaw",
        subtitle: reason?.summary?.trim() || "Runtime unavailable",
        openUrl: baseUrl
      }
    };
    useCompanionRuntimeStore.getState().setSnapshot(snapshot);
    return snapshot;
  };

  private readonly refresh = async (): Promise<void> => {
    try {
      const [agents, sessions] = await Promise.all([
        this.ensureClientService().listAgents(),
        this.ensureClientService().listSessions()
      ]);
      this.syncRuntimeSnapshot({
        agents,
        sessions: sessions.sessions
      });
    } catch (error) {
      this.applyOfflineState(
        error instanceof Error
          ? { summary: this.summarizeOfflineError(error.message) }
          : undefined
      );
    }
  };

  private readonly ensureClientService = (): CompanionRuntimeClientService => {
    if (!this.clientService) {
      this.clientService = new CompanionRuntimeClientService(this.ensureBaseUrl());
    }
    return this.clientService;
  };

  private readonly ensureBaseUrl = (): string => {
    if (!this.baseUrl) {
      throw new Error("CompanionRuntimeManager baseUrl has not been initialized.");
    }
    return this.baseUrl;
  };

  private readonly resolveCurrentView = ({
    baseUrl,
    agents,
    sessions
  }: {
    baseUrl: string;
    agents: CompanionAgentProfile[];
    sessions: CompanionSessionSummary[];
  }): CompanionAvatarView => {
    const runningSession = [...sessions]
      .filter((session) => session.status === "running")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

    if (!runningSession) {
      return {
        state: "idle",
        title: "NextClaw",
        subtitle: "No active agent",
        openUrl: baseUrl
      };
    }

    const agent = agents.find((entry) => entry.id === runningSession.agentId) ?? null;

    return {
      state: "running",
      title: agent?.displayName?.trim() || runningSession.agentId || "Active Agent",
      subtitle: runningSession.sessionId,
      avatarUrl: runningSession.agentId
        ? agent?.avatarUrl?.trim() || this.ensureClientService().resolveAvatarUrl(runningSession.agentId)
        : undefined,
      sessionId: runningSession.sessionId,
      agentId: runningSession.agentId,
      openUrl: baseUrl
    };
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
