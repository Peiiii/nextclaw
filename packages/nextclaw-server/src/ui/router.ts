import { Hono } from "hono";
import {
  buildConfigMeta,
  buildConfigView,
  loadConfigOrDefault,
  updateChannel,
  updateModel,
  updateProvider,
  updateUi
} from "./config.js";
import { probeFeishu } from "nextclaw-core";
import type { ProviderConfigUpdate, UiServerEvent } from "./types.js";

type UiRouterOptions = {
  configPath: string;
  publish: (event: UiServerEvent) => void;
  onReload?: () => Promise<void> | void;
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

  app.put("/api/config/model", async (c) => {
    const body = await readJson<{ model?: string }>(c.req.raw);
    if (!body.ok || !body.data.model) {
      return c.json(err("INVALID_BODY", "model is required"), 400);
    }
    const view = updateModel(options.configPath, body.data.model);
    options.publish({ type: "config.updated", payload: { path: "agents.defaults.model" } });
    return c.json(ok({ model: view.agents.defaults.model }));
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

  app.post("/api/channels/feishu/probe", async (c) => {
    const config = loadConfigOrDefault(options.configPath);
    const feishu = config.channels.feishu;
    if (!feishu?.appId || !feishu?.appSecret) {
      return c.json(err("MISSING_CREDENTIALS", "Feishu appId/appSecret not configured"), 400);
    }
    const result = await probeFeishu(String(feishu.appId), String(feishu.appSecret));
    if (!result.ok) {
      return c.json(err("PROBE_FAILED", result.error), 400);
    }
    return c.json(
      ok({
        appId: result.appId,
        botName: result.botName ?? null,
        botOpenId: result.botOpenId ?? null
      })
    );
  });

  app.put("/api/config/ui", async (c) => {
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateUi(options.configPath, body.data);
    options.publish({ type: "config.updated", payload: { path: "ui" } });
    return c.json(ok(result));
  });

  app.post("/api/config/reload", async (c) => {
    options.publish({ type: "config.reload.started" });
    try {
      await options.onReload?.();
    } catch (error) {
      options.publish({
        type: "error",
        payload: { message: "reload failed", code: "RELOAD_FAILED" }
      });
      return c.json(err("RELOAD_FAILED", "reload failed"), 500);
    }
    options.publish({ type: "config.reload.finished" });
    return c.json(ok({ status: "ok" }));
  });

  return app;
}
