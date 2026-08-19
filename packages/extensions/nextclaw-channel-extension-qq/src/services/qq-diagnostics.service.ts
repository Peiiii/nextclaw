import {
  classifyDiagnosticError,
  type ExtensionDiagnostics,
} from "@nextclaw/extension-sdk";

export class QQDiagnosticsService {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly diagnostics?: ExtensionDiagnostics) {}

  createTraceId = (stableId?: string): string | undefined =>
    this.diagnostics?.createTraceId(stableId);

  createInboundTraceId = (providerMessageId: string): string | undefined =>
    this.createTraceId(
      providerMessageId ? `channel.delivery:qq:${providerMessageId}` : undefined,
    );

  emitInboundRejected = (
    correlationId: string | undefined,
    reasonCode: string,
  ): void => {
    this.emit({
      domain: "channel.delivery",
      event: "inbound.rejected",
      component: "extension.qq",
      outcome: "rejected",
      correlationId,
      reasonCode,
      facts: { channel: "qq", direction: "inbound", stage: "extension" },
    });
  };

  emitGatewayConnectStarted = (trigger: string, attempt: number): void => {
    this.emit({
      domain: "extension.lifecycle",
      event: "gateway.connect.started",
      component: "extension.qq",
      outcome: "started",
      attempt,
      facts: { channel: "qq", trigger },
    });
    this.emit({
      domain: "transport.request",
      event: "qq.gateway-connect.started",
      component: "extension.qq",
      outcome: "started",
      attempt,
      facts: { transportKind: "qq-gateway", operation: "gateway-connect" },
    });
  };

  emitGatewayConnectSucceeded = (trigger: string, durationMs: number): void => {
    this.emit({
      domain: "extension.lifecycle",
      event: "gateway.connect.succeeded",
      component: "extension.qq",
      outcome: "succeeded",
      facts: { channel: "qq", trigger },
    });
    this.emit({
      domain: "transport.request",
      event: "qq.gateway-connect.succeeded",
      component: "extension.qq",
      outcome: "succeeded",
      durationMs,
      facts: { transportKind: "qq-gateway", operation: "gateway-connect" },
    });
  };

  emitGatewayConnectFailed = (params: {
    attempt: number;
    durationMs: number;
    error: unknown;
    reconnectInMs: number;
    sessionLimit: boolean;
    trigger: string;
  }): void => {
    const { attempt, durationMs, error, reconnectInMs, sessionLimit, trigger } = params;
    const classification = classifyDiagnosticError(error);
    const reasonCode = sessionLimit ? "session_limit" : classification.reasonCode;
    const providerCode = this.readProviderCode(error) ?? classification.providerCode;
    this.emit({
      domain: "extension.lifecycle",
      event: classification.outcome === "cancelled" ? "gateway.connect.cancelled" : "gateway.connect.failed",
      component: "extension.qq",
      outcome: classification.outcome,
      attempt,
      reasonCode,
      providerCode,
      facts: {
        channel: "qq",
        trigger,
        reconnectInMs,
        ...(classification.facts ?? {}),
      },
    });
    this.emit({
      domain: "transport.request",
      event: classification.outcome === "cancelled" ? "qq.gateway-connect.cancelled" : "qq.gateway-connect.failed",
      component: "extension.qq",
      outcome: classification.outcome,
      attempt,
      durationMs,
      reasonCode,
      providerCode,
      facts: {
        transportKind: "qq-gateway",
        operation: "gateway-connect",
        ...(classification.facts ?? {}),
      },
    });
  };

  emit = (event: Parameters<ExtensionDiagnostics["emit"]>[0]): void => {
    if (!this.diagnostics) {
      return;
    }
    this.queue = this.queue
      .then(async () => {
        await this.diagnostics?.emit(event);
      })
      .catch(() => undefined);
  };

  readProviderCode = (error: unknown): string | undefined => {
    const message = error instanceof Error ? error.message : String(error);
    return this.normalizeProviderCode(message.match(/code\(([^)]+)\)/)?.[1]);
  };

  normalizeProviderCode = (value: unknown): string | undefined => {
    const code = typeof value === "string" || typeof value === "number"
      ? String(value).trim().toLowerCase()
      : undefined;
    return code && /^[a-z0-9][a-z0-9._-]{0,95}$/.test(code) ? code : undefined;
  };
}
