import { randomUUID } from "node:crypto";
import {
  eventKeys,
  ingressKeys,
  type AgentRunSendIngressPayload,
  type EventBus,
  type Ingress,
} from "@nextclaw/shared";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import {
  catchError,
  from,
  lastValueFrom,
  tap,
} from "rxjs";
import { resolveDefaultAgentProfileId } from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type {
  AgentRuntimeManager,
} from "./agent-runtime.manager.js";
import type { ContextProviderManager } from "./context-provider.manager.js";
import type {
  SessionRunManager,
} from "./session-run.manager.js";
import type { ToolProviderManager } from "./tool-provider.manager.js";
import type { SessionRepository } from "@kernel/features/agent-run/repositories/session.repository.js";
import type {
  AgentRunAbortRequest,
  AgentRunAccepted,
  AgentRunRequest,
  AgentRunSpec,
} from "@kernel/features/agent-run/types/agent-run.types.js";

function toAgentRunRequest(envelope: AgentRunSendIngressPayload): AgentRunRequest {
  const metadata = envelope.metadata ?? {};
  const requestMetadata = {
    agentRuntimeId: metadata.agentRuntimeId as string | undefined,
    agentId: metadata.agentId as string | undefined,
    projectRoot: metadata.projectRoot as string | undefined,
    channel: metadata.channel as string | undefined,
    correlationId: envelope.correlationId,
    model: metadata.model as string,
    maxTokens: metadata.maxTokens as number,
    thinkingEffort: metadata.thinkingEffort as string | null | undefined,
  };
  if (Array.isArray(envelope.content)) {
    return {
      ...requestMetadata,
      sessionId: envelope.sessionId,
      message: {
        sessionId: envelope.sessionId ?? "",
        id: `user-message-${randomUUID()}`,
        role: "user",
        status: "final",
        timestamp: new Date().toISOString(),
        parts: structuredClone(envelope.content),
      },
    };
  }
  const sourceMessage = envelope.message!;
  const messageSessionId = sourceMessage.sessionId;
  const message: NcpMessage = {
    ...sourceMessage,
    sessionId: messageSessionId ?? envelope.sessionId ?? "",
    id: sourceMessage.id ?? `user-message-${randomUUID()}`,
    role: sourceMessage.role ?? "user",
    status: sourceMessage.status ?? "final",
    timestamp: sourceMessage.timestamp ?? new Date().toISOString(),
    parts: structuredClone(sourceMessage.parts),
  };
  return {
    ...requestMetadata,
    sessionId: envelope.sessionId ?? messageSessionId,
    message,
  };
}

export class AgentRunRequestManager {
  readonly cleanups: Array<() => void> = [];
  private started = false;

  constructor(
    private readonly agentRuntimeManager: AgentRuntimeManager,
    private readonly configManager: ConfigManager,
    private readonly contextProviderManager: ContextProviderManager,
    private readonly eventBus: EventBus,
    private readonly ingress: Ingress,
    private readonly sessionRepository: SessionRepository,
    private readonly sessionRunManager: SessionRunManager,
    private readonly toolProviderManager: ToolProviderManager,
  ) {}

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(
      this.ingress.addHandler(ingressKeys.agentRun.send, async (envelope) => {
        return await this.send(toAgentRunRequest(envelope.payload!));
      }),
      this.ingress.addHandler(ingressKeys.agentRun.abort, async (envelope) => {
        await this.abort({ sessionId: envelope.payload!.sessionId });
      }),
    );
  };

  dispose = (): void => {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
    this.started = false;
  };

  private send = async (request: AgentRunRequest): Promise<AgentRunAccepted> => {
    const session = request.sessionId
      ? await this.sessionRepository.getSession(request.sessionId)
      : await this.sessionRepository.createSession({
        agentId: request.agentId,
        agentRuntimeId: request.agentRuntimeId,
        channel: request.channel,
        model: request.model,
        projectRoot: request.projectRoot,
        thinkingEffort: request.thinkingEffort,
      });
    const sessionRun =
      this.sessionRunManager.getSessionRun(session.sessionId) ??
      await this.sessionRunManager.createSessionRun(session.sessionId);
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
    const activeRun = sessionRun.beginRun();

    const model = request.model ?? session.model ?? this.configManager.getDefaultModel();
    const agentId = request.agentId ?? session.agentId ??
      resolveDefaultAgentProfileId(this.configManager.loadConfig());
    const spec: AgentRunSpec = {
      runId: activeRun.runId,
      agentId,
      model,
      maxTokens: request.maxTokens ?? this.configManager.getModelMaxTokens(model),
      thinkingEffort: request.thinkingEffort ?? session.thinkingEffort ?? null,
    };

    const runtime = this.agentRuntimeManager.getOrCreate(session.agentRuntimeId);
    const contextBlocks = await this.contextProviderManager.buildContext(providerRequest);
    const tools = await this.toolProviderManager.buildTools(providerRequest);
    lastValueFrom(
      from(runtime.run(spec, {
        contextBlocks,
        sessionRun,
        signal: activeRun.signal,
        tools,
      })).pipe(
        tap((event) => {
          this.eventBus.emit(eventKeys.ncpEvent, event, {
            emittedAt: new Date().toISOString(),
            source: "agent-run-request",
          });
        }),
        catchError(async (error) => {
          const event: NcpEndpointEvent = {
            type: NcpEventType.RunError,
            payload: {
              error: error instanceof Error ? error.message : String(error),
              runId: spec.runId,
              sessionId: session.sessionId,
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
    );

    return {
      sessionId: session.sessionId,
      userMessageId: message.id,
      runId: spec.runId,
    };
  };

  private abort = async (request: AgentRunAbortRequest): Promise<void> => {
    const sessionRun = this.sessionRunManager.getSessionRun(request.sessionId);
    sessionRun?.abortRun(request.runId);
  };
}
