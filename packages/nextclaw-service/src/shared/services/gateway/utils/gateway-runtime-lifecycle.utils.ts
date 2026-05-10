import type { ServiceBootstrapStatusStore } from "../service-bootstrap-status.js";

export function handleGatewayDeferredStartupError(params: {
  bootstrapStatus: ServiceBootstrapStatusStore;
  error: unknown;
}): void {
  const { bootstrapStatus, error } = params;
  const message = error instanceof Error ? error.message : String(error);
  bootstrapStatus.markError(message);
  if (bootstrapStatus.getStatus().pluginHydration.state === "running") {
    bootstrapStatus.markPluginHydrationError(message);
  }
  console.error(
    `Deferred startup failed: ${message}`,
  );
}
