import type { Config } from "@nextclaw/core";
import type { RequestRestartParams } from "../../../types.js";
import { RemoteAccessHost } from "../../remote-support/remote-access-host.js";
import { PlatformAuthCommands } from "../../platform-auth.js";
import { RemoteCommands } from "../../remote.js";
import type { RemoteServiceModule } from "@nextclaw/remote";

type ManagedServiceRestartOptions = {
  uiPort?: number;
  reason?: string;
};

export function requestManagedServiceRestart(
  requestRestart: (params: RequestRestartParams) => Promise<void>,
  options: ManagedServiceRestartOptions = {}
): Promise<void> {
  const uiPort =
    typeof options.uiPort === "number" && Number.isFinite(options.uiPort) ? Math.floor(options.uiPort) : undefined;
  const reason = options.reason?.trim() || "remote access service restart";
  const manualMessage = uiPort
    ? `Restart the managed service to restore the UI on port ${uiPort}.`
    : "Restart the managed service to restore the UI.";
  return requestRestart({
    reason,
    manualMessage,
    strategy: "background-service-or-exit",
    delayMs: 500,
    silentOnServiceRestart: true
  });
}

export function createRemoteAccessHost(params: {
  serviceCommands: {
    startService: (options: { uiOverrides: Record<string, unknown>; open: boolean }) => Promise<void>;
    stopService: () => Promise<void>;
  };
  requestRestart: (params: RequestRestartParams) => Promise<void>;
  uiConfig: Pick<Config["ui"], "host" | "port">;
  remoteModule: RemoteServiceModule | null;
}): RemoteAccessHost {
  const currentLocalOrigin = `http://127.0.0.1:${params.uiConfig.port}`;
  return new RemoteAccessHost({
    serviceCommands: params.serviceCommands,
    requestManagedServiceRestart: (options) => requestManagedServiceRestart(params.requestRestart, options),
    remoteCommands: new RemoteCommands({ currentLocalOrigin }),
    platformAuthCommands: new PlatformAuthCommands(),
    currentUi: params.uiConfig,
    remoteRuntimeController: params.remoteModule
      ? {
        start: async () => {
          params.remoteModule?.start();
        },
        stop: async () => {
          await params.remoteModule?.stop();
        },
        restart: async () => {
          await params.remoteModule?.restart();
        }
      }
      : null
  });
}
