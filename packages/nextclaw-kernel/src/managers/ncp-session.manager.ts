import { randomUUID } from "node:crypto";
import type {
  CreatedSession,
  CreateSessionInput,
  SessionSearchManager,
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
import { ContextWindowPreviewManager } from "@kernel/features/context-compaction/index.js";
import type { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import {
  createNcpAgentSessionSummary,
  type NcpAgentSessionJournalReplayEvent,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { eventKeys, type EventBus } from "@nextclaw/shared";
import type { ConfigManager } from "@kernel/managers/config.manager.js";

const DEFAULT_SESSION_TYPE = "native";
const DEFAULT_LIFECYCLE = "persistent";
const SESSION_METADATA_LABEL_KEY = "label";
const CHILD_SESSION_PARENT_METADATA_KEY = "parent_session_id";
const CHILD_SESSION_REQUEST_METADATA_KEY = "spawned_by_request_id";
const CHILD_SESSION_LIFECYCLE_METADATA_KEY = "session_lifecycle";

export type NcpSessionManagerOptions = {
  configManager: ConfigManager;
  eventBus: EventBus;
  journalStore: NcpAgentSessionJournalStore;
  sessionSearch: SessionSearchManager;
};

function normalizeSessionId(sessionId: string): string {
  return sessionId.trim();
}

function applyLimit<T>(items: T[], limit?: number): T[] {
  if (!Number.isFinite(limit) || typeof limit !== "number" || limit <= 0) {
    return items;
  }
  return items.slice(0, Math.trunc(limit));
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export class NcpSessionManager implements NcpSessionApi {
  private readonly contextWindowPreview: ContextWindowPreviewManager;
  private readonly runningSessionIds = new Set<string>();
  private readonly unsubscribeSessionRunStatus: () => void;

  constructor(private readonly options: NcpSessionManagerOptions) {
    this.contextWindowPreview = new ContextWindowPreviewManager({
      configManager: options.configManager,
    });
    this.unsubscribeSessionRunStatus = options.eventBus.on(
      eventKeys.sessionRunStatus,
      this.handleSessionRunStatus,
    );
  }

  dispose = (): void => {
    this.unsubscribeSessionRunStatus();
    this.runningSessionIds.clear();
  };

  createSession = async (params: CreateSessionInput): Promise<CreatedSession> => {
    const {
      agentId: requestedAgentId,
      metadataOverrides,
      model,
      parentSessionId: rawParentSessionId,
      projectRoot,
      requestId: rawRequestId,
      runtime,
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
    const sessionId = buildSessionId();
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
    const summaries = await this.options.journalStore.listSessionSummaries();
    return applyLimit(summaries, options?.limit).map(this.withLiveSessionStatus);
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
    return record ? this.withLiveSessionStatus(this.createSummaryFromRecord(record, true)) : null;
  };

  getContextWindow = async (
    sessionId: string,
    liveRecord?: AgentSessionRecord | null,
  ): Promise<Record<string, unknown> | null> => {
    const summary = liveRecord
      ? this.withLiveSessionStatus(this.createSummaryFromRecord(liveRecord, true))
      : await this.getSession(sessionId);
    return summary?.contextWindow ?? null;
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
    const summary = createNcpAgentSessionSummary(record);
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

  private withLiveSessionStatus = (summary: NcpSessionSummary): NcpSessionSummary =>
    this.runningSessionIds.has(summary.sessionId)
      ? { ...summary, status: "running" }
      : summary;

  private handleSessionRunStatus = (payload: {
    sessionKey: string;
    status: "running" | "idle";
  }): void => {
    const sessionId = normalizeSessionId(payload.sessionKey);
    if (!sessionId) {
      return;
    }
    if (payload.status === "running") this.runningSessionIds.add(sessionId);
    else this.runningSessionIds.delete(sessionId);
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
