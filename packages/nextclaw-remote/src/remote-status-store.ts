import { hostname } from "node:os";
import type { Config } from "@nextclaw/core";
import type { RemoteRuntimeState, RemoteStatusSnapshot, RemoteStatusWriter } from "./types.js";

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildConfiguredRemoteState(config: Config): RemoteRuntimeState {
  const remote = config.remote;
  return {
    enabled: Boolean(remote.enabled),
    mode: "service",
    state: remote.enabled ? "disconnected" : "disabled",
    ...(normalizeOptionalString(remote.deviceName) ? { deviceName: normalizeOptionalString(remote.deviceName) } : {}),
    ...(normalizeOptionalString(remote.platformApiBase) ? { platformBase: normalizeOptionalString(remote.platformApiBase) } : {}),
    updatedAt: new Date().toISOString()
  };
}

export function resolveRemoteStatusSnapshot(params: {
  config: Config;
  currentRemoteState?: RemoteRuntimeState | null;
  fallbackDeviceName?: string;
}): RemoteStatusSnapshot {
  if (params.currentRemoteState) {
    return {
      configuredEnabled: Boolean(params.config.remote.enabled),
      runtime: params.currentRemoteState
    };
  }

  if (params.config.remote.enabled) {
    return {
      configuredEnabled: true,
      runtime: {
        ...buildConfiguredRemoteState(params.config),
        deviceName:
          normalizeOptionalString(params.config.remote.deviceName)
          ?? normalizeOptionalString(params.fallbackDeviceName)
          ?? hostname()
      }
    };
  }

  return {
    configuredEnabled: false,
    runtime: null
  };
}

export class RemoteStatusStore implements RemoteStatusWriter {
  constructor(
    private readonly mode: RemoteRuntimeState["mode"],
    private readonly deps: {
      writeRemoteState: (next: RemoteRuntimeState) => void;
    }
  ) {}

  write(next: Omit<RemoteRuntimeState, "mode" | "updatedAt">): void {
    this.deps.writeRemoteState({
      ...next,
      mode: this.mode,
      updatedAt: new Date().toISOString()
    });
  }
}
