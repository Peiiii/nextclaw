import type { Context } from "hono";
import {
  buildConfigSchemaView,
  buildConfigMeta,
  buildConfigView,
  loadConfigOrDefault,
  executeConfigAction,
  updateChannel,
  updateModel,
  updateSearch,
  createCustomProvider,
  deleteCustomProvider,
  updateProvider,
  testProviderConnection,
  updateSecrets,
  updateRuntime
} from "../config.js";
import { pollChannelAuth, startChannelAuth } from "../channel-auth.js";
import { importProviderAuthFromCli, pollProviderAuth, startProviderAuth } from "../provider-auth.js";
import type {
  ChannelAuthPollResult,
  ChannelAuthStartRequest,
  ChannelAuthStartResult,
  ConfigActionExecuteRequest,
  ProviderConnectionTestRequest,
  ProviderAuthStartRequest,
  ProviderAuthPollResult,
  ProviderAuthImportResult,
  ProviderAuthStartResult,
  ProviderCreateRequest,
  ProviderCreateResult,
  ProviderDeleteResult,
  ProviderConfigUpdate,
  SearchConfigUpdate,
  SecretsConfigUpdate,
  RuntimeConfigUpdate
} from "../types.js";
import { err, ok, readJson } from "./response.js";
import type { UiRouterOptions } from "./types.js";

export class ConfigRoutesController {
  constructor(private readonly options: UiRouterOptions) {}

  private getPluginConfigOptions() {
    return {
      pluginChannelBindings: this.options.getPluginChannelBindings?.() ?? [],
      pluginUiMetadata: this.options.getPluginUiMetadata?.() ?? []
    };
  }

  private async publishConfigUpdates(paths: string[]): Promise<void> {
    for (const path of paths) {
      this.options.publish({ type: "config.updated", payload: { path } });
    }
    await this.options.applyLiveConfigReload?.();
  }

  readonly getConfig = (c: Context) => {
    const config = loadConfigOrDefault(this.options.configPath);
    return c.json(ok(buildConfigView(config, this.getPluginConfigOptions())));
  };

  readonly getConfigMeta = (c: Context) => {
    const config = loadConfigOrDefault(this.options.configPath);
    return c.json(ok(buildConfigMeta(config, this.getPluginConfigOptions())));
  };

  readonly getConfigSchema = (c: Context) => {
    const config = loadConfigOrDefault(this.options.configPath);
    return c.json(ok(buildConfigSchemaView(config, this.getPluginConfigOptions())));
  };

  readonly updateConfigModel = async (c: Context) => {
    const body = await readJson<{ model?: string; workspace?: string }>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }

    const hasModel = typeof body.data.model === "string";
    if (!hasModel) {
      return c.json(err("INVALID_BODY", "model is required"), 400);
    }

    const view = updateModel(this.options.configPath, {
      model: body.data.model,
      workspace: body.data.workspace
    });

    const changedPaths: string[] = [];
    if (hasModel) {
      changedPaths.push("agents.defaults.model");
    }
    if (typeof body.data.workspace === "string") {
      changedPaths.push("agents.defaults.workspace");
    }
    await this.publishConfigUpdates(changedPaths);

    return c.json(ok({
      model: view.agents.defaults.model,
      workspace: view.agents.defaults.workspace
    }));
  };

  readonly updateConfigSearch = async (c: Context) => {
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateSearch(this.options.configPath, body.data as SearchConfigUpdate);
    await this.publishConfigUpdates(["search"]);
    return c.json(ok(result));
  };

  readonly updateProvider = async (c: Context) => {
    const provider = c.req.param("provider");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateProvider(this.options.configPath, provider, body.data as ProviderConfigUpdate);
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown provider: ${provider}`), 404);
    }
    await this.publishConfigUpdates([`providers.${provider}`]);
    return c.json(ok(result));
  };

  readonly createProvider = async (c: Context) => {
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = createCustomProvider(
      this.options.configPath,
      body.data as ProviderCreateRequest
    );
    await this.publishConfigUpdates([`providers.${result.name}`]);
    return c.json(ok({
      name: result.name,
      provider: result.provider
    } satisfies ProviderCreateResult));
  };

  readonly deleteProvider = async (c: Context) => {
    const provider = c.req.param("provider");
    const result = deleteCustomProvider(this.options.configPath, provider);
    if (result === null) {
      return c.json(err("NOT_FOUND", `custom provider not found: ${provider}`), 404);
    }
    await this.publishConfigUpdates([`providers.${provider}`]);
    return c.json(ok({
      deleted: true,
      provider
    } satisfies ProviderDeleteResult));
  };

  readonly testProviderConnection = async (c: Context) => {
    const provider = c.req.param("provider");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = await testProviderConnection(
      this.options.configPath,
      provider,
      body.data as ProviderConnectionTestRequest
    );
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown provider: ${provider}`), 404);
    }
    return c.json(ok(result));
  };

  readonly startProviderAuth = async (c: Context) => {
    const provider = c.req.param("provider");
    let payload: Record<string, unknown> = {};
    const rawBody = await c.req.raw.text();
    if (rawBody.trim().length > 0) {
      try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return c.json(err("INVALID_BODY", "invalid json body"), 400);
      }
    }
    const methodId = typeof payload.methodId === "string"
      ? payload.methodId.trim()
      : undefined;
    try {
      const result = await startProviderAuth(this.options.configPath, provider, {
        methodId
      } satisfies ProviderAuthStartRequest);
      if (!result) {
        return c.json(err("NOT_SUPPORTED", `provider auth is not supported: ${provider}`), 404);
      }
      return c.json(ok(result satisfies ProviderAuthStartResult));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json(err("AUTH_START_FAILED", message), 400);
    }
  };

  readonly pollProviderAuth = async (c: Context) => {
    const provider = c.req.param("provider");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const sessionId = typeof body.data.sessionId === "string" ? body.data.sessionId.trim() : "";
    if (!sessionId) {
      return c.json(err("INVALID_BODY", "sessionId is required"), 400);
    }

    const result = await pollProviderAuth({
      configPath: this.options.configPath,
      providerName: provider,
      sessionId
    });
    if (!result) {
      return c.json(err("NOT_FOUND", "provider auth session not found"), 404);
    }
    if (result.status === "authorized") {
      await this.publishConfigUpdates([`providers.${provider}`]);
    }
    return c.json(ok(result satisfies ProviderAuthPollResult));
  };

  readonly importProviderAuthFromCli = async (c: Context) => {
    const provider = c.req.param("provider");
    try {
      const result = await importProviderAuthFromCli(this.options.configPath, provider);
      if (!result) {
        return c.json(err("NOT_SUPPORTED", `provider cli auth import is not supported: ${provider}`), 404);
      }
      await this.publishConfigUpdates([`providers.${provider}`]);
      return c.json(ok(result satisfies ProviderAuthImportResult));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json(err("AUTH_IMPORT_FAILED", message), 400);
    }
  };

  readonly updateChannel = async (c: Context) => {
    const channel = c.req.param("channel");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateChannel(this.options.configPath, channel, body.data, this.getPluginConfigOptions());
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown channel: ${channel}`), 404);
    }
    await this.publishConfigUpdates([`channels.${channel}`]);
    return c.json(ok(result));
  };

  readonly startChannelAuth = async (c: Context) => {
    const channel = c.req.param("channel");
    let payload: Record<string, unknown> = {};
    const rawBody = await c.req.raw.text();
    if (rawBody.trim().length > 0) {
      try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        return c.json(err("INVALID_BODY", "invalid json body"), 400);
      }
    }

    try {
      const result = await startChannelAuth({
        configPath: this.options.configPath,
        channelId: channel,
        request: {
          accountId: typeof payload.accountId === "string" ? payload.accountId : undefined,
          baseUrl: typeof payload.baseUrl === "string" ? payload.baseUrl : undefined
        } satisfies ChannelAuthStartRequest,
        bindings: this.options.getPluginChannelBindings?.() ?? []
      });
      if (!result) {
        return c.json(err("NOT_SUPPORTED", `channel auth is not supported: ${channel}`), 404);
      }
      return c.json(ok(result satisfies ChannelAuthStartResult));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json(err("AUTH_START_FAILED", message), 400);
    }
  };

  readonly pollChannelAuth = async (c: Context) => {
    const channel = c.req.param("channel");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const sessionId = typeof body.data.sessionId === "string" ? body.data.sessionId.trim() : "";
    if (!sessionId) {
      return c.json(err("INVALID_BODY", "sessionId is required"), 400);
    }

    const result = await pollChannelAuth({
      configPath: this.options.configPath,
      channelId: channel,
      sessionId,
      bindings: this.options.getPluginChannelBindings?.() ?? []
    });
    if (!result) {
      return c.json(err("NOT_FOUND", "channel auth session not found"), 404);
    }
    if (result.status === "authorized") {
      await this.publishConfigUpdates([`channels.${channel}`]);
    }
    return c.json(ok(result satisfies ChannelAuthPollResult));
  };

  readonly updateSecrets = async (c: Context) => {
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateSecrets(this.options.configPath, body.data as SecretsConfigUpdate);
    await this.publishConfigUpdates(["secrets"]);
    return c.json(ok(result));
  };

  readonly updateRuntime = async (c: Context) => {
    const body = await readJson<RuntimeConfigUpdate>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateRuntime(this.options.configPath, body.data);
    const changedPaths: string[] = [];
    if (body.data.agents?.defaults && Object.prototype.hasOwnProperty.call(body.data.agents.defaults, "contextTokens")) {
      changedPaths.push("agents.defaults.contextTokens");
    }
    if (body.data.agents?.defaults && Object.prototype.hasOwnProperty.call(body.data.agents.defaults, "engine")) {
      changedPaths.push("agents.defaults.engine");
    }
    if (body.data.agents?.defaults && Object.prototype.hasOwnProperty.call(body.data.agents.defaults, "engineConfig")) {
      changedPaths.push("agents.defaults.engineConfig");
    }
    changedPaths.push("agents.list", "bindings", "session");
    await this.publishConfigUpdates(changedPaths);
    return c.json(ok(result));
  };

  readonly executeAction = async (c: Context) => {
    const actionId = c.req.param("actionId");
    const body = await readJson<ConfigActionExecuteRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = await executeConfigAction(this.options.configPath, actionId, body.data ?? {});
    if (!result.ok) {
      return c.json(err(result.code, result.message, result.details), 400);
    }
    return c.json(ok(result.data));
  };
}
