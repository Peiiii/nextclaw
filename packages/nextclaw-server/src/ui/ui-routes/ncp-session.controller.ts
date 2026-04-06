import type { Context } from "hono";
import type {
  ChatSessionTypesView,
  SessionPatchUpdate,
  UiNcpSessionListView,
  UiNcpSessionMessagesView
} from "../types.js";
import { applySessionPreferencePatch } from "../session-preference-patch.js";
import {
  isSessionProjectRootValidationError,
  normalizeSessionProjectRoot,
} from "../session-project/session-project-root.js";
import { SessionSkillsViewBuilder } from "../session-project/session-skills.js";
import { err, ok, readJson } from "./response.js";
import type { UiRouterOptions } from "./types.js";

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
): void {
  if (!Object.prototype.hasOwnProperty.call(patch, "sessionType")) {
    return;
  }
  const sessionType = typeof patch.sessionType === "string" ? patch.sessionType.trim() : "";
  if (sessionType) {
    metadata.session_type = sessionType;
    delete metadata.sessionType;
    return;
  }
  delete metadata.session_type;
  delete metadata.sessionType;
}

async function applyProjectRootPatch(
  metadata: Record<string, unknown>,
  patch: SessionPatchUpdate,
): Promise<void> {
  if (!Object.prototype.hasOwnProperty.call(patch, "projectRoot")) {
    return;
  }
  const projectRoot = await normalizeSessionProjectRoot(patch.projectRoot);
  if (projectRoot) {
    metadata.project_root = projectRoot;
    delete metadata.projectRoot;
    return;
  }
  delete metadata.project_root;
  delete metadata.projectRoot;
}

async function buildPatchedSessionMetadata(params: {
  metadata: Record<string, unknown>;
  patch: SessionPatchUpdate;
}): Promise<Record<string, unknown>> {
  const nextMetadata = applySessionPreferencePatch({
    metadata: structuredClone(params.metadata),
    patch: params.patch,
    createInvalidThinkingError: () => new Error("PREFERRED_THINKING_INVALID")
  });
  applySessionTypePatch(nextMetadata, params.patch);
  await applyProjectRootPatch(nextMetadata, params.patch);
  return nextMetadata;
}

export class NcpSessionRoutesController {
  private readonly sessionSkillsViewBuilder: SessionSkillsViewBuilder;

  constructor(private readonly options: UiRouterOptions) {
    this.sessionSkillsViewBuilder = new SessionSkillsViewBuilder(options);
  }

  readonly getSessionTypes = async (c: Context) => {
    const listSessionTypes = this.options.ncpAgent?.listSessionTypes;
    const payload: ChatSessionTypesView = listSessionTypes
      ? await listSessionTypes({ describeMode: "observation" })
      : {
          defaultType: "native",
          options: [{ value: "native", label: "Native" }],
        };
    return c.json(ok(payload));
  };

  readonly listSessions = async (c: Context) => {
    const sessionApi = this.options.ncpSessionService;
    if (!sessionApi) {
      return c.json(err("NOT_AVAILABLE", "ncp session api unavailable"), 503);
    }

    const sessions = await sessionApi.listSessions({
      limit: readPositiveInt(c.req.query("limit")),
    });
    const payload: UiNcpSessionListView = {
      sessions,
      total: sessions.length,
    };
    return c.json(ok(payload));
  };

  readonly getSession = async (c: Context) => {
    const sessionApi = this.options.ncpSessionService;
    if (!sessionApi) {
      return c.json(err("NOT_AVAILABLE", "ncp session api unavailable"), 503);
    }

    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const session = await sessionApi.getSession(sessionId);
    if (!session) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }
    return c.json(ok(session));
  };

  readonly listSessionMessages = async (c: Context) => {
    const sessionApi = this.options.ncpSessionService;
    if (!sessionApi) {
      return c.json(err("NOT_AVAILABLE", "ncp session api unavailable"), 503);
    }

    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const session = await sessionApi.getSession(sessionId);
    if (!session) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    const messages = await sessionApi.listSessionMessages(sessionId, {
      limit: readPositiveInt(c.req.query("limit")),
    });
    const payload: UiNcpSessionMessagesView = {
      sessionId,
      status: session.status ?? "idle",
      messages,
      total: messages.length,
    };
    return c.json(ok(payload));
  };

  readonly getSessionSkills = async (c: Context) => {
    const sessionApi = this.options.ncpSessionService;
    if (!sessionApi) {
      return c.json(err("NOT_AVAILABLE", "ncp session api unavailable"), 503);
    }

    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const query = c.req.query();
    const hasProjectRootOverride = Object.prototype.hasOwnProperty.call(query, "projectRoot");
    const existing = await sessionApi.getSession(sessionId);
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
    const sessionApi = this.options.ncpSessionService;
    if (!sessionApi) {
      return c.json(err("NOT_AVAILABLE", "ncp session api unavailable"), 503);
    }

    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }

    const patch = body.data as SessionPatchUpdate;
    if (patch.clearHistory) {
      return c.json(err("UNSUPPORTED_PATCH", "clearHistory is not supported for ncp sessions"), 400);
    }

    const existing = await sessionApi.getSession(sessionId);
    const metadata = readSessionMetadata(existing?.metadata);

    let updated;
    try {
      const nextMetadata = await buildPatchedSessionMetadata({
        metadata,
        patch
      });
      updated = await sessionApi.updateSession(sessionId, {
        metadata: nextMetadata
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PREFERRED_THINKING_INVALID") {
        return c.json(err("PREFERRED_THINKING_INVALID", "preferredThinking must be a supported thinking level"), 400);
      }
      if (isSessionProjectRootValidationError(error)) {
        return c.json(err(error.code, error.message), 400);
      }
      throw error;
    }

    if (!updated) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    return c.json(ok(updated));
  };

  readonly deleteSession = async (c: Context) => {
    const sessionApi = this.options.ncpSessionService;
    if (!sessionApi) {
      return c.json(err("NOT_AVAILABLE", "ncp session api unavailable"), 503);
    }

    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const existing = await sessionApi.getSession(sessionId);
    if (!existing) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    await sessionApi.deleteSession(sessionId);
    return c.json(ok({ deleted: true, sessionId }));
  };
}
