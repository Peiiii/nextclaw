import { randomUUID } from "node:crypto";
import {
  CHAT_SESSION_MATERIALIZATION_METADATA_KEY,
  eventKeys,
  ingressKeys,
  type AgentRunSessionMaterializationMetadata,
  type AgentRunSendIngressPayload,
  type AgentRunSessionMessageRequestPayload,
  type EventBus,
  type Ingress,
  type IngressEnvelope,
} from "@nextclaw/shared";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpMessageAbortPayload,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import { catchError, from, lastValueFrom, tap } from "rxjs";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { AgentRuntimeManager } from "./agent-runtime.manager.js";
import type { ContextProviderManager } from "./context-provider.manager.js";
import type { SessionRunManager } from "./session-run.manager.js";
import type { ToolProviderManager } from "./tool-provider.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type {
  AgentRunAbortRequest,
  AgentRunAccepted,
  AgentRunRequest,
  AgentRunSpec,
} from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";

function toAgentRunRequest(
  envelope: AgentRunSendIngressPayload,
): AgentRunRequest {
  const metadata = envelope.metadata ?? {};
  const peerId = readOptionalString(envelope.peerId);
  const requestMetadata = {
    agentRuntimeId: metadata.agentRuntimeId,
    agentId: metadata.agentId,
    projectRoot: metadata.projectRoot,
    channel: metadata.channel,
    correlationId: envelope.correlationId,
    metadata: structuredClone(metadata),
    model: metadata.model,
    maxTokens: metadata.maxTokens,
    thinkingEffort: metadata.thinkingEffort,
  };
  if (Array.isArray(envelope.content)) {
    const sessionId = readOptionalString(envelope.sessionId);
    if (sessionId && peerId) {
      throw new Error("agent-run.send cannot accept both sessionId and peerId.");
    }
    return {
      ...requestMetadata,
      sessionId,
      peerId,
      message: {
        sessionId: sessionId ?? "",
        id: `user-message-${randomUUID()}`,
        role: "user",
        status: "final",
        timestamp: new Date().toISOString(),
        parts: structuredClone(envelope.content),
      },
    };
  }
  const sourceMessage = envelope.message;
  if (!sourceMessage) {
    throw new Error("Invalid agent run send request.");
  }
  const envelopeSessionId = readOptionalString(envelope.sessionId);
  const messageSessionId = readOptionalString(sourceMessage.sessionId);
  const sessionId = envelopeSessionId ?? messageSessionId;
  if (sessionId && peerId) {
    throw new Error("agent-run.send cannot accept both sessionId and peerId.");
  }
  const message: NcpMessage = {
    ...sourceMessage,
    sessionId: sessionId ?? "",
    id: sourceMessage.id ?? `user-message-${randomUUID()}`,
    role: sourceMessage.role ?? "user",
    status: sourceMessage.status ?? "final",
    timestamp: sourceMessage.timestamp ?? new Date().toISOString(),
    parts: structuredClone(sourceMessage.parts),
  };
  return {
    ...requestMetadata,
    sessionId,
    peerId,
    message,
  };
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readSessionMaterialization(
  metadata: Record<string, unknown>,
): AgentRunSessionMaterializationMetadata | null {
  const value = metadata[CHAT_SESSION_MATERIALIZATION_METADATA_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const materialization = value as Partial<AgentRunSessionMaterializationMetadata>;
  if (materialization.kind !== "child") {
    throw new Error("session_materialization.kind must be \"child\".");
  }
  const parentSessionId = readOptionalString(materialization.parentSessionId);
  if (!parentSessionId) {
    throw new Error("session_materialization.parentSessionId is required.");
  }
  if (materialization.inheritContext !== true) {
    throw new Error("session_materialization.inheritContext must be true.");
  }
  return {
    kind: "child",
    parentSessionId,
    inheritContext: true,
  };
}

function toRunHandle(accepted: AgentRunAccepted): NcpRunHandle {
  return {
    sessionId: accepted.sessionId,
    userMessageId: accepted.userMessageId,
    assistantMessageId: null,
    runId: accepted.runId,
    correlationId: accepted.correlationId,
  };
}

function findCompletedAssistantMessage(
  messages: readonly NcpMessage[],
  messageId?: string,
): NcpMessage | null {
  return (
    [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          message.status === "final" &&
          (!messageId || message.id === messageId),
      ) ?? null
  );
}

function readMessageTask(message: NcpMessage): string {
  return (
    message.parts.flatMap((part) =>
      (part.type === "text" ||
        part.type === "rich-text" ||
        part.type === "reasoning") &&
      part.text.trim()
        ? [part.text.trim()]
        : [],
    )[0] ?? "Session"
  );
}

export class AgentRunRequestManager {
  readonly cleanups: Array<() => void> = [];
  private started = false;

  constructor(
    private readonly agentRuntimeManager: AgentRuntimeManager,
    private readonly agentManager: AgentManager,
    private readonly configManager: ConfigManager,
    private readonly contextProviderManager: ContextProviderManager,
    private readonly eventBus: EventBus,
    private readonly ingress: Ingress,
    private readonly sessionManager: SessionManager,
    private readonly sessionRunManager: SessionRunManager,
    private readonly toolProviderManager: ToolProviderManager,
  ) {}

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(
      this.ingress.addHandler(
        ingressKeys.agentRun.send,
        this.handleSendRequest,
      ),
      this.ingress.addHandler(
        ingressKeys.agentRun.abort,
        this.handleAbortRequest,
      ),
      this.ingress.addHandler(
        ingressKeys.agentRun.sessionMessageRequest,
        this.handleSessionMessageRequest,
      ),
    );
  };

  dispose = (): void => {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
    this.started = false;
  };

  private handleSendRequest = async (
    envelope: IngressEnvelope<AgentRunSendIngressPayload>,
  ): Promise<NcpRunHandle> => {
    if (!envelope.payload) {
      throw new Error("Invalid agent run send request.");
    }
    return toRunHandle(await this.send(toAgentRunRequest(envelope.payload)));
  };

  private handleAbortRequest = async (
    envelope: IngressEnvelope<NcpMessageAbortPayload>,
  ): Promise<void> => {
    if (!envelope.payload?.sessionId) {
      throw new Error("Invalid agent run abort request.");
    }
    await this.abort({ sessionId: envelope.payload.sessionId });
  };

  private handleSessionMessageRequest = async (
    envelope: IngressEnvelope<AgentRunSessionMessageRequestPayload>,
  ): Promise<NcpRunHandle> => {
    if (!envelope.payload) {
      throw new Error("Invalid agent run session message request.");
    }
    return toRunHandle(
      await this.send({
        sessionId: envelope.payload.sessionId,
        message: {
          ...envelope.payload.message,
          sessionId: envelope.payload.sessionId,
        },
        correlationId: envelope.payload.requestId,
      }),
    );
  };

  private send = async (
    request: AgentRunRequest,
  ): Promise<AgentRunAccepted> => {
    const session = await this.getOrCreateSessionForRequest(request);
    const sessionRun =
      this.sessionRunManager.getSessionRun(session.sessionId) ??
      (await this.sessionRunManager.createSessionRun(session.sessionId));
    const message: NcpMessage = {
      ...request.message,
      sessionId: session.sessionId,
    };
    const providerRequest: AgentRunRequest = {
      ...request,
      sessionId: session.sessionId,
      message,
    };
    sessionRun.inbox.enqueue(message);
    let stopPublishingRunStatus = (): void => undefined;
    stopPublishingRunStatus = sessionRun.onStatusChange((status) => {
      this.eventBus.emit(eventKeys.sessionRunStatus, {
        sessionKey: sessionRun.sessionId,
        status,
      }, {
        emittedAt: new Date().toISOString(),
        source: "agent-run-request",
      });
      if (status === "idle") {
        stopPublishingRunStatus();
      }
    });
    this.cleanups.push(stopPublishingRunStatus);
    const activeRun = (() => {
      try {
        return sessionRun.beginRun();
      } catch (error) {
        stopPublishingRunStatus();
        throw error;
      }
    })();

    const model =
      request.model ?? session.model ?? this.configManager.getDefaultModel();
    const agentId =
      request.agentId ??
      session.agentId ??
      this.agentManager.getDefaultAgentId();
    const spec: AgentRunSpec = {
      runId: activeRun.runId,
      agentId,
      model,
      maxTokens: request.maxTokens ?? this.configManager.getModelMaxTokens(model),
      thinkingEffort: request.thinkingEffort ?? session.thinkingEffort ?? null,
      correlationId: request.correlationId,
    };

    const runtime = this.agentRuntimeManager.getOrCreate({
      agentRuntimeId: session.agentRuntimeId,
      session,
      sessionRun,
    });
    const contextBlocks =
      await this.contextProviderManager.buildContext(providerRequest);
    const tools = await this.toolProviderManager.buildTools(providerRequest);
    let messageCompletedSeen = false;
    let runtimeFailed = false;
    void lastValueFrom(
      from(
        runtime.run(spec, {
          contextBlocks,
          session,
          sessionRun,
          signal: activeRun.signal,
          tools,
        }),
      ).pipe(
        tap((event) => {
          const eventsToPublish: NcpEndpointEvent[] = [];
          if (event.type === NcpEventType.RunError) {
            runtimeFailed = true;
          }
          if (event.type === NcpEventType.MessageCompleted) {
            messageCompletedSeen = true;
          }
          if (
            event.type === NcpEventType.RunFinished &&
            !messageCompletedSeen
          ) {
            const message = findCompletedAssistantMessage(
              sessionRun.getSnapshot().messages,
              event.payload.messageId,
            );
            if (!message) {
              throw new Error(
                `Run finished without a final assistant message for session "${session.sessionId}".`,
              );
            }
            eventsToPublish.push({
              type: NcpEventType.MessageCompleted,
              payload: {
                sessionId: event.payload.sessionId ?? session.sessionId,
                message,
                correlationId: event.payload.correlationId,
              },
            });
            messageCompletedSeen = true;
          }
          eventsToPublish.push(event);
          for (const eventToPublish of eventsToPublish) {
            this.eventBus.emit(eventKeys.ncpEvent, eventToPublish, {
              emittedAt: new Date().toISOString(),
              source: "agent-run-request",
            });
          }
        }),
        catchError(async (error) => {
          runtimeFailed = true;
          const event: NcpEndpointEvent = {
            type: NcpEventType.RunError,
            payload: {
              error: error instanceof Error ? error.message : String(error),
              runId: spec.runId,
              sessionId: session.sessionId,
              correlationId: spec.correlationId,
            },
          };
          await sessionRun.applyEvents([event]);
          this.eventBus.emit(eventKeys.ncpEvent, event, {
            emittedAt: new Date().toISOString(),
            source: "agent-run-request",
          });
        }),
      ),
      { defaultValue: undefined },
    ).finally(() => {
      if (!runtimeFailed) {
        return;
      }
      void this.agentRuntimeManager.disposeRuntime({
        agentRuntimeId: session.agentRuntimeId,
        session,
        sessionRun,
      }).catch(() => undefined);
    });

    return {
      sessionId: session.sessionId,
      userMessageId: message.id,
      runId: spec.runId,
      correlationId: request.correlationId,
    };
  };

  private getOrCreateSessionForRequest = async (
    request: AgentRunRequest,
  ): Promise<AgentRunSession> => {
    const sessionMaterialization = readSessionMaterialization(
      request.metadata ?? {},
    );
    if (sessionMaterialization && (request.sessionId || request.peerId)) {
      throw new Error("session_materialization requires a new session request.");
    }
    return await this.sessionManager.getOrCreateAgentRunSession({
      sessionId: request.sessionId,
      peerId: request.peerId,
      agentId: request.agentId,
      agentRuntimeId: request.agentRuntimeId,
      channel: request.channel,
      contextInheritance: sessionMaterialization
        ? {}
        : undefined,
      metadata: request.metadata,
      model: request.model,
      parentSessionId: sessionMaterialization?.parentSessionId,
      projectRoot: request.projectRoot,
      sourceSessionId: sessionMaterialization?.parentSessionId,
      task: readMessageTask(request.message),
      thinkingEffort: request.thinkingEffort,
    });
  };

  private abort = async (request: AgentRunAbortRequest): Promise<void> => {
    const sessionRun = this.sessionRunManager.getSessionRun(request.sessionId);
    sessionRun?.abortRun(request.runId);
  };
}
