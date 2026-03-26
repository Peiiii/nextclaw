import type { Context } from "hono";
import type {
  ChatSessionTypesView,
  SessionPatchUpdate,
  UiNcpSessionListView,
  UiNcpSessionMessagesView
} from "../types.js";
import { applySessionPreferencePatch } from "../session-preference-patch.js";
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

export class NcpSessionRoutesController {
  constructor(private readonly options: UiRouterOptions) {}

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
    const sessionApi = this.options.ncpAgent?.sessionApi;
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
    const sessionApi = this.options.ncpAgent?.sessionApi;
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
    const sessionApi = this.options.ncpAgent?.sessionApi;
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
      messages,
      total: messages.length,
    };
    return c.json(ok(payload));
  };

  readonly patchSession = async (c: Context) => {
    const sessionApi = this.options.ncpAgent?.sessionApi;
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
    if (!existing) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    const metadata =
      existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};

    let updated;
    try {
      const nextMetadata = applySessionPreferencePatch({
        metadata: structuredClone(metadata),
        patch,
        createInvalidThinkingError: () => new Error("PREFERRED_THINKING_INVALID")
      });
      if (Object.prototype.hasOwnProperty.call(patch, "sessionType")) {
        const sessionType = typeof patch.sessionType === "string" ? patch.sessionType.trim() : "";
        if (sessionType) {
          nextMetadata.session_type = sessionType;
        } else {
          delete nextMetadata.session_type;
        }
      }
      updated = await sessionApi.updateSession(sessionId, {
        metadata: nextMetadata
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PREFERRED_THINKING_INVALID") {
        return c.json(err("PREFERRED_THINKING_INVALID", "preferredThinking must be a supported thinking level"), 400);
      }
      throw error;
    }

    if (!updated) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    this.options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok(updated));
  };

  readonly deleteSession = async (c: Context) => {
    const sessionApi = this.options.ncpAgent?.sessionApi;
    if (!sessionApi) {
      return c.json(err("NOT_AVAILABLE", "ncp session api unavailable"), 503);
    }

    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const existing = await sessionApi.getSession(sessionId);
    if (!existing) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    await sessionApi.deleteSession(sessionId);
    this.options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok({ deleted: true, sessionId }));
  };
}
