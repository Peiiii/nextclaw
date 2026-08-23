import type { Context } from "hono";
import type {
  ChatSessionTypesView,
  SessionPatchUpdate,
  UiNcpSessionListView,
  UiNcpSessionQueuedInputsView,
  UiNcpSessionPendingInputsView,
  UiNcpSessionTokenUsageView,
} from "@nextclaw-server/shared/types/server-api.types.js";
import type { UiNcpSessionObservationsView } from "@nextclaw-server/features/sessions/types/session-observation-api.types.js";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import {
  isProjectError,
  isSessionContextCompactionError,
  isSessionMessageCursorError,
  isSessionSettingsError,
} from "@nextclaw/kernel";
import { SessionSkillsViewBuilder } from "@nextclaw-server/features/sessions/services/session-skills-view.service.js";
import {
  buildSessionMessageHistoryPayloadView,
  compactSessionMessageHistoryPayloadView,
} from "@nextclaw-server/features/sessions/utils/session-message-history-payload.utils.js";
import { err, ok, readJson } from "@nextclaw-server/shared/utils/http-response.utils.js";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";
import { buildSessionObservationsView } from "@nextclaw-server/features/sessions/utils/session-observation-view.utils.js";
import type { ObservationRef } from "@nextclaw/kernel";

const DEFAULT_SESSION_MESSAGE_PAGE_SIZE = 40;
const MAX_SESSION_MESSAGE_PAGE_SIZE = 200;

function sessionProjectError(error: { code: string; message: string }): {
  code: string;
  message: string;
} {
  switch (error.code) {
    case "PROJECT_PATH_INVALID_TYPE":
      return {
        code: "PROJECT_ROOT_INVALID_TYPE",
        message: "projectRoot must be a string or null"
      };
    case "PROJECT_PATH_NOT_FOUND":
      return {
        code: "PROJECT_ROOT_NOT_FOUND",
        message: "projectRoot directory does not exist"
      };
    case "PROJECT_PATH_NOT_DIRECTORY":
      return {
        code: "PROJECT_ROOT_NOT_DIRECTORY",
        message: "projectRoot must point to a directory"
      };
    default:
      return error;
  }
}

function readPositiveInt(value: string | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function readSessionMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSessionActivityPreview(session: NcpSessionSummary): NcpSessionSummary {
  const metadata = readSessionMetadata(session.metadata);
  const preview = metadata.last_activity_preview;
  if (!isRecord(preview)) {
    return session;
  }
  const isUserCancelled =
    preview.state === "failed" &&
    typeof preview.statusText === "string" &&
    preview.statusText.trim() === "Run interrupted: User stopped the current run.";
  const hasReplyText = typeof preview.replyText === "string" && preview.replyText.trim().length > 0;
  const state =
    preview.state === "running" ? (hasReplyText ? "completed" : "failed") : isUserCancelled ? "cancelled" : null;
  if (!state) {
    return session;
  }
  return {
    ...session,
    metadata: {
      ...metadata,
      last_activity_preview: {
        ...preview,
        state,
        statusKind: state === "failed" ? "run-interrupted" : undefined,
        statusText: undefined
      }
    }
  };
}

export class NcpSessionRoutesController {
  private readonly sessionSkillsViewBuilder: SessionSkillsViewBuilder;

  constructor(private readonly options: UiRouterOptions) {
    this.sessionSkillsViewBuilder = new SessionSkillsViewBuilder(options);
  }

  private readonly withRuntimeStatus = (session: NcpSessionSummary): NcpSessionSummary =>
    this.options.kernel.isSessionRunning(session.sessionId)
      ? { ...session, status: "running" }
      : normalizeSessionActivityPreview(session);

  readonly getSessionTypes = async (c: Context) => {
    const payload: ChatSessionTypesView = await this.options.kernel.listSessionTypes({
      describeMode: "observation"
    });
    return c.json(ok(payload));
  };

  readonly listSessions = async (c: Context) => {
    const sessionManager = this.options.kernel.sessionManager;
    const sessions = await sessionManager.listSessions({
      limit: readPositiveInt(c.req.query("limit")),
      peerId: c.req.query("peerId")
    });
    const payload: UiNcpSessionListView = {
      sessions: sessions.map(this.withRuntimeStatus),
      total: sessions.length
    };
    return c.json(ok(payload));
  };

  readonly getSession = async (c: Context) => {
    const sessionManager = this.options.kernel.sessionManager;
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }
    return c.json(ok(this.withRuntimeStatus(session)));
  };

  readonly listSessionMessages = async (c: Context) => {
    const sessionManager = this.options.kernel.sessionManager;
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const requestedLimit = readPositiveInt(c.req.query("limit"));
    let page;
    try {
      page = await sessionManager.listSessionMessagePage(sessionId, {
        limit: Math.min(requestedLimit ?? DEFAULT_SESSION_MESSAGE_PAGE_SIZE, MAX_SESSION_MESSAGE_PAGE_SIZE),
        ...(c.req.query("cursor") ? { cursor: c.req.query("cursor") } : {})
      });
    } catch (error) {
      if (isSessionMessageCursorError(error)) {
        return c.json(err("INVALID_CURSOR", error.message), 400);
      }
      throw error;
    }
    if (!page) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }
    const useSummaryPayload = c.req.query("toolPayload") === "summary";
    const historyPayload = useSummaryPayload
      ? buildSessionMessageHistoryPayloadView({
          messages: page.messages,
          messageDetailCursors: page.messageDetailCursors,
        })
      : { messages: page.messages, deferredToolPayloads: {} };
    const compactHistoryPayload = useSummaryPayload &&
      !c.req.query("cursor") &&
      c.req.query("initialPayload") === "compact"
      ? compactSessionMessageHistoryPayloadView({ view: historyPayload })
      : { ...historyPayload, startIndex: 0 };
    const compactStartCursor = compactHistoryPayload.startIndex > 0
      ? page.messageDetailCursors[page.messages[compactHistoryPayload.startIndex - 1]?.id ?? ""]
        ?? page.pageInfo.startCursor
      : page.pageInfo.startCursor;
    const payload = {
      sessionId,
      status: this.options.kernel.isSessionRunning(sessionId) ? ("running" as const) : ("idle" as const),
      messages: compactHistoryPayload.messages,
      ...(Object.keys(compactHistoryPayload.deferredToolPayloads).length > 0
        ? { deferredToolPayloads: compactHistoryPayload.deferredToolPayloads }
        : {}),
      ...(page.contextWindow ? { contextWindow: page.contextWindow } : {}),
      total: page.total,
      pageInfo: {
        startCursor: compactStartCursor,
        hasPreviousPage: page.pageInfo.hasPreviousPage || compactHistoryPayload.startIndex > 0,
      }
    };
    return c.json(ok(payload));
  };

  readonly getSessionTokenUsage = async (c: Context) => {
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const payload: UiNcpSessionTokenUsageView | null =
      await this.options.kernel.sessionManager.getSessionTokenUsage(sessionId);
    if (!payload) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }
    return c.json(ok(payload));
  };

  readonly listSessionObservations = async (c: Context) => {
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const existing = await this.options.kernel.sessionManager.getSession(sessionId);
    if (!existing) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }
    const state = await this.options.kernel.observations.listObservations(sessionId);
    const payload: UiNcpSessionObservationsView = buildSessionObservationsView({
      sessionId,
      ...state,
      descriptors: this.options.kernel.observations.discoverObservations(),
    });
    return c.json(ok(payload));
  };

  readonly updateSessionObservation = async (c: Context) => {
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const kind = c.req.param("kind");
    const id = decodeURIComponent(c.req.param("id"));
    const existingSession = await this.options.kernel.sessionManager.getSession(sessionId);
    if (!existingSession) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    const action = body.ok && body.data?.action;
    if (action !== "pause" && action !== "resume" && action !== "remove") {
      return c.json(err("INVALID_BODY", "action must be pause, resume, or remove"), 400);
    }
    if (kind !== "context" && kind !== "events") {
      return c.json(err("NOT_FOUND", `observation kind not found: ${kind}`), 404);
    }
    const ref: ObservationRef = kind === "context"
      ? { kind: "context_binding", id }
      : { kind: "event_subscription", id };
    const observation = await this.options.kernel.observations.getObservation(ref);
    if (!observation || observation.target.sessionId !== sessionId) {
      return c.json(err("NOT_FOUND", `observation not found in session: ${sessionId}`), 404);
    }
    await this.options.kernel.observations.updateObservation(action, ref);
    const state = await this.options.kernel.observations.listObservations(sessionId);
    return c.json(ok(buildSessionObservationsView({
      sessionId,
      ...state,
      descriptors: this.options.kernel.observations.discoverObservations(),
    })));
  };

  readonly getSessionSkills = async (c: Context) => {
    const sessionManager = this.options.kernel.sessionManager;
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const query = c.req.query();
    const hasProjectRootOverride = Object.prototype.hasOwnProperty.call(query, "projectRoot");
    const existing = await sessionManager.getSession(sessionId);
    const metadata = readSessionMetadata(existing?.metadata);

    if (hasProjectRootOverride) {
      try {
        const projectRoot = await this.options.kernel.projectManager.resolveExistingProjectRoot(query.projectRoot);
        if (projectRoot) {
          metadata.project_root = projectRoot;
        } else {
          delete metadata.project_root;
          delete metadata.projectRoot;
        }
      } catch (error) {
        if (isProjectError(error)) {
          const mapped = sessionProjectError(error);
          return c.json(err(mapped.code, mapped.message), 400);
        }
        throw error;
      }
    }

    return c.json(
      ok(
        this.sessionSkillsViewBuilder.build({
          sessionId,
          sessionMetadata: metadata
        })
      )
    );
  };

  readonly listSessionQueuedInputs = async (c: Context) => {
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const existing = await this.options.kernel.sessionManager.getSession(sessionId);
    if (!existing) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }
    const payload: UiNcpSessionQueuedInputsView = {
      sessionId,
      inputs: [...this.options.kernel.agentRunRequestManager.pendingInputs.listQueuedInputs(sessionId)],
    };
    return c.json(ok(payload));
  };

  readonly listSessionPendingInputs = async (c: Context) => {
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const existing = await this.options.kernel.sessionManager.getSession(sessionId);
    if (!existing) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }
    const payload: UiNcpSessionPendingInputsView = {
      sessionId,
      inputs: [...this.options.kernel.agentRunRequestManager.pendingInputs.listPendingInputs(sessionId)],
    };
    return c.json(ok(payload));
  };

  readonly steerSessionQueuedInput = async (c: Context) => {
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const queuedInputId = decodeURIComponent(c.req.param("queuedInputId"));
    const existing = await this.options.kernel.sessionManager.getSession(sessionId);
    if (!existing) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }
    const result = await this.options.kernel.agentRunRequestManager.pendingInputs.steerQueuedInput(
      sessionId,
      queuedInputId,
    );
    if (!result.ok) {
      if (result.reason === "not-found") {
        return c.json(err("NOT_FOUND", `queued input not found in session ${sessionId}: ${queuedInputId}`), 404);
      }
      return c.json(err(
        "STEER_UNAVAILABLE",
        "The active runtime cannot accept this input at the next safe step.",
      ), 409);
    }
    return c.json(ok(result.input));
  };

  readonly deleteSessionQueuedInput = async (c: Context) => {
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const queuedInputId = decodeURIComponent(c.req.param("queuedInputId"));
    const existing = await this.options.kernel.sessionManager.getSession(sessionId);
    if (!existing) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }
    const removed = this.options.kernel.agentRunRequestManager.pendingInputs.removeQueuedInput(
      sessionId,
      queuedInputId,
    );
    if (!removed) {
      return c.json(err(
        "NOT_FOUND",
        `queued input not found in session ${sessionId}: ${queuedInputId}`,
      ), 404);
    }
    return c.json(ok(removed));
  };

  readonly patchSession = async (c: Context) => {
    const sessionManager = this.options.kernel.sessionManager;
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }

    const patch = body.data as SessionPatchUpdate;
    if (patch.clearHistory) {
      return c.json(err("UNSUPPORTED_PATCH", "clearHistory is not supported for ncp sessions"), 400);
    }

    let updated;
    try {
      updated = await sessionManager.patchSessionSettings(sessionId, patch, {
        createIfMissing: true
      });
    } catch (error) {
      if (isSessionSettingsError(error)) {
        return c.json(err(error.code, error.message), 400);
      }
      if (isProjectError(error)) {
        const mapped = sessionProjectError(error);
        return c.json(err(mapped.code, mapped.message), 400);
      }
      throw error;
    }

    if (!updated) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    return c.json(ok(this.withRuntimeStatus(updated)));
  };

  readonly compactSessionContext = async (c: Context) => {
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    try {
      return c.json(ok(
        await this.options.kernel.sessionContextCompactionManager.compact(sessionId),
      ));
    } catch (error) {
      if (!isSessionContextCompactionError(error)) {
        throw error;
      }
      const status = error.code === "SESSION_NOT_FOUND" ? 404 : 409;
      return c.json(err(error.code, error.message), status);
    }
  };

  readonly deleteSession = async (c: Context) => {
    const sessionManager = this.options.kernel.sessionManager;
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const existing = await sessionManager.getSession(sessionId);
    if (!existing) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    this.options.kernel.sessionRunManager.deleteSessionRun(sessionId);
    await sessionManager.deleteSession(sessionId);
    return c.json(ok({ deleted: true, sessionId }));
  };
}
