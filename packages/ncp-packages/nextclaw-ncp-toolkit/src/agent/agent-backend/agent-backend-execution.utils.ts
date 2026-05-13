import type { NcpRequestEnvelope } from "@nextclaw/ncp";
import { NcpErrorException } from "../../errors/ncp-error-exception.js";
import type {
  LiveSessionExecution,
  LiveSessionState,
} from "./agent-backend.types.js";

export function startAgentBackendSessionExecution(params: {
  session: LiveSessionState;
  envelope: NcpRequestEnvelope;
  signal?: AbortSignal;
  onStatusChanged?: (payload: {
    sessionKey: string;
    status: "running" | "idle";
  }) => void;
}): LiveSessionExecution {
  const { session, envelope, signal, onStatusChanged } = params;
  if (session.activeExecution && !session.activeExecution.closed) {
    throw new NcpErrorException(
      "runtime-error",
      `Session ${session.sessionId} already has an active execution.`,
      { sessionId: session.sessionId },
    );
  }

  const controller = new AbortController();
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  const execution: LiveSessionExecution = {
    controller,
    requestEnvelope: structuredClone(envelope),
    abortHandled: false,
    closed: false,
  };
  session.activeExecution = execution;
  onStatusChanged?.({ sessionKey: session.sessionId, status: "running" });
  return execution;
}

export function finishAgentBackendSessionExecution(params: {
  session: LiveSessionState;
  execution: LiveSessionExecution;
  onStatusChanged?: (payload: {
    sessionKey: string;
    status: "running" | "idle";
  }) => void;
}): void {
  const { session, execution, onStatusChanged } = params;
  if (session.activeExecution === execution) {
    session.activeExecution = null;
    onStatusChanged?.({ sessionKey: session.sessionId, status: "idle" });
  }
}
