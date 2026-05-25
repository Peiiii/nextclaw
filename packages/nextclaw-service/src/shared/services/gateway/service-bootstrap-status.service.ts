import type { BootstrapRemoteState, BootstrapStatusView } from "@nextclaw/server";
import type { RemoteRuntimeState } from "@nextclaw/remote";

function now(): string {
  return new Date().toISOString();
}

export class ServiceBootstrapStatusStore {
  private state: BootstrapStatusView = {
    phase: "kernel-starting",
    ncpAgent: {
      state: "pending",
    },
    extensionLoading: {
      state: "pending",
      loadedExtensionCount: 0,
      totalExtensionCount: 0
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
      extensionLoading: { ...this.state.extensionLoading },
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

  markExtensionLoadingRunning(params: {
    totalExtensionCount: number;
  }): void {
    this.state.phase = "hydrating-capabilities";
    this.state.extensionLoading = {
      ...this.state.extensionLoading,
      state: "running",
      loadedExtensionCount: 0,
      totalExtensionCount: params.totalExtensionCount,
      startedAt: this.state.extensionLoading.startedAt ?? now(),
      completedAt: undefined,
      error: undefined
    };
  }

  markExtensionLoadingProgress(params: {
    loadedExtensionCount: number;
    totalExtensionCount?: number;
  }): void {
    this.state.extensionLoading = {
      ...this.state.extensionLoading,
      state: "running",
      loadedExtensionCount: params.loadedExtensionCount,
      totalExtensionCount: params.totalExtensionCount ?? this.state.extensionLoading.totalExtensionCount
    };
  }

  markExtensionLoadingReady(params: {
    loadedExtensionCount: number;
    totalExtensionCount: number;
  }): void {
    this.state.extensionLoading = {
      ...this.state.extensionLoading,
      state: "ready",
      loadedExtensionCount: params.loadedExtensionCount,
      totalExtensionCount: params.totalExtensionCount,
      completedAt: now(),
      error: undefined
    };
  }

  markExtensionLoadingError(error: string): void {
    this.state.phase = "error";
    this.state.lastError = error;
    this.state.extensionLoading = {
      ...this.state.extensionLoading,
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
    if (this.state.extensionLoading.state === "ready") {
      this.state.phase = "ready";
      this.state.lastError = undefined;
    }
  }

  markChannelsError(error: string): void {
    this.state.phase = "error";
    this.state.lastError = error;
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

  syncRemoteRuntimeState(runtime: RemoteRuntimeState): void {
    const message = runtime.lastError?.trim() || undefined;
    const state =
      runtime.state === "connected" ? "ready"
        : runtime.state === "disabled" ? "disabled"
          : runtime.state === "error" && message?.includes("already owned") ? "conflict"
            : runtime.state === "error" ? "error"
              : "pending";
    this.setRemoteState(state, message);
  }

  markError(error: string): void {
    this.state.phase = "error";
    this.state.lastError = error;
  }
}
