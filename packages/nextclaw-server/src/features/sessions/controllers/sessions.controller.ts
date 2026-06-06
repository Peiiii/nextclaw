import type { Context } from "hono";
import type {
  ChatSessionTypesView,
  SessionPatchUpdate,
  UiNcpSessionListView
} from "@nextclaw-server/shared/types/server-api.types.js";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import { applySessionPreferencePatch } from "@nextclaw-server/features/sessions/utils/session-preference-patch.utils.js";
import {
  isSessionProjectRootValidationError,
  normalizeSessionProjectRoot,
} from "@nextclaw-server/features/sessions/utils/session-project-root.utils.js";
import { SessionSkillsViewBuilder } from "@nextclaw-server/features/sessions/services/session-skills-view.service.js";
import { err, ok, readJson } from "@nextclaw-server/shared/utils/http-response.utils.js";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";

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

function readSessionMetadata(
  metadata: unknown,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function applySessionTypePatch(
  metadata: Record<string, unknown>,
  patch: SessionPatchUpdate,
): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(patch, "sessionType")) {
    return metadata;
  }
  const sessionType = typeof patch.sessionType === "string" ? patch.sessionType.trim() : "";
  if (sessionType) {
    const { sessionType: _removed, ...nextMetadata } = metadata;
    void _removed;
    return {
      ...nextMetadata,
      session_type: sessionType,
      runtime: sessionType,
    };
  }
  const {
    runtime: _runtime,
    session_type: _sessionType,
    sessionType: _camelSessionType,
    ...nextMetadata
  } = metadata;
  void _runtime;
  void _sessionType;
  void _camelSessionType;
  return nextMetadata;
}

function applyUiReadAtPatch(
  metadata: Record<string, unknown>,
  patch: SessionPatchUpdate,
): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(patch, "uiReadAt")) {
    return metadata;
  }
  const uiReadAt = typeof patch.uiReadAt === "string" ? patch.uiReadAt.trim() : "";
  if (uiReadAt) {
    return {
      ...metadata,
      ui_last_read_at: uiReadAt,
    };
  }
  const { ui_last_read_at: _removed, ...nextMetadata } = metadata;
  void _removed;
  return nextMetadata;
}

function applyProjectRootPatch(
  metadata: Record<string, unknown>,
  projectRoot: string | null | undefined,
): Record<string, unknown> {
  if (projectRoot === undefined) {
    return metadata;
  }
  if (projectRoot) {
    const { projectRoot: _removed, ...nextMetadata } = metadata;
    void _removed;
    return {
      ...nextMetadata,
      project_root: projectRoot,
    };
  }
  const { project_root: _projectRoot, projectRoot: _camelProjectRoot, ...nextMetadata } = metadata;
  void _projectRoot;
  void _camelProjectRoot;
  return nextMetadata;
}

function buildPatchedSessionMetadata(
  metadata: Record<string, unknown>,
  patch: SessionPatchUpdate,
  projectRootPatch: string | null | undefined,
): Record<string, unknown> {
  const nextMetadata = applySessionPreferencePatch({
    metadata: structuredClone(metadata),
    patch,
    createInvalidThinkingError: () => new Error("PREFERRED_THINKING_INVALID")
  });
  const nextMetadataWithSessionType = applySessionTypePatch(nextMetadata, patch);
  const nextMetadataWithReadAt = applyUiReadAtPatch(nextMetadataWithSessionType, patch);
  return applyProjectRootPatch(nextMetadataWithReadAt, projectRootPatch);
}

export class NcpSessionRoutesController {
  private readonly sessionSkillsViewBuilder: SessionSkillsViewBuilder;

  constructor(private readonly options: UiRouterOptions) {
    this.sessionSkillsViewBuilder = new SessionSkillsViewBuilder(options);
  }

  private readonly withRuntimeStatus = (session: NcpSessionSummary): NcpSessionSummary =>
    this.options.kernel.isSessionRunning(session.sessionId)
      ? { ...session, status: "running" }
      : session;

  readonly getSessionTypes = async (c: Context) => {
    const payload: ChatSessionTypesView = await this.options.kernel.listSessionTypes({
      describeMode: "observation",
    });
    return c.json(ok(payload));
  };

  readonly listSessions = async (c: Context) => {
    const sessionManager = this.options.kernel.sessionManager;
    const sessions = await sessionManager.listSessions({
      limit: readPositiveInt(c.req.query("limit")),
      peerId: c.req.query("peerId"),
    });
    const payload: UiNcpSessionListView = {
      sessions: sessions.map(this.withRuntimeStatus),
      total: sessions.length,
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
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    const messages = await sessionManager.listSessionMessages(sessionId, {
      limit: readPositiveInt(c.req.query("limit")),
    });
    const sessionWithRuntimeStatus = this.withRuntimeStatus(session);
    const payload = {
      sessionId,
      status: sessionWithRuntimeStatus.status ?? "idle",
      messages,
      ...(sessionWithRuntimeStatus.contextWindow ? { contextWindow: sessionWithRuntimeStatus.contextWindow } : {}),
      total: messages.length,
    };
    return c.json(ok(payload));
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
        const projectRoot = await normalizeSessionProjectRoot(query.projectRoot);
        if (projectRoot) {
          metadata.project_root = projectRoot;
        } else {
          delete metadata.project_root;
          delete metadata.projectRoot;
        }
      } catch (error) {
        if (isSessionProjectRootValidationError(error)) {
          return c.json(err(error.code, error.message), 400);
        }
        throw error;
      }
    }

    return c.json(ok(this.sessionSkillsViewBuilder.build({
      sessionId,
      sessionMetadata: metadata,
    })));
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

    let patched;
    try {
      const projectRootPatch = Object.prototype.hasOwnProperty.call(patch, "projectRoot")
        ? await normalizeSessionProjectRoot(patch.projectRoot)
        : undefined;
      const existing = await sessionManager.getSessionRecord(sessionId);
      const metadata = buildPatchedSessionMetadata(
        readSessionMetadata(existing?.metadata),
        patch,
        projectRootPatch,
      );
      patched = existing
        ? await sessionManager.setSessionMetadata(sessionId, metadata)
        : Boolean(await sessionManager.updateSession(sessionId, { metadata }));
    } catch (error) {
      if (error instanceof Error && error.message === "PREFERRED_THINKING_INVALID") {
        return c.json(err("PREFERRED_THINKING_INVALID", "preferredThinking must be a supported thinking level"), 400);
      }
      if (isSessionProjectRootValidationError(error)) {
        return c.json(err(error.code, error.message), 400);
      }
      throw error;
    }

    if (!patched) return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);

    const updated = await sessionManager.getSession(sessionId);
    if (!updated) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    return c.json(ok(this.withRuntimeStatus(updated)));
  };

  readonly deleteSession = async (c: Context) => {
    const sessionManager = this.options.kernel.sessionManager;
    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const existing = await sessionManager.getSession(sessionId);
    if (!existing) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    await sessionManager.deleteSession(sessionId);
    return c.json(ok({ deleted: true, sessionId }));
  };
}
