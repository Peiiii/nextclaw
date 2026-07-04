import { createNcpEndpointEvent, NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import { NARP_STDIO_PROMPT_META_KEY } from "../stdio-runtime-config.utils.js";

export const SESSION_METADATA_PATCH_KIND = "session_metadata_patch";

export function readSessionMetadataPatch(meta: unknown): Record<string, unknown> | null {
  const narpMeta = isRecord(meta)
    ? meta[NARP_STDIO_PROMPT_META_KEY]
    : undefined;
  const patch = isRecord(narpMeta)
    ? narpMeta.sessionMetadataPatch
    : undefined;
  return isRecord(patch) && Object.keys(patch).length > 0
    ? structuredClone(patch)
    : null;
}

export function createPromptTimeoutRecoveryEvents(params: {
  correlationId?: string;
  error: unknown;
  messageId: string;
  resetKeys?: readonly string[];
  runId: string;
  sessionId: string;
}): NcpEndpointEvent[] {
  const { correlationId, error, messageId, resetKeys, runId, sessionId } = params;
  if (!resetKeys?.length || !isPromptTimeoutError(error)) {
    return [];
  }
  return [
    createNcpEndpointEvent({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId,
        messageId,
        runId,
        ...(correlationId ? { correlationId } : {}),
        metadata: {
          kind: SESSION_METADATA_PATCH_KIND,
          sessionMetadataPatch: Object.fromEntries(
            resetKeys.map((key) => [key, null]),
          ),
        },
      },
    }),
  ];
}

function isPromptTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("[narp-stdio] prompt timed out");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
