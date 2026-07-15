import { randomUUID } from "node:crypto";
import type {
  CreatedSession,
  CreateSessionInput,
  SessionSearchService,
} from "@nextclaw/core";
import { BUILTIN_MAIN_AGENT_ID } from "@nextclaw/core";
import type {
  ListMessagesOptions,
  ListSessionsOptions,
  NcpMessage,
  NcpSessionApi,
  NcpSessionPatch,
  NcpSessionSummary,
} from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { DEFAULT_AGENT_RUNTIME_ENTRY_ID } from "@kernel/configs/agent-runtime.config.js";
import { ContextWindowPreviewManager } from "@kernel/features/context-compaction/index.js";
import type { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import type {
  AgentRunSession,
  CreateAgentRunSessionParams,
  SessionSettingsPatch,
} from "@kernel/types/session.types.js";
import {
  createNcpAgentSessionSummary,
  type NcpAgentSessionJournalReplayEvent,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { createAgentPeerSessionIdentity } from "@kernel/utils/agent-peer-session.utils.js";
import {
  applySessionSettingsMetadataPatch,
  applyLimit,
  normalizeSessionId,
  readOptionalMetadataString,
  readOptionalString,
} from "@kernel/utils/session-manager.utils.js";
import {
  applySessionOverrides,
  cloneInheritedMetadata,
  DEFAULT_SESSION_LIFECYCLE,
  DEFAULT_SESSION_TYPE,
  mergeMetadataOverrides,
  readAgentRuntimeId,
  readProjectRoot,
  readThinkingEffort,
  resolveSessionType,
  summarizeTask,
} from "@kernel/utils/session-creation.utils.js";
import { createSessionContextInheritance } from "@kernel/utils/session-context-inheritance.utils.js";
import {
  eventKeys,
  type EventBus,
} from "@nextclaw/shared";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { ProjectManager } from "@kernel/managers/project.manager.js";
import { SessionEventIngestionService } from "@kernel/services/session-event-ingestion.service.js";
import { SessionWorkingDirResolver } from "@kernel/services/session-working-dir-resolver.service.js";

type CreateNcpSessionInput = CreateSessionInput & {
  sessionId?: string;
};

export type SessionManagerOptions = {
  agentManager: AgentManager;
  configManager: ConfigManager;
  eventBus: EventBus;
  journalStore: NcpAgentSessionJournalStore;
  projectManager: ProjectManager;
  sessionSearch: SessionSearchService;
};

function buildSessionId(): string {
  return `ncp-${Date.now().toString(36)}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function isSessionSummaryRefreshEvent(event: NcpAgentSessionJournalReplayEvent): boolean {
  switch (event.type) {
    case NcpEventType.MessageSent:
    case NcpEventType.MessageCompleted:
    case NcpEventType.MessageAbort:
    case NcpEventType.RunFinished:
    case NcpEventType.RunError:
      return true;
    default:
      return false;
  }
}

export class SessionManager implements NcpSessionApi {
  readonly cleanups: Array<() => void> = [];
  private readonly contextWindowPreview: ContextWindowPreviewManager;
  private readonly eventIngestion: SessionEventIngestionService;
  private readonly workingDirResolver: SessionWorkingDirResolver;
  private started = false;

  constructor(private readonly options: SessionManagerOptions) {
    this.eventIngestion = new SessionEventIngestionService({
      appendSessionEvent: (params) => this.appendSessionEvent(params),
      getSessionRecord: (sessionId) => this.getSessionRecord(sessionId),
      onError: (sessionId, error) => {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        console.error(`[session-manager] failed to handle ncp event for ${sessionId}: ${message}`);
      },
      updateSessionMetadata: (sessionId, metadata) =>
        this.updateSessionMetadata(sessionId, metadata),
    });
    this.contextWindowPreview = new ContextWindowPreviewManager(options.agentManager);
    this.workingDirResolver = new SessionWorkingDirResolver(options.agentManager);
  }

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(this.options.eventBus.on(eventKeys.ncpEvent, this.eventIngestion.handleEvent));
  };

  dispose = (): void => {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
    this.eventIngestion.clear();
    this.started = false;
  };

  createSession = async (params: CreateNcpSessionInput): Promise<CreatedSession> => {
    const {
      agentId: requestedAgentId,
      contextInheritance,
      metadataOverrides,
      model,
      parentSessionId: rawParentSessionId,
      projectRoot,
      requestId: rawRequestId,
      runtime,
      sessionId: requestedSessionId,
      sessionType: requestedSessionType,
      sourceSessionId,
      sourceSessionMetadata,
      task,
      thinkingLevel,
      title: requestedTitle,
    } = params;
    const sourceRecord = sourceSessionId
      ? await this.getSessionRecord(sourceSessionId)
      : null;
    const metadata = cloneInheritedMetadata(sourceSessionMetadata);
    const title = readOptionalString(requestedTitle) ?? summarizeTask(task);
    const parentSessionId = readOptionalString(rawParentSessionId);
    const requestId = readOptionalString(rawRequestId);
    const sessionType = resolveSessionType({
      runtime,
      sessionType: requestedSessionType,
      metadata,
    });
    applySessionOverrides({
      lifecycle: DEFAULT_SESSION_LIFECYCLE,
      metadata,
      model,
      parentSessionId: parentSessionId ?? undefined,
      projectRoot: undefined,
      requestId: requestId ?? undefined,
      sessionType,
      thinkingLevel,
      title,
    });
    const now = new Date().toISOString();
    const nextMetadata = mergeMetadataOverrides(metadata, metadataOverrides);
    const requestedProjectRoot = projectRoot !== undefined
      ? projectRoot
      : readProjectRoot(nextMetadata);
    if (requestedProjectRoot !== undefined) {
      const normalizedProjectRoot = await this.options.projectManager.normalizeSessionProjectRoot(
        requestedProjectRoot,
      );
      delete nextMetadata.projectRoot;
      if (normalizedProjectRoot) {
        nextMetadata.project_root = normalizedProjectRoot;
      } else {
        delete nextMetadata.project_root;
      }
    }
    const agentId =
      readOptionalString(requestedAgentId) ??
      readOptionalString(sourceRecord?.agentId) ??
      BUILTIN_MAIN_AGENT_ID;
    const sessionId = readOptionalString(requestedSessionId) ?? buildSessionId();
    const inheritedContext = createSessionContextInheritance({
      childSessionId: sessionId,
      contextInheritance,
      metadata: nextMetadata,
      parentSessionId,
      sourceRecord,
    });
    const record: AgentSessionRecord = {
      sessionId,
      ...(agentId ? { agentId } : {}),
      messages: inheritedContext.messages,
      createdAt: now,
      updatedAt: now,
      metadata: inheritedContext.metadata,
    };
    await this.options.journalStore.importSessionSnapshot(record);
    await this.publishSessionChange(sessionId);
    return {
      sessionId,
      agentId,
      sessionType,
      runtimeFamily: sessionType === DEFAULT_SESSION_TYPE ? "native" : "external",
      ...(parentSessionId ? { parentSessionId } : {}),
      ...(requestId ? { spawnedByRequestId: requestId } : {}),
      lifecycle: DEFAULT_SESSION_LIFECYCLE,
      title,
      metadata: inheritedContext.metadata,
      createdAt: now,
      updatedAt: now,
    };
  };

  appendSessionEvent = async (params: {
    sessionId: string;
    event: NcpAgentSessionJournalReplayEvent;
  }): Promise<void> => {
    const { event } = params;
    const sessionId = normalizeSessionId(params.sessionId);
    if (!sessionId) {
      return;
    }
    await this.options.journalStore.appendSessionEvent({
      event,
      sessionId,
    });
    if (isSessionSummaryRefreshEvent(event)) {
      await this.publishSessionChange(sessionId);
    }
  };

  setSessionMetadata = async (
    sessionId: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return false;
    }
    const updated = await this.options.journalStore.setSessionMetadata({
      sessionId: normalizedSessionId,
      metadata: structuredClone(metadata),
    });
    if (!updated) {
      return false;
    }
    this.publishSessionMetadataChanged(normalizedSessionId, metadata, "set");
    await this.publishSessionChange(normalizedSessionId);
    return true;
  };

  updateSessionMetadata = async (
    sessionId: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return false;
    }
    const updated = await this.options.journalStore.updateSessionMetadata({
      sessionId: normalizedSessionId,
      metadata: structuredClone(metadata),
    });
    if (!updated) {
      return false;
    }
    this.publishSessionMetadataChanged(normalizedSessionId, metadata, "update");
    await this.publishSessionChange(normalizedSessionId);
    return true;
  };

  updateSession = async (
    sessionId: string,
    patch: NcpSessionPatch,
  ): Promise<NcpSessionSummary | null> => {
    if (!Object.prototype.hasOwnProperty.call(patch, "metadata")) {
      return await this.getSession(sessionId);
    }
    const updated = patch.metadata === null
      ? await this.setSessionMetadata(sessionId, {})
      : await this.updateSessionMetadata(sessionId, patch.metadata ?? {});
    return updated ? await this.getSession(sessionId) : null;
  };

  patchSessionSettings = async (
    sessionId: string,
    patch: SessionSettingsPatch,
    options: { createIfMissing?: boolean } = {},
  ): Promise<NcpSessionSummary | null> => {
    let existing = await this.getSessionRecord(sessionId);
    if (!existing && options.createIfMissing) {
      await this.createSession({
        sessionId,
        sourceSessionMetadata: {},
        task: "Session",
      });
      existing = await this.getSessionRecord(sessionId);
    }
    if (!existing) {
      return null;
    }
    const metadata = applySessionSettingsMetadataPatch(existing.metadata ?? {}, patch);
    await this.applySessionProjectPatch(metadata, patch);

    return await this.setSessionMetadata(sessionId, metadata)
      ? await this.getSession(sessionId)
      : null;
  };

  deleteSession = async (sessionId: string): Promise<void> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return;
    }
    await this.options.journalStore.deleteSession(normalizedSessionId);
    await this.publishSessionChange(normalizedSessionId);
  };

  getSessionRecord = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return null;
    }
    return await this.options.journalStore.getSession(normalizedSessionId);
  };

  listSessions = async (options?: ListSessionsOptions): Promise<NcpSessionSummary[]> => {
    const peerId = readOptionalString(options?.peerId);
    return applyLimit(
      (await this.options.journalStore.listSessionSummaries())
        .filter((summary) => !peerId || summary.peerId === peerId)
        .map(this.workingDirResolver.withWorkingDir),
      options?.limit,
    );
  };

  listSessionMessages = async (
    sessionId: string,
    options?: ListMessagesOptions,
  ): Promise<NcpMessage[]> => {
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return [];
    }
    const messages = await this.options.journalStore.listSessionMessages(normalizedSessionId);
    return applyLimit(messages, options?.limit);
  };

  getSession = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    const record = await this.getSessionRecord(sessionId);
    return record ? this.createSummaryFromRecord(record, true) : null;
  };

  getContextWindow = async (
    sessionId: string,
    liveRecord?: AgentSessionRecord | null,
  ): Promise<Record<string, unknown> | null> => {
    const summary = liveRecord
      ? this.createSummaryFromRecord(liveRecord, true)
      : await this.getSession(sessionId);
    return summary?.contextWindow ?? null;
  };

  getAgentRunSession = async (sessionId: string): Promise<AgentRunSession> => {
    const record = await this.getSessionRecord(sessionId);
    if (!record) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const agentRuntimeId = readOptionalMetadataString(record.metadata?.agentRuntimeId) ??
      DEFAULT_AGENT_RUNTIME_ENTRY_ID;
    const model = readOptionalMetadataString(record.metadata?.model);
    return {
      sessionId: record.sessionId,
      agentId: record.agentId,
      agentRuntimeId,
      metadata: structuredClone(record.metadata ?? {}),
      model,
      projectRoot: readProjectRoot(record.metadata),
      workingDir: this.workingDirResolver.resolve({
        agentId: record.agentId,
        metadata: record.metadata,
      }),
      thinkingEffort: readThinkingEffort(record.metadata),
    };
  };

  createAgentRunSession = async (
    params: CreateAgentRunSessionParams,
  ): Promise<AgentRunSession> => {
    const {
      agentId,
      agentRuntimeId: requestedAgentRuntimeId,
      channel,
      contextInheritance,
      metadata,
      model,
      parentSessionId: rawParentSessionId,
      peerId: rawPeerId,
      projectRoot,
      sessionId,
      sourceSessionId: rawSourceSessionId,
      sourceSessionMetadata: requestedSourceSessionMetadata,
      task,
      thinkingEffort,
    } = params;
    const peerId = readOptionalString(rawPeerId);
    const parentSessionId = readOptionalString(rawParentSessionId);
    const sourceSessionId = readOptionalString(rawSourceSessionId);
    const sourceRecord = sourceSessionId
      ? await this.getSessionRecord(sourceSessionId)
      : null;
    const sourceSessionMetadata =
      requestedSourceSessionMetadata ?? sourceRecord?.metadata ?? {};
    const agentRuntimeId =
      requestedAgentRuntimeId ??
      readAgentRuntimeId(sourceSessionMetadata) ??
      DEFAULT_AGENT_RUNTIME_ENTRY_ID;
    const peerIdentity = peerId
      ? createAgentPeerSessionIdentity({ agentId, channel, metadata, peerId })
      : undefined;
    const requestedSessionId = readOptionalString(sessionId);
    const created = await this.createSession({
      contextInheritance,
      parentSessionId: parentSessionId ?? undefined,
      sourceSessionId: sourceSessionId ?? undefined,
      sourceSessionMetadata,
      sessionId: requestedSessionId ?? peerIdentity?.sessionId,
      task: task ?? "Session",
      agentId,
      metadataOverrides: Object.assign(structuredClone(metadata ?? {}), peerIdentity?.metadata, {
        agentRuntimeId,
        channel,
      }),
      model,
      projectRoot,
      runtime: agentRuntimeId,
      sessionType: agentRuntimeId,
      thinkingLevel: thinkingEffort ?? undefined,
    });
    return {
      sessionId: created.sessionId,
      agentId: created.agentId,
      agentRuntimeId,
      metadata: structuredClone(created.metadata ?? {}),
      model: model ?? readOptionalMetadataString(created.metadata?.model) ?? readOptionalMetadataString(created.metadata?.preferred_model),
      projectRoot: readProjectRoot(created.metadata),
      workingDir: this.workingDirResolver.resolve({
        agentId: created.agentId,
        metadata: created.metadata,
      }),
      thinkingEffort: thinkingEffort ?? readThinkingEffort(created.metadata),
    };
  };

  getOrCreateAgentRunSession = async (
    params: CreateAgentRunSessionParams,
  ): Promise<AgentRunSession> => {
    if (!params.sessionId) {
      return await this.createAgentRunSession(params);
    }
    const existing = await this.getSessionRecord(params.sessionId);
    if (existing) {
      return await this.getAgentRunSession(params.sessionId);
    }
    return await this.createAgentRunSession(params);
  };

  patchSessionMetadata = async (
    sessionId: string,
    patch: Record<string, unknown>,
  ): Promise<void> => {
    const updated = await this.updateSessionMetadata(sessionId, patch);
    if (!updated) {
      throw new Error(`Session metadata was not updated: ${sessionId}`);
    }
  };

  clearSessionMessages = async (sessionId: string): Promise<number> => {
    const record = await this.getSessionRecord(sessionId);
    if (!record) {
      await this.createSession({
        sessionId,
        sourceSessionMetadata: {},
        task: "Session",
      });
      return 0;
    }
    const nextRecord: AgentSessionRecord = {
      ...record,
      messages: [],
      updatedAt: new Date().toISOString(),
      metadata: structuredClone(record.metadata ?? {}),
    };
    await this.options.journalStore.importSessionSnapshot(nextRecord);
    await this.publishSessionChange(record.sessionId);
    return record.messages.length;
  };

  publishSessionChange = async (sessionKey: string): Promise<void> => {
    const normalizedSessionKey = normalizeSessionId(sessionKey);
    if (!normalizedSessionKey) {
      return;
    }
    this.options.eventBus.emit(eventKeys.sessionUpdated, { sessionKey: normalizedSessionKey }, {
      emittedAt: new Date().toISOString(),
      source: "ncp-session",
    });
    await this.options.sessionSearch.handleSessionUpdated(normalizedSessionKey);
    const summary = await this.getSession(normalizedSessionKey);
    if (summary) {
      this.options.eventBus.emit(eventKeys.sessionSummaryUpsert, { summary });
      return;
    }
    this.options.eventBus.emit(eventKeys.sessionSummaryDelete, {
      sessionKey: normalizedSessionKey,
    });
  };

  private createSummaryFromRecord = (
    record: AgentSessionRecord,
    includeContextWindow = false,
  ): NcpSessionSummary => {
    const summary = this.workingDirResolver.withWorkingDir(createNcpAgentSessionSummary(record));
    const contextWindow = includeContextWindow
      ? this.contextWindowPreview.preview({
        requestMetadata: record.metadata ?? {},
        sessionId: record.sessionId,
        sessionMessages: record.messages,
        storedAgentId: record.agentId,
        storedMetadata: record.metadata ?? {},
      })
      : undefined;
    return contextWindow ? { ...summary, contextWindow } : summary;
  };

  private publishSessionMetadataChanged = (
    sessionKey: string,
    metadata: Record<string, unknown>,
    mode: "set" | "update",
  ): void => {
    this.options.eventBus.emit(
      eventKeys.sessionMetadataChanged,
      { sessionKey, mode, metadata: structuredClone(metadata) },
      { emittedAt: new Date().toISOString(), source: "ncp-session" },
    );
  };

  private applySessionProjectPatch = async (
    metadata: Record<string, unknown>,
    patch: SessionSettingsPatch,
  ): Promise<void> => {
    if (!Object.prototype.hasOwnProperty.call(patch, "projectRoot")) {
      return;
    }
    const projectRoot = await this.options.projectManager.normalizeSessionProjectRoot(
      patch.projectRoot,
    );
    delete metadata.projectRoot;
    if (projectRoot) {
      metadata.project_root = projectRoot;
    } else {
      delete metadata.project_root;
    }
  };
}
