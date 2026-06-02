import type { Context } from "hono";
import {
  buildConfigSchemaView,
  buildConfigMeta,
  buildConfigView,
  buildProvidersView,
  buildProviderTemplatesView,
  loadConfigOrDefault,
  executeConfigAction,
  updateChannel,
  updateModel,
  updateSearch,
  createProvider,
  deleteProvider,
  updateProvider,
  testProviderConnection,
  updateSecrets,
  updateRuntime
} from "@nextclaw-server/features/config/index.js";
import { connectChannelAuth, pollChannelAuth, startChannelAuth } from "@nextclaw-server/features/config/utils/channel-auth.utils.js";
import { importProviderAuthFromCli, pollProviderAuth, startProviderAuth } from "@nextclaw-server/features/config/utils/provider-auth.utils.js";
import type {
  ChannelAuthPollResult,
  ChannelAuthConnectRequest,
  ChannelAuthConnectResult,
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
} from "@nextclaw-server/shared/types/server-api.types.js";
import { err, ok, readJson } from "@nextclaw-server/shared/utils/http-response.utils.js";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";
import { emitChannelConfigApplyStatus, emitConfigUpdated, emitUiError } from "@nextclaw-server/shared/utils/app-events.utils.js";

export class ConfigRoutesController {
  private readonly channelConfigApplyTasks = new Map<string, Promise<void>>();

  constructor(private readonly options: UiRouterOptions) {}

  private readonly getExtensionConfigProjectionOptions = () => {
    return {
      extensionChannelBindings: this.options.extensions?.getChannelBindings() ?? [],
      extensionUiMetadata: this.options.extensions?.getUiMetadata() ?? []
    };
  };

  private readonly publishConfigUpdatedPaths = (paths: string[]): void => {
    for (const path of paths) {
      emitConfigUpdated(this.options, path);
    }
  };

  private readonly publishConfigUpdates = async (paths: string[]): Promise<void> => {
    this.publishConfigUpdatedPaths(paths);
    await this.options.applyLiveConfigReload?.();
  };

  private readonly publishChannelConfigApplyStatus = (params: {
    channel: string;
    status: "started" | "succeeded" | "failed";
    message?: string;
  }): void => {
    emitChannelConfigApplyStatus(this.options, params);
  };

  private readonly enqueueChannelConfigApply = (channel: string): void => {
    const previousTask = this.channelConfigApplyTasks.get(channel) ?? Promise.resolve();
    const task = previousTask
      .catch(() => undefined)
      .then(async () => {
        this.publishChannelConfigApplyStatus({
          channel,
          status: "started"
        });
        try {
          await this.options.applyLiveConfigReload?.();
          this.publishChannelConfigApplyStatus({
            channel,
            status: "succeeded"
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.publishChannelConfigApplyStatus({
            channel,
            status: "failed",
            message
          });
          emitUiError(this.options, {
            code: "CHANNEL_CONFIG_APPLY_FAILED",
            message: `Failed to apply ${channel} channel config: ${message}`
          });
        }
      })
      .finally(() => {
        if (this.channelConfigApplyTasks.get(channel) === task) {
          this.channelConfigApplyTasks.delete(channel);
        }
      });

    this.channelConfigApplyTasks.set(channel, task);
    void task;
  };

  readonly getConfig = (c: Context) => {
    const config = loadConfigOrDefault(this.options.configPath);
    return c.json(ok(buildConfigView(config, this.getExtensionConfigProjectionOptions())));
  };

  readonly getConfigMeta = (c: Context) => {
    const config = loadConfigOrDefault(this.options.configPath);
    return c.json(ok(buildConfigMeta(config, this.getExtensionConfigProjectionOptions())));
  };

  readonly listProviders = (c: Context) => {
    const config = loadConfigOrDefault(this.options.configPath);
    return c.json(ok(buildProvidersView(config)));
  };

  readonly listProviderTemplates = (c: Context) => {
    return c.json(ok(buildProviderTemplatesView()));
  };

  readonly getConfigSchema = (c: Context) => {
    const config = loadConfigOrDefault(this.options.configPath);
    return c.json(ok(buildConfigSchemaView(config, this.getExtensionConfigProjectionOptions())));
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
    const providerId = c.req.param("providerId");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateProvider(this.options.configPath, providerId, body.data as ProviderConfigUpdate);
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown provider: ${providerId}`), 404);
    }
    await this.publishConfigUpdates([`providers.${providerId}`]);
    return c.json(ok(result));
  };

  readonly createProvider = async (c: Context) => {
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = createProvider(
      this.options.configPath,
      body.data as ProviderCreateRequest
    );
    if (!result) {
      return c.json(err("PROVIDER_EXISTS", "provider already exists"), 409);
    }
    await this.publishConfigUpdates([`providers.${result.providerId}`]);
    return c.json(ok({
      providerId: result.providerId,
      provider: result.provider
    } satisfies ProviderCreateResult));
  };

  readonly deleteProvider = async (c: Context) => {
    const providerId = c.req.param("providerId");
    const result = deleteProvider(this.options.configPath, providerId);
    if (result === null) {
      return c.json(err("NOT_FOUND", `provider not found: ${providerId}`), 404);
    }
    await this.publishConfigUpdates([`providers.${providerId}`]);
    return c.json(ok({
      deleted: true,
      providerId
    } satisfies ProviderDeleteResult));
  };

  readonly testProviderConnection = async (c: Context) => {
    const provider = c.req.param("providerId");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = await testProviderConnection(
      this.options.configPath,
      provider,
      body.data as ProviderConnectionTestRequest,
      this.options.kernel.llmProviders
    );
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown provider: ${provider}`), 404);
    }
    return c.json(ok(result));
  };

  readonly startProviderAuth = async (c: Context) => {
    const provider = c.req.param("providerId");
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
    const provider = c.req.param("providerId");
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
    const provider = c.req.param("providerId");
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
    const result = updateChannel(this.options.configPath, channel, body.data, this.getExtensionConfigProjectionOptions());
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown channel: ${channel}`), 404);
    }
    this.publishConfigUpdatedPaths([`channels.${channel}`]);
    this.enqueueChannelConfigApply(channel);
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
          baseUrl: typeof payload.baseUrl === "string" ? payload.baseUrl : undefined,
          domain: typeof payload.domain === "string" ? payload.domain : undefined
        } satisfies ChannelAuthStartRequest,
        bindings: this.options.extensions?.getChannelBindings() ?? []
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
      bindings: this.options.extensions?.getChannelBindings() ?? []
    });
    if (!result) {
      return c.json(err("NOT_FOUND", "channel auth session not found"), 404);
    }
    if (result.status === "authorized") {
      await this.publishConfigUpdates([`channels.${channel}`]);
    }
    return c.json(ok(result satisfies ChannelAuthPollResult));
  };

  readonly connectChannelAuth = async (c: Context) => {
    const channel = c.req.param("channel");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const fields = body.data.fields && typeof body.data.fields === "object" && !Array.isArray(body.data.fields)
      ? body.data.fields as Record<string, unknown>
      : {};

    try {
      const result = await connectChannelAuth({
        configPath: this.options.configPath,
        channelId: channel,
        request: {
          accountId: typeof body.data.accountId === "string" ? body.data.accountId : undefined,
          domain: typeof body.data.domain === "string" ? body.data.domain : undefined,
          fields
        } satisfies ChannelAuthConnectRequest,
        bindings: this.options.extensions?.getChannelBindings() ?? []
      });
      if (!result) {
        return c.json(err("NOT_SUPPORTED", `channel auth connect is not supported: ${channel}`), 404);
      }
      if (result.status === "authorized") {
        await this.publishConfigUpdates([`channels.${channel}`]);
      }
      return c.json(ok(result satisfies ChannelAuthConnectResult));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json(err("AUTH_CONNECT_FAILED", message), 400);
    }
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
    if (body.data.agents?.runtimes && Object.prototype.hasOwnProperty.call(body.data.agents.runtimes, "entries")) {
      changedPaths.push("agents.runtimes.entries");
    }
    if (body.data.companion && Object.prototype.hasOwnProperty.call(body.data.companion, "enabled")) {
      changedPaths.push("companion.enabled");
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
