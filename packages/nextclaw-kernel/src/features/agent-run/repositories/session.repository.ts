import {
  eventKeys,
  type EventBus,
} from "@nextclaw/shared";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import { DEFAULT_AGENT_RUNTIME_ENTRY_ID } from "@kernel/configs/agent-runtime.config.js";
import type { ThinkingEffort } from "@kernel/features/agent-run/types/agent-run.types.js";
import type { NcpSessionManager } from "@kernel/managers/ncp-session.manager.js";

export type AgentRunSession = {
  sessionId: string;
  agentId?: string;
  agentRuntimeId: string;
  metadata: Record<string, unknown>;
  model?: string;
  projectRoot?: string;
  thinkingEffort?: ThinkingEffort | null;
};

export type CreateAgentRunSessionParams = {
  agentId?: string;
  agentRuntimeId?: string;
  channel?: string;
  model?: string;
  projectRoot?: string;
  thinkingEffort?: ThinkingEffort | null;
};

function readString(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}

function readEventSessionId(event: NcpEndpointEvent): string | undefined {
  return "payload" in event && "sessionId" in event.payload
    ? readString(event.payload.sessionId)
    : undefined;
}

function isDurableSessionEvent(event: NcpEndpointEvent): boolean {
  return event.type !== NcpEventType.ContextWindowUpdated;
}

function readStoredAgentRuntimeId(metadata: Record<string, unknown> | undefined): string | undefined {
  return readString(metadata?.agentRuntimeId);
}

function readModel(metadata: Record<string, unknown> | undefined): string | undefined {
  return readString(metadata?.model);
}

function readThinkingEffort(metadata: Record<string, unknown> | undefined): ThinkingEffort | null {
  return readString(metadata?.thinkingEffort) ?? null;
}

function readProjectRoot(metadata: Record<string, unknown> | undefined): string | undefined {
  return readString(metadata?.project_root) ?? readString(metadata?.projectRoot);
}

export class SessionRepository {
  readonly cleanups: Array<() => void> = [];
  private started = false;

  constructor(
    private readonly eventBus: EventBus,
    private readonly ncpSessionManager: NcpSessionManager,
  ) {}

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(this.eventBus.on(eventKeys.ncpEvent, async (event) => {
      const sessionId = readEventSessionId(event);
      if (!sessionId || !isDurableSessionEvent(event)) {
        return;
      }
      await this.appendSessionEvent(sessionId, event);
    }));
  };

  dispose = (): void => {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
    this.started = false;
  };

  getSession = async (sessionId: string): Promise<AgentRunSession> => {
    const record = await this.ncpSessionManager.getSessionRecord(sessionId);
    if (!record) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const agentRuntimeId = readStoredAgentRuntimeId(record.metadata) ??
      DEFAULT_AGENT_RUNTIME_ENTRY_ID;
    const model = readModel(record.metadata);
    return {
      sessionId: record.sessionId,
      agentId: record.agentId,
      agentRuntimeId,
      metadata: structuredClone(record.metadata ?? {}),
      model,
      projectRoot: readProjectRoot(record.metadata),
      thinkingEffort: readThinkingEffort(record.metadata),
    };
  };

  createSession = async (params: CreateAgentRunSessionParams): Promise<AgentRunSession> => {
    const {
      agentId,
      agentRuntimeId: requestedAgentRuntimeId,
      channel,
      model,
      projectRoot,
      thinkingEffort,
    } = params;
    const agentRuntimeId = requestedAgentRuntimeId ?? DEFAULT_AGENT_RUNTIME_ENTRY_ID;
    const created = await this.ncpSessionManager.createSession({
      sourceSessionMetadata: {},
      task: "Session",
      agentId,
      metadataOverrides: {
        agentRuntimeId,
        channel,
      },
      model,
      projectRoot,
      runtime: agentRuntimeId,
      sessionType: agentRuntimeId,
      thinkingLevel: thinkingEffort ?? undefined,
    });
    return {
      sessionId: created.sessionId,
      agentId,
      agentRuntimeId,
      metadata: structuredClone(created.metadata ?? {}),
      model,
      projectRoot,
      thinkingEffort: thinkingEffort ?? null,
    };
  };

  listSessionMessages = async (sessionId: string): Promise<readonly NcpMessage[]> => {
    return await this.ncpSessionManager.listSessionMessages(sessionId);
  };

  private appendSessionEvent = async (
    sessionId: string,
    event: NcpEndpointEvent,
  ): Promise<void> => {
    await this.ncpSessionManager.appendSessionEvent({
      event,
      sessionId,
    });
  };
}
