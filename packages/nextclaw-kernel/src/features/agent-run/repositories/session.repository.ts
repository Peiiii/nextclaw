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
  sessionId?: string;
  agentId?: string;
  agentRuntimeId?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
  model?: string;
  projectRoot?: string;
  task?: string;
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

function readThinkingEffort(metadata: Record<string, unknown> | undefined): ThinkingEffort | null {
  return readString(metadata?.thinkingEffort) ?? null;
}

function readProjectRoot(metadata: Record<string, unknown> | undefined): string | undefined {
  return readString(metadata?.project_root) ?? readString(metadata?.projectRoot);
}

export class SessionRepository {
  readonly cleanups: Array<() => void> = [];
  private started = false;
  private runStatusSource: { isSessionRunning: (sessionId: string) => boolean } | null = null;

  constructor(
    private readonly eventBus: EventBus,
    private readonly ncpSessionManager: NcpSessionManager,
  ) {}

  bindRunStatusSource = (source: { isSessionRunning: (sessionId: string) => boolean }): void => {
    this.runStatusSource = source;
  };

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
    const agentRuntimeId = readString(record.metadata?.agentRuntimeId) ??
      DEFAULT_AGENT_RUNTIME_ENTRY_ID;
    const model = readString(record.metadata?.model);
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
      metadata,
      model,
      projectRoot,
      sessionId,
      task,
      thinkingEffort,
    } = params;
    const agentRuntimeId = requestedAgentRuntimeId ?? DEFAULT_AGENT_RUNTIME_ENTRY_ID;
    const created = await this.ncpSessionManager.createSession({
      sourceSessionMetadata: {},
      sessionId,
      task: task ?? "Session",
      agentId,
      metadataOverrides: {
        ...structuredClone(metadata ?? {}),
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

  getOrCreateSession = async (
    params: CreateAgentRunSessionParams,
  ): Promise<AgentRunSession> => {
    if (!params.sessionId) {
      return await this.createSession(params);
    }
    const existing = await this.ncpSessionManager.getSessionRecord(params.sessionId);
    if (existing) {
      return await this.getSession(params.sessionId);
    }
    return await this.createSession(params);
  };

  listSessionMessages = async (sessionId: string): Promise<readonly NcpMessage[]> => {
    return await this.ncpSessionManager.listSessionMessages(sessionId);
  };

  isSessionRunning = (sessionId: string): boolean => this.runStatusSource?.isSessionRunning(sessionId.trim()) ?? false;

  patchSessionMetadata = async (
    sessionId: string,
    patch: Record<string, unknown>,
  ): Promise<void> => {
    const updated = await this.ncpSessionManager.updateSessionMetadata(sessionId, patch);
    if (!updated) {
      throw new Error(`Session metadata was not updated: ${sessionId}`);
    }
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
