import {
  NcpEventType,
  type NcpCompletedEnvelope,
  type NcpMessage,
} from "@nextclaw/ncp";
import type { DefaultNcpAgentBackend } from "@nextclaw/ncp-toolkit";
import type {
  SessionRequestDispatcher,
  SessionRequestDispatchResult,
  SessionRequestRecord,
} from "@nextclaw/core";
import type { AgentRuntimeManager } from "./agent-runtime.manager.js";

type AgentRuntimeSessionMessageRequest = {
  sessionId: string;
  message: NcpMessage;
  onAccepted: (messageId: string) => void;
};

type PendingAgentRuntimeSessionMessageRequest = {
  request: AgentRuntimeSessionMessageRequest;
  resolve: (message: NcpCompletedEnvelope["message"] | undefined) => void;
  reject: (error: unknown) => void;
};

type AgentRuntimeSessionMessageRequestListener = (
  request: PendingAgentRuntimeSessionMessageRequest,
) => void;

function buildSessionRequestUserMessage(input: {
  sessionId: string;
  requestId: string;
  task: string;
}): NcpMessage {
  const timestamp = new Date().toISOString();
  return {
    id: `${input.sessionId}:user:session-request:${input.requestId}`,
    sessionId: input.sessionId,
    role: "user",
    status: "final",
    timestamp,
    parts: [{ type: "text", text: input.task }],
    metadata: {
      session_request_id: input.requestId,
    },
  };
}

function extractSessionMessageText(
  message: NcpMessage | undefined,
): string | undefined {
  const parts = (message?.parts ?? [])
    .flatMap((part) => part.type === "text" || part.type === "rich-text" ? [part.text] : [])
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export class AgentRuntimeRequestManager implements SessionRequestDispatcher {
  private agentRuntimeManager: AgentRuntimeManager | null = null;
  private sessionMessageRequestListener: AgentRuntimeSessionMessageRequestListener | null = null;
  private isStarted = false;

  connectAgentRuntimeManager = (agentRuntimeManager: AgentRuntimeManager): void => {
    this.agentRuntimeManager = agentRuntimeManager;
  };

  start = (): void => {
    if (this.isStarted) {
      return;
    }
    this.isStarted = true;
    this.sessionMessageRequestListener = (request) => {
      void this.processSessionMessageRequest(request);
    };
  };

  dispatch = async (input: {
    request: SessionRequestRecord;
    task: string;
    onAccepted: (messageId: string) => void;
  }): Promise<SessionRequestDispatchResult> => {
    const completedMessage = await this.submitSessionMessage({
      sessionId: input.request.targetSessionId,
      message: buildSessionRequestUserMessage({
        sessionId: input.request.targetSessionId,
        requestId: input.request.requestId,
        task: input.task,
      }),
      onAccepted: input.onAccepted,
    });
    if (!completedMessage) {
      throw new Error("Session request completed without a final reply.");
    }
    return {
      finalResponseMessageId: completedMessage.id,
      finalResponseText: extractSessionMessageText(completedMessage),
    };
  };

  private submitSessionMessage = async (
    request: AgentRuntimeSessionMessageRequest,
  ): Promise<NcpCompletedEnvelope["message"] | undefined> =>
    await new Promise((resolve, reject) => {
      const sessionMessageRequestListener = this.sessionMessageRequestListener;
      if (!sessionMessageRequestListener) {
        reject(new Error("Agent runtime request manager has not started."));
        return;
      }
      queueMicrotask(() => sessionMessageRequestListener({
        request,
        resolve,
        reject,
      }));
    });

  private processSessionMessageRequest = async (
    pendingSessionMessageRequest: PendingAgentRuntimeSessionMessageRequest,
  ): Promise<void> => {
    const agentBackend = this.agentRuntimeManager?.currentBackend;
    if (!agentBackend) {
      pendingSessionMessageRequest.reject(new Error("NCP backend is not ready for agent runtime requests."));
      return;
    }
    try {
      pendingSessionMessageRequest.resolve(await this.readCompletedMessageFromStream({
        agentBackend,
        request: pendingSessionMessageRequest.request,
      }));
    } catch (error) {
      pendingSessionMessageRequest.reject(error);
    }
  };

  private readCompletedMessageFromStream = async (input: {
    agentBackend: DefaultNcpAgentBackend;
    request: AgentRuntimeSessionMessageRequest;
  }): Promise<NcpCompletedEnvelope["message"] | undefined> => {
    let completedMessage: NcpCompletedEnvelope["message"] | undefined;
    for await (const event of input.agentBackend.send({
      sessionId: input.request.sessionId,
      message: input.request.message,
    })) {
      if (event.type === NcpEventType.MessageAccepted) {
        input.request.onAccepted(event.payload.messageId);
        continue;
      }
      if (event.type === NcpEventType.MessageFailed) {
        throw new Error(event.payload.error.message);
      }
      if (event.type === NcpEventType.RunError) {
        throw new Error(event.payload.error ?? "Session request failed.");
      }
      if (event.type === NcpEventType.MessageCompleted) {
        completedMessage = event.payload.message;
      }
    }
    return completedMessage;
  };
}
