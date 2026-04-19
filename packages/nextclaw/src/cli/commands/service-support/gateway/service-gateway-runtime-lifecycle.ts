import { setPluginRuntimeBridge, stopPluginChannelGateways } from "@nextclaw/openclaw-compat";
import type { RemoteServiceModule } from "@nextclaw/remote";
import { localUiRuntimeStore } from "../../../runtime-state/local-ui-runtime.store.js";
import type { ServiceFileWatcherRegistry } from "./service-startup-support.js";
import type { UiStartupHandle } from "./service-gateway-startup.service.js";
import type { GatewayRuntimeState } from "./service-gateway-bootstrap.js";
import type { ServiceBootstrapStatusStore } from "./service-bootstrap-status.js";

export function handleGatewayDeferredStartupError(params: {
  bootstrapStatus: ServiceBootstrapStatusStore;
  error: unknown;
}): void {
  const message = params.error instanceof Error
    ? params.error.message
    : String(params.error);
  params.bootstrapStatus.markError(message);
  if (params.bootstrapStatus.getStatus().pluginHydration.state === "running") {
    params.bootstrapStatus.markPluginHydrationError(message);
  }
  console.error(
    `Deferred startup failed: ${params.error instanceof Error ? params.error.message : String(params.error)}`,
  );
}

export async function cleanupGatewayRuntime(params: {
  fileWatchers: ServiceFileWatcherRegistry;
  resetRuntimeState: () => void;
  clearRealtimeBridge: () => void;
  uiStartup: UiStartupHandle | null;
  remoteModule: RemoteServiceModule | null;
  runtimeState: GatewayRuntimeState | null;
}): Promise<void> {
  localUiRuntimeStore.clearIfOwnedByProcess();
  await params.fileWatchers.clear();
  params.resetRuntimeState();
  params.clearRealtimeBridge();
  await params.uiStartup?.deferredNcpAgent.close();
  await params.remoteModule?.stop();
  await stopPluginChannelGateways(params.runtimeState?.pluginGatewayHandles ?? []);
  setPluginRuntimeBridge(null);
}
