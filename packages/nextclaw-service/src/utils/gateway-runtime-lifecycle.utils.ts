import type { ServiceBootstrapStatusStore } from "@nextclaw-service/services/gateway/service-bootstrap-status.service.js";

export function handleGatewayDeferredStartupError(params: {
  bootstrapStatus: ServiceBootstrapStatusStore;
  error: unknown;
}): void {
  const { bootstrapStatus, error } = params;
  const message = error instanceof Error ? error.message : String(error);
  bootstrapStatus.markError(message);
  if (bootstrapStatus.getStatus().extensionLoading.state === "running") {
    bootstrapStatus.markExtensionLoadingError(message);
  }
  console.error(
    `Deferred startup failed: ${message}`,
  );
}
