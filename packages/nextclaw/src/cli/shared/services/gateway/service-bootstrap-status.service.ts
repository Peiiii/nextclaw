import type { BootstrapRemoteState, BootstrapStatusView } from "@nextclaw/server";

function now(): string {
  return new Date().toISOString();
}

export class ServiceBootstrapStatusStore {
  private state: BootstrapStatusView = {
    phase: "kernel-starting",
    ncpAgent: {
      state: "pending",
    },
    pluginHydration: {
      state: "pending",
      loadedPluginCount: 0,
      totalPluginCount: 0
    },
    channels: {
      state: "pending",
      enabled: []
    },
    remote: {
      state: "pending"
    }
  };

  getStatus(): BootstrapStatusView {
    return {
      ...this.state,
      ncpAgent: { ...this.state.ncpAgent },
      pluginHydration: { ...this.state.pluginHydration },
      channels: {
        ...this.state.channels,
        enabled: [...this.state.channels.enabled]
      },
      remote: { ...this.state.remote }
    };
  }

  markShellReady(): void {
    this.state.phase = "shell-ready";
    this.state.shellReadyAt = this.state.shellReadyAt ?? now();
  }

  markNcpAgentPending(): void {
    this.state.ncpAgent = {
      state: "pending",
    };
  }

  markNcpAgentRunning(): void {
    this.state.ncpAgent = {
      state: "running",
      startedAt: this.state.ncpAgent.startedAt ?? now(),
      completedAt: undefined,
      error: undefined
    };
  }

  markNcpAgentReady(): void {
    this.state.ncpAgent = {
      state: "ready",
      startedAt: this.state.ncpAgent.startedAt ?? now(),
      completedAt: now(),
      error: undefined
    };
  }

  markNcpAgentError(error: string): void {
    this.state.ncpAgent = {
      state: "error",
      startedAt: this.state.ncpAgent.startedAt ?? now(),
      completedAt: now(),
      error
    };
  }

  markPluginHydrationPending(): void {
    this.state.pluginHydration = {
      ...this.state.pluginHydration,
      state: "pending",
      loadedPluginCount: 0,
      totalPluginCount: 0
    };
  }

  markPluginHydrationRunning(params: {
    totalPluginCount: number;
  }): void {
    if (this.state.phase !== "ready") {
      this.state.phase = "hydrating-capabilities";
    }
    this.state.pluginHydration = {
      ...this.state.pluginHydration,
      state: "running",
      loadedPluginCount: 0,
      totalPluginCount: params.totalPluginCount,
      startedAt: this.state.pluginHydration.startedAt ?? now(),
      completedAt: undefined,
      error: undefined
    };
  }

  markPluginHydrationProgress(params: {
    loadedPluginCount: number;
    totalPluginCount?: number;
  }): void {
    this.state.pluginHydration = {
      ...this.state.pluginHydration,
      state: "running",
      loadedPluginCount: params.loadedPluginCount,
      totalPluginCount: params.totalPluginCount ?? this.state.pluginHydration.totalPluginCount
    };
  }

  markPluginHydrationReady(params: {
    loadedPluginCount: number;
    totalPluginCount: number;
  }): void {
    this.state.pluginHydration = {
      ...this.state.pluginHydration,
      state: "ready",
      loadedPluginCount: params.loadedPluginCount,
      totalPluginCount: params.totalPluginCount,
      completedAt: now(),
      error: undefined
    };
  }

  markPluginHydrationError(error: string): void {
    if (this.state.phase !== "ready") {
      this.state.phase = "error";
      this.state.lastError = error;
    }
    this.state.pluginHydration = {
      ...this.state.pluginHydration,
      state: "error",
      completedAt: now(),
      error
    };
  }

  markChannelsPending(): void {
    this.state.channels = {
      state: "pending",
      enabled: []
    };
  }

  markChannelsReady(enabled: string[]): void {
    this.state.channels = {
      state: "ready",
      enabled: [...enabled]
    };
    if (this.state.phase !== "ready" && this.state.pluginHydration.state === "ready") {
      this.state.phase = "ready";
      this.state.lastError = undefined;
    }
  }

  markChannelsError(error: string): void {
    if (this.state.phase !== "ready") {
      this.state.phase = "error";
      this.state.lastError = error;
    }
    this.state.channels = {
      state: "error",
      enabled: [...this.state.channels.enabled],
      error
    };
  }

  setRemoteState(state: BootstrapRemoteState, message?: string): void {
    this.state.remote = {
      state,
      ...(message ? { message } : {})
    };
  }

  markReady(): void {
    this.state.phase = "ready";
    this.state.lastError = undefined;
  }

  markError(error: string): void {
    this.state.phase = "error";
    this.state.lastError = error;
  }
}
