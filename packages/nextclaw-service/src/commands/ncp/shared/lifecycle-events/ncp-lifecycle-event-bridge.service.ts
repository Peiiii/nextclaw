import type { GlobalTypedEventBus, SessionManager } from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import {
  agentMessageSentLifecycleEventKey,
  agentRunFinishedLifecycleEventKey,
  agentRunStartedLifecycleEventKey,
  agentSessionUpdatedLifecycleEventKey,
} from "./ncp-lifecycle-event.config.js";
import type {
  AgentLifecycleSessionContext,
  AgentMessageSentLifecycleEvent,
  AgentRunFinishedLifecycleEvent,
  AgentRunStartedLifecycleEvent,
  AgentSessionUpdatedLifecycleEvent,
} from "./ncp-lifecycle-event.types.js";
import { readParentSessionId } from "../../session-request/session-request-result.js";

function readSessionType(metadata: Record<string, unknown> | undefined): string | undefined {
  const sessionType = metadata?.session_type;
  return typeof sessionType === "string" && sessionType.trim().length > 0
    ? sessionType.trim()
    : undefined;
}

export class NcpLifecycleEventBridge {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly eventBus: GlobalTypedEventBus,
  ) {}

  publishSessionUpdated = (sessionId: string): void => {
    const context = this.buildSessionContext(sessionId);
    if (!context) {
      return;
    }
    const payload: AgentSessionUpdatedLifecycleEvent = {
      ...context,
    };
    this.eventBus.emit(agentSessionUpdatedLifecycleEventKey, payload);
  };

  handleEndpointEvent = (event: NcpEndpointEvent): void => {
    switch (event.type) {
      case NcpEventType.RunStarted:
        this.publishRunStarted(event);
        return;
      case NcpEventType.RunFinished:
        this.publishRunFinished(event);
        return;
      case NcpEventType.MessageSent:
        this.publishMessageSent(event);
        return;
      default:
        return;
    }
  };

  private publishRunStarted = (
    event: Extract<NcpEndpointEvent, { type: NcpEventType.RunStarted }>,
  ): void => {
    const sessionId = event.payload.sessionId?.trim();
    if (!sessionId) {
      return;
    }
    const context = this.buildSessionContext(sessionId);
    if (!context) {
      return;
    }
    const payload: AgentRunStartedLifecycleEvent = {
      ...context,
      ...(event.payload.runId ? { runId: event.payload.runId } : {}),
      ...(event.payload.messageId ? { messageId: event.payload.messageId } : {}),
    };
    this.eventBus.emit(agentRunStartedLifecycleEventKey, payload);
  };

  private publishRunFinished = (
    event: Extract<NcpEndpointEvent, { type: NcpEventType.RunFinished }>,
  ): void => {
    const sessionId = event.payload.sessionId?.trim();
    if (!sessionId) {
      return;
    }
    const context = this.buildSessionContext(sessionId);
    if (!context) {
      return;
    }
    const payload: AgentRunFinishedLifecycleEvent = {
      ...context,
      ...(event.payload.runId ? { runId: event.payload.runId } : {}),
      ...(event.payload.messageId ? { messageId: event.payload.messageId } : {}),
    };
    this.eventBus.emit(agentRunFinishedLifecycleEventKey, payload);
  };

  private publishMessageSent = (
    event: Extract<NcpEndpointEvent, { type: NcpEventType.MessageSent }>,
  ): void => {
    const sessionId = event.payload.sessionId.trim();
    const context = this.buildSessionContext(sessionId);
    if (!context) {
      return;
    }
    const payload: AgentMessageSentLifecycleEvent = {
      ...context,
      messageId: event.payload.message.id,
      role: event.payload.message.role,
    };
    this.eventBus.emit(agentMessageSentLifecycleEventKey, payload);
  };

  private buildSessionContext = (
    sessionId: string,
  ): AgentLifecycleSessionContext | null => {
    const session = this.sessionManager.getIfExists(sessionId);
    const metadata = session?.metadata;
    const sessionType = readSessionType(metadata);
    const parentSessionId = metadata ? readParentSessionId(metadata) : undefined;
    return {
      sessionId,
      ...(sessionType ? { sessionType } : {}),
      ...(parentSessionId ? { parentSessionId } : {}),
      isChildSession: Boolean(parentSessionId),
      emittedAt: new Date().toISOString(),
    };
  };
}
