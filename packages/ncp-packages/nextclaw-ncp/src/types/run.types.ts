/**
 * Run-related types: snapshot state and run.metadata schema conventions.
 * Not event payloads — event payloads live in events.types.ts.
 */

/** Current run state for agent snapshot. Used by UI for run status and abort. */
export type NcpRunContext = {
  runId: string | null;
  sessionId?: string;
  abortDisabledReason?: string | null;
};

/** Command acknowledgement returned after a user message has been accepted. */
export type NcpRunHandle = {
  sessionId: string;
  userMessageId: string;
  assistantMessageId: string | null;
  runId: string | null;
  correlationId?: string;
};

/** Schema for run.metadata.metadata when kind is "ready" (run started, backend ready). */
export type NcpRunReadyMetadata = {
  kind: "ready";
  runId?: string;
  sessionId?: string;
  supportsAbort?: boolean;
  abortDisabledReason?: string;
};

/** Schema for run.metadata.metadata when kind is "final" (run finished). */
export type NcpRunFinalMetadata = {
  kind: "final";
  sessionId?: string;
};
