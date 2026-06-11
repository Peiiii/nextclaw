import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";

export const SESSION_METADATA_PATCH_KIND = "session_metadata_patch";

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
    {
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
    },
  ];
}

function isPromptTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("[narp-stdio] prompt timed out");
}
