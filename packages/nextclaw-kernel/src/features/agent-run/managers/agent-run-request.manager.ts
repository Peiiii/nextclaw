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
  type NcpRunHandle,
} from "@nextclaw/ncp";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { NcpSessionManager } from "@kernel/managers/ncp-session.manager.js";
import type {
  AgentRuntime,
  AgentRuntimeManager,
} from "./agent-runtime.manager.js";
import type { ContextProviderManager } from "./context-provider.manager.js";
import type {
  SessionRun,
  SessionRunManager,
} from "./session-run.manager.js";
import type { ToolProviderManager } from "./tool-provider.manager.js";
import type {
  AgentRunAbortRequest,
  AgentRunRequest,
  AgentRunSpec,
} from "@kernel/features/agent-run/types/agent-run.types.js";

type ActiveRun = {
  controller: AbortController;
  runId: string;
};

type RunEventContext = {
  sessionId: string;
};

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
  private readonly activeRuns = new Map<string, ActiveRun>();
  private readonly cleanups: Array<() => void> = [];
  private started = false;

  constructor(
    private readonly agentRuntimeManager: AgentRuntimeManager,
    private readonly configManager: ConfigManager,
    private readonly contextProviderManager: ContextProviderManager,
    private readonly eventBus: EventBus,
    private readonly ingress: Ingress,
    private readonly ncpSessionManager: NcpSessionManager,
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
    for (const activeRun of this.activeRuns.values()) {
      activeRun.controller.abort();
    }
    this.activeRuns.clear();
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
    this.started = false;
  };

  private send = async (request: AgentRunRequest): Promise<NcpRunHandle> => {
    const requestedSessionId = request.sessionId;
    let sessionId: string;
    let messages: readonly NcpMessage[];

    if (requestedSessionId) {
      const record = await this.ncpSessionManager.getSessionRecord(requestedSessionId);
      if (!record) {
        throw new Error(`Session not found: ${requestedSessionId}`);
      }
      sessionId = record.sessionId;
      messages = await this.ncpSessionManager.listSessionMessages(record.sessionId);
    } else {
      const task = request.message.parts
        .map((part) =>
          part.type === "text" || part.type === "rich-text" || part.type === "reasoning"
            ? part.text.trim()
            : "")
        .find(Boolean) ?? "Session";
      const createdSession = await this.ncpSessionManager.createSession({
        agentId: request.agentId,
        metadataOverrides: {
          ...(request.agentRuntimeId ? { agentRuntimeId: request.agentRuntimeId } : {}),
          ...(request.channel ? { channel: request.channel } : {}),
          ...(request.projectRoot ? { projectRoot: request.projectRoot } : {}),
        },
        model: request.model,
        projectRoot: request.projectRoot,
        runtime: request.agentRuntimeId,
        sessionType: request.agentRuntimeId,
        sourceSessionMetadata: {},
        task,
        thinkingLevel: request.thinkingEffort ?? undefined,
      });
      sessionId = createdSession.sessionId;
      messages = [];
    }

    const sessionRun =
      this.sessionRunManager.getSessionRun(sessionId) ??
      this.sessionRunManager.createSessionRun({ sessionId, messages });
    const resolvedRequest = {
      ...request,
      message: {
        ...request.message,
        sessionId,
      },
      sessionId,
    };
    sessionRun.inbox.enqueue(resolvedRequest.message);

    const config = this.configManager.loadConfig();
    const model = resolvedRequest.model ?? config.agents.defaults.model;
    const modelParams = config.agents.defaults.models[model]?.params;
    const maxTokens = resolvedRequest.maxTokens ??
      (typeof modelParams?.max_tokens === "number" ? modelParams.max_tokens : 4096);
    const spec: AgentRunSpec = {
      runId: `agent-run-${randomUUID()}`,
      model,
      maxTokens: Math.trunc(maxTokens),
      ...(resolvedRequest.thinkingEffort !== undefined ? { thinkingEffort: resolvedRequest.thinkingEffort } : {}),
    };

    const controller = new AbortController();
    const runtime = this.agentRuntimeManager.getOrCreate(resolvedRequest.agentRuntimeId ?? "default");
    const activeRun = {
      controller,
      runId: spec.runId,
    };
    sessionRun.startRun(spec.runId);
    this.activeRuns.set(sessionId, activeRun);
    void this.consumeRuntimeEvents({
      activeRun,
      request: resolvedRequest,
      runtime,
      sessionRun,
      spec,
    });
    return {
      sessionId,
      userMessageId: request.message.id,
      assistantMessageId: null,
      runId: spec.runId,
      ...(request.correlationId ? { correlationId: request.correlationId } : {}),
    };
  };

  private abort = async (request: AgentRunAbortRequest): Promise<void> => {
    const activeRun = this.activeRuns.get(request.sessionId);
    if (!activeRun || (request.runId && activeRun.runId !== request.runId)) {
      return;
    }
    const sessionRun = this.sessionRunManager.getSessionRun(request.sessionId)!;
    activeRun.controller.abort();
    const event: NcpEndpointEvent = {
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId: request.sessionId,
      },
    };
    await sessionRun.applyEvents([event]);
    await this.publishRunEvent(request, event);
    sessionRun.finishRun(activeRun.runId);
    this.activeRuns.delete(request.sessionId);
  };

  private consumeRuntimeEvents = async (params: {
    activeRun: ActiveRun;
    request: Required<Pick<AgentRunRequest, "sessionId">> & AgentRunRequest;
    runtime: AgentRuntime;
    sessionRun: SessionRun;
    spec: AgentRunSpec;
  }): Promise<void> => {
    const {
      activeRun,
      request,
      runtime,
      sessionRun,
      spec,
    } = params;
    try {
      const contextBlocks = await this.contextProviderManager.buildContext(request);
      const tools = await this.toolProviderManager.buildTools(request);
      for await (const event of runtime.run(spec, {
        contextBlocks,
        sessionRun,
        signal: activeRun.controller.signal,
        tools,
      })) {
        if (activeRun.controller.signal.aborted) {
          break;
        }
        await this.publishRunEvent(request, event);
      }
    } catch (error) {
      if (!activeRun.controller.signal.aborted) {
        await this.publishRunEvent(request, {
          type: NcpEventType.RunError,
          payload: {
            error: error instanceof Error ? error.message : String(error),
            runId: spec.runId,
            sessionId: request.sessionId,
          },
        });
      }
    } finally {
      this.activeRuns.delete(request.sessionId);
      sessionRun.finishRun(spec.runId);
    }
  };

  private publishRunEvent = async (
    request: RunEventContext,
    event: NcpEndpointEvent,
  ): Promise<void> => {
    if (event.type !== NcpEventType.ContextWindowUpdated) {
      await this.ncpSessionManager.appendSessionEvent({
        event,
        sessionId: request.sessionId,
      });
    }
    this.eventBus.emit(eventKeys.ncpEvent, event, {
      emittedAt: new Date().toISOString(),
      source: "agent-run-request",
    });
  };

}
