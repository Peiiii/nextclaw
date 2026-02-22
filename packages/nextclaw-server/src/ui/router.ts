import { Hono } from "hono";
import {
  buildConfigSchemaView,
  buildConfigMeta,
  buildConfigView,
  executeConfigAction,
  loadConfigOrDefault,
  updateChannel,
  updateModel,
  updateProvider,
  updateRuntime,
  listSessions,
  getSessionHistory,
  patchSession,
  deleteSession
} from "./config.js";
import type {
  ConfigActionExecuteRequest,
  ProviderConfigUpdate,
  RuntimeConfigUpdate,
  SessionPatchUpdate,
  UiServerEvent
} from "./types.js";

type UiRouterOptions = {
  configPath: string;
  publish: (event: UiServerEvent) => void;
};

function ok<T>(data: T) {
  return { ok: true, data };
}

function err(code: string, message: string, details?: Record<string, unknown>) {
  return { ok: false, error: { code, message, details } };
}

async function readJson<T>(req: Request): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export function createUiRouter(options: UiRouterOptions): Hono {
  const app = new Hono();

  app.notFound((c) => c.json(err("NOT_FOUND", "endpoint not found"), 404));

  app.get("/api/health", (c) => c.json(ok({ status: "ok" })));

  app.get("/api/config", (c) => {
    const config = loadConfigOrDefault(options.configPath);
    return c.json(ok(buildConfigView(config)));
  });

  app.get("/api/config/meta", (c) => {
    const config = loadConfigOrDefault(options.configPath);
    return c.json(ok(buildConfigMeta(config)));
  });

  app.get("/api/config/schema", (c) => {
    const config = loadConfigOrDefault(options.configPath);
    return c.json(ok(buildConfigSchemaView(config)));
  });

  app.put("/api/config/model", async (c) => {
    const body = await readJson<{ model?: string; maxTokens?: number }>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }

    const hasModel = typeof body.data.model === "string";
    const hasMaxTokens = typeof body.data.maxTokens === "number";
    if (!hasModel && !hasMaxTokens) {
      return c.json(err("INVALID_BODY", "model or maxTokens is required"), 400);
    }

    const view = updateModel(options.configPath, {
      model: hasModel ? body.data.model : undefined,
      maxTokens: hasMaxTokens ? body.data.maxTokens : undefined
    });

    if (hasModel) {
      options.publish({ type: "config.updated", payload: { path: "agents.defaults.model" } });
    }
    if (hasMaxTokens) {
      options.publish({ type: "config.updated", payload: { path: "agents.defaults.maxTokens" } });
    }

    return c.json(ok({
      model: view.agents.defaults.model,
      maxTokens: view.agents.defaults.maxTokens
    }));
  });

  app.put("/api/config/providers/:provider", async (c) => {
    const provider = c.req.param("provider");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateProvider(options.configPath, provider, body.data as ProviderConfigUpdate);
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown provider: ${provider}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: `providers.${provider}` } });
    return c.json(ok(result));
  });

  app.put("/api/config/channels/:channel", async (c) => {
    const channel = c.req.param("channel");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateChannel(options.configPath, channel, body.data);
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown channel: ${channel}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: `channels.${channel}` } });
    return c.json(ok(result));
  });

  app.get("/api/sessions", (c) => {
    const query = c.req.query();
    const q = typeof query.q === "string" ? query.q : undefined;
    const limit = typeof query.limit === "string" ? Number.parseInt(query.limit, 10) : undefined;
    const activeMinutes =
      typeof query.activeMinutes === "string" ? Number.parseInt(query.activeMinutes, 10) : undefined;
    const data = listSessions(options.configPath, {
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
      activeMinutes: Number.isFinite(activeMinutes) ? activeMinutes : undefined
    });
    return c.json(ok(data));
  });

  app.get("/api/sessions/:key/history", (c) => {
    const key = decodeURIComponent(c.req.param("key"));
    const query = c.req.query();
    const limit = typeof query.limit === "string" ? Number.parseInt(query.limit, 10) : undefined;
    const data = getSessionHistory(options.configPath, key, Number.isFinite(limit) ? limit : undefined);
    if (!data) {
      return c.json(err("NOT_FOUND", `session not found: ${key}`), 404);
    }
    return c.json(ok(data));
  });

  app.put("/api/sessions/:key", async (c) => {
    const key = decodeURIComponent(c.req.param("key"));
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const data = patchSession(options.configPath, key, body.data as SessionPatchUpdate);
    if (!data) {
      return c.json(err("NOT_FOUND", `session not found: ${key}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok(data));
  });

  app.delete("/api/sessions/:key", (c) => {
    const key = decodeURIComponent(c.req.param("key"));
    const deleted = deleteSession(options.configPath, key);
    if (!deleted) {
      return c.json(err("NOT_FOUND", `session not found: ${key}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok({ deleted: true }));
  });

  app.put("/api/config/runtime", async (c) => {
    const body = await readJson<RuntimeConfigUpdate>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateRuntime(options.configPath, body.data);
    if (body.data.agents?.defaults && Object.prototype.hasOwnProperty.call(body.data.agents.defaults, "contextTokens")) {
      options.publish({ type: "config.updated", payload: { path: "agents.defaults.contextTokens" } });
    }
    options.publish({ type: "config.updated", payload: { path: "agents.list" } });
    options.publish({ type: "config.updated", payload: { path: "bindings" } });
    options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok(result));
  });

  app.post("/api/config/actions/:actionId/execute", async (c) => {
    const actionId = c.req.param("actionId");
    const body = await readJson<ConfigActionExecuteRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = await executeConfigAction(options.configPath, actionId, body.data ?? {});
    if (!result.ok) {
      return c.json(err(result.code, result.message, result.details), 400);
    }
    return c.json(ok(result.data));
  });

  return app;
}
