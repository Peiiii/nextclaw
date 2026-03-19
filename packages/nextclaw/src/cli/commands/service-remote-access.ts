import type { RequestRestartParams } from "../types.js";
import { RemoteAccessHost } from "./remote-access-host.js";
import { PlatformAuthCommands } from "./platform-auth.js";
import { RemoteCommands } from "./remote.js";

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
}): RemoteAccessHost {
  return new RemoteAccessHost({
    serviceCommands: params.serviceCommands,
    requestManagedServiceRestart: (options) => requestManagedServiceRestart(params.requestRestart, options),
    remoteCommands: new RemoteCommands(),
    platformAuthCommands: new PlatformAuthCommands()
  });
}
