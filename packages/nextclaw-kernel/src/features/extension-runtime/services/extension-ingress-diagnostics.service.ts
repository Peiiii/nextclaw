import type {
  DiagnosticRuntime,
  InboundMessage,
} from "@nextclaw/core";
import type {
  DiagnosticFactValue,
  DiagnosticOutcome,
} from "@nextclaw/shared";
import {
  readOptionalNumber,
  readRecord,
  readRequiredString,
  readString,
} from "@kernel/features/extension-runtime/utils/extension-runtime-payload.utils.js";

type ExtensionCredential = {
  extensionId: string;
  generation: string;
};

export class ExtensionIngressDiagnosticsService {
  constructor(
    private readonly diagnostics: Pick<DiagnosticRuntime, "readCorrelationId" | "record">,
  ) {}

  recordChannelMessageAccepted = (message: InboundMessage): void => {
    this.diagnostics.record({
      domain: "channel.delivery",
      event: "inbound.accepted",
      component: "kernel.extension-runtime",
      outcome: "accepted",
      correlationId: this.diagnostics.readCorrelationId(message.metadata),
      facts: {
        channel: message.channel,
        direction: "inbound",
        stage: "kernel",
      },
    });
  };

  recordExtensionEvent = (
    input: unknown,
    credential: ExtensionCredential,
  ): void => {
    const payload = readRecord(input);
    this.diagnostics.record({
      domain: readRequiredString(payload.domain, "domain"),
      event: readRequiredString(payload.event, "event"),
      component: readRequiredString(payload.component, "component"),
      outcome: readRequiredString(payload.outcome, "outcome") as DiagnosticOutcome,
      correlationId: readString(payload.correlationId),
      parentCorrelationId: readString(payload.parentCorrelationId),
      reasonCode: readString(payload.reasonCode),
      providerCode: readString(payload.providerCode),
      durationMs: readOptionalNumber(payload.durationMs),
      attempt: readOptionalNumber(payload.attempt),
      facts: {
        ...(readRecord(payload.facts) as Record<string, DiagnosticFactValue>),
        extensionId: credential.extensionId,
        generation: credential.generation,
      },
    });
  };
}
