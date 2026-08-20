import { CHAT_SESSION_MATERIALIZATION_METADATA_KEY } from "@nextclaw/shared";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import type {
  ProductActivitySignal,
  ProductActivitySink,
  ProductActivitySource,
} from "@kernel/types/product-activity.types.js";

type SessionMaterializationMetadata = {
  kind?: unknown;
};

export function resolveHumanProductActivitySource(
  request: AgentRunRequest,
): ProductActivitySource | null {
  const metadata = request.metadata ?? {};
  if (metadata.session_origin === "cron") {
    return null;
  }

  const materialization = metadata[
    CHAT_SESSION_MATERIALIZATION_METADATA_KEY
  ] as SessionMaterializationMetadata | undefined;
  if (materialization?.kind === "child") {
    return null;
  }

  return request.channel ? "channel" : "direct";
}

export function recordProductActivityBestEffort(
  sink: ProductActivitySink | undefined,
  signal: ProductActivitySignal,
): void {
  if (!sink) {
    return;
  }
  try {
    void Promise.resolve(sink.record(signal)).catch(() => undefined);
  } catch {
    // Product analytics must never change the Agent run outcome.
  }
}
