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
  NcpEndpointEvent,
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
} from "@kernel/types/session.types.js";
import type { ThinkingEffort } from "@kernel/types/agent-run.types.js";
import {
  createNcpAgentSessionSummary,
  type NcpAgentSessionJournalReplayEvent,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { createAgentPeerSessionIdentity } from "@kernel/utils/agent-peer-session.utils.js";
import {
  applyLimit,
  normalizeSessionId,
  readEventSessionId,
  readOptionalMetadataString,
  readOptionalString,
} from "@kernel/utils/session-manager.utils.js";
import {
  eventKeys,
  type EventBus,
} from "@nextclaw/shared";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import { SessionWorkingDirResolver } from "@kernel/services/session-working-dir-resolver.service.js";

type CreateNcpSessionInput = CreateSessionInput & {
  sessionId?: string;
};

const DEFAULT_SESSION_TYPE = "native";
const DEFAULT_LIFECYCLE = "persistent";
const SESSION_METADATA_LABEL_KEY = "label";
const CHILD_SESSION_PARENT_METADATA_KEY = "parent_session_id";
const CHILD_SESSION_REQUEST_METADATA_KEY = "spawned_by_request_id";
const CHILD_SESSION_LIFECYCLE_METADATA_KEY = "session_lifecycle";
const SESSION_METADATA_PATCH_RUN_METADATA_KIND = "session_metadata_patch";

export type SessionManagerOptions = {
  agentManager: AgentManager;
  configManager: ConfigManager;
  eventBus: EventBus;
  journalStore: NcpAgentSessionJournalStore;
  sessionSearch: SessionSearchService;
};

function isDurableSessionEvent(event: NcpEndpointEvent): boolean {
  return event.type !== NcpEventType.ContextWindowUpdated;
}

function readThinkingEffort(metadata: Record<string, unknown> | undefined): ThinkingEffort | null {
  return readOptionalMetadataString(metadata?.thinkingEffort) ?? null;
}

function readProjectRoot(metadata: Record<string, unknown> | undefined): string | undefined {
  return readOptionalMetadataString(metadata?.project_root) ?? readOptionalMetadataString(metadata?.projectRoot);
}

function summarizeTask(task: string): string {
  const normalized = task.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Session";
  }
  return normalized.length <= 72 ? normalized : `${normalized.slice(0, 69)}...`;
}

function buildSessionId(): string {
  return `ncp-${Date.now().toString(36)}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function cloneInheritedMetadata(sourceMetadata: Record<string, unknown>): Record<string, unknown> {
  const nextMetadata: Record<string, unknown> = {};
  const inheritedKeys = [
    "runtime",
    "session_type",
    "preferred_model",
    "preferred_thinking",
    "project_root",
    "requested_skill_refs",
    "codex_runtime_backend",
    "reasoningNormalizationMode",
    "reasoning_normalization_mode",
  ];
  for (const key of inheritedKeys) {
    if (Object.prototype.hasOwnProperty.call(sourceMetadata, key)) {
      nextMetadata[key] = structuredClone(sourceMetadata[key]);
    }
  }
  return nextMetadata;
}

function mergeMetadataOverrides(
  metadata: Record<string, unknown>,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return overrides && Object.keys(overrides).length > 0
    ? { ...metadata, ...structuredClone(overrides) }
    : metadata;
}

function resolveSessionType(params: {
  runtime?: string;
  sessionType?: string;
  metadata: Record<string, unknown>;
}): string {
  const { metadata, runtime, sessionType } = params;
  return (
    readOptionalString(runtime) ??
    readOptionalString(metadata.runtime) ??
    readOptionalString(sessionType) ??
    readOptionalString(metadata.session_type) ??
    DEFAULT_SESSION_TYPE
  );
}

function applySessionOverrides(params: {
  lifecycle: string;
  metadata: Record<string, unknown>;
  model?: string;
  parentSessionId?: string;
  projectRoot?: string | null;
  requestId?: string;
  sessionType: string;
  thinkingLevel?: string;
  title?: string;
}): void {
  const {
    lifecycle,
    metadata,
    model,
    parentSessionId,
    projectRoot,
    requestId,
    sessionType,
    thinkingLevel,
    title,
  } = params;
  metadata.session_type = sessionType;
  metadata.runtime = sessionType;
  metadata[SESSION_METADATA_LABEL_KEY] = title;
  metadata[CHILD_SESSION_LIFECYCLE_METADATA_KEY] = lifecycle;
  if (parentSessionId) {
    metadata[CHILD_SESSION_PARENT_METADATA_KEY] = parentSessionId;
  }
  if (requestId) {
    metadata[CHILD_SESSION_REQUEST_METADATA_KEY] = requestId;
  }
  if (readOptionalString(model)) {
    metadata.model = model?.trim();
    metadata.preferred_model = model?.trim();
  }
  if (readOptionalString(thinkingLevel)) {
    metadata.thinking = thinkingLevel?.trim();
    metadata.preferred_thinking = thinkingLevel?.trim();
  }
  if (readOptionalString(projectRoot)) {
    metadata.project_root = projectRoot?.trim();
  }
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

function readRuntimeSessionMetadataPatch(
  event: NcpEndpointEvent,
): Record<string, unknown> | null {
  if (event.type !== NcpEventType.RunMetadata) {
    return null;
  }
  const metadata = event.payload.metadata;
  if (
    metadata.kind !== SESSION_METADATA_PATCH_RUN_METADATA_KIND ||
    !metadata.sessionMetadataPatch ||
    typeof metadata.sessionMetadataPatch !== "object" ||
    Array.isArray(metadata.sessionMetadataPatch)
  ) {
    return null;
  }
  const patch = metadata.sessionMetadataPatch as Record<string, unknown>;
  return Object.keys(patch).length > 0 ? structuredClone(patch) : null;
}

export class SessionManager implements NcpSessionApi {
  readonly cleanups: Array<() => void> = [];
  private readonly contextWindowPreview: ContextWindowPreviewManager;
  private readonly workingDirResolver: SessionWorkingDirResolver;
  private started = false;

  constructor(private readonly options: SessionManagerOptions) {
    this.contextWindowPreview = new ContextWindowPreviewManager(options.agentManager);
    this.workingDirResolver = new SessionWorkingDirResolver(options.agentManager);
  }

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(this.options.eventBus.on(eventKeys.ncpEvent, async (event) => {
      const sessionId = readEventSessionId(event);
      if (!sessionId || !isDurableSessionEvent(event)) {
        return;
      }
      const metadataPatch = readRuntimeSessionMetadataPatch(event);
      if (metadataPatch) {
        await this.updateSessionMetadata(sessionId, metadataPatch);
        return;
      }
      await this.appendSessionEvent({
        event,
        sessionId,
      });
    }));
  };

  dispose = (): void => {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
    this.started = false;
  };

  createSession = async (params: CreateNcpSessionInput): Promise<CreatedSession> => {
    const {
      agentId: requestedAgentId,
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
      lifecycle: DEFAULT_LIFECYCLE,
      metadata,
      model,
      parentSessionId: parentSessionId ?? undefined,
      projectRoot,
      requestId: requestId ?? undefined,
      sessionType,
      thinkingLevel,
      title,
    });
    const now = new Date().toISOString();
    const nextMetadata = mergeMetadataOverrides(metadata, metadataOverrides);
    const agentId =
      readOptionalString(requestedAgentId) ??
      readOptionalString(sourceRecord?.agentId) ??
      BUILTIN_MAIN_AGENT_ID;
    const sessionId = readOptionalString(requestedSessionId) ?? buildSessionId();
    const record: AgentSessionRecord = {
      sessionId,
      ...(agentId ? { agentId } : {}),
      messages: [],
      createdAt: now,
      updatedAt: now,
      metadata: nextMetadata,
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
      lifecycle: DEFAULT_LIFECYCLE,
      title,
      metadata: nextMetadata,
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
      metadata,
      model,
      peerId: rawPeerId,
      projectRoot,
      sessionId,
      task,
      thinkingEffort,
    } = params;
    const agentRuntimeId = requestedAgentRuntimeId ?? DEFAULT_AGENT_RUNTIME_ENTRY_ID;
    const peerId = readOptionalString(rawPeerId);
    const peerIdentity = peerId
      ? createAgentPeerSessionIdentity({ agentId, channel, metadata, peerId })
      : undefined;
    const requestedSessionId = readOptionalString(sessionId);
    const created = await this.createSession({
      sourceSessionMetadata: {},
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
      agentId,
      agentRuntimeId,
      metadata: structuredClone(created.metadata ?? {}),
      model,
      projectRoot,
      thinkingEffort: thinkingEffort ?? null,
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
}
