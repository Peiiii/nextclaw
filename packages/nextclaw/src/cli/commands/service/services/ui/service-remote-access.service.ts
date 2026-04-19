import type { Config } from "@nextclaw/core";
import type { RequestRestartParams } from "../../../../shared/types/cli.types.js";
import { RemoteAccessHost } from "../../../remote/services/remote-access-host.service.js";
import { PlatformAuthCommands } from "../../../platform-auth/index.js";
import { RemoteCommands } from "../../../remote/index.js";
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
  const { remoteModule, requestRestart, serviceCommands, uiConfig } = params;
  const currentLocalOrigin = `http://127.0.0.1:${uiConfig.port}`;
  return new RemoteAccessHost({
    serviceCommands,
    requestManagedServiceRestart: (options) => requestManagedServiceRestart(requestRestart, options),
    remoteCommands: new RemoteCommands({ currentLocalOrigin }),
    platformAuthCommands: new PlatformAuthCommands(),
    currentUi: uiConfig,
    remoteRuntimeController: remoteModule
      ? {
        start: async () => {
          remoteModule?.start();
        },
        stop: async () => {
          await remoteModule?.stop();
        },
        restart: async () => {
          await remoteModule?.restart();
        }
      }
      : null
  });
}
