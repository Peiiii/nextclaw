import type {
  ProviderAuthPollResult,
  ProviderConfigUpdate,
  ProviderConnectionTestResult,
  ProvidersView,
  ProviderTemplatesView,
} from "@nextclaw/server";
import type { UiApiClient } from "@nextclaw-cli/cli/app/services/local-api/local-ui-api-client.service.js";
import {
  parseConfigAssignment, parseConfigBoolean, printConfigResult, readConfigApiKey,
  requireConfigApiClient, requireConfigChange,
} from "@nextclaw-cli/cli/app/utils/config-command-options.utils.js";

type ProviderOptions = {
  type?: string; name?: string; apiBase?: string; wireApi?: "auto" | "chat" | "responses";
  apiKeyEnv?: string; clearApiKey?: boolean; header?: string[]; clearHeaders?: boolean;
};
type ModelOptions = {
  vision?: string[]; thinking?: string[]; thinkingDefault?: string[]; clear?: boolean;
};
type ThinkingLevel = NonNullable<NonNullable<ProviderConfigUpdate["modelConfig"]>[string]["thinking"]>["default"];
const thinkingLevels = ["off", "minimal", "low", "medium", "high", "adaptive", "xhigh"] as const;

export class ProviderCommandController {
  constructor(private readonly createApi: () => UiApiClient = requireConfigApiClient) {}

  private path = (id: string): string => `/api/providers/${encodeURIComponent(id)}`;

  private showRequest = async (path: string, method: "GET" | "POST" | "PUT" | "DELETE" = "GET", body?: unknown): Promise<void> => {
    printConfigResult(await this.createApi().request({ path, method, body }));
  };

  list = async (): Promise<void> => this.showRequest("/api/providers");
  templates = async (): Promise<void> => this.showRequest("/api/provider-templates");

  show = async (id: string): Promise<void> => {
    const result = await this.createApi().request<ProvidersView>({ path: "/api/providers" });
    if (!Object.hasOwn(result.providers, id)) throw new Error(`Unknown provider: ${id}`);
    printConfigResult(result.providers[id]);
  };

  add = async (id: string, options: ProviderOptions): Promise<void> => {
    if (!id.trim() || id.includes("/")) throw new Error("Provider id must be non-empty and cannot contain '/'.");
    const patch = this.providerPatch(options);
    await this.validateTemplate(patch.providerType);
    await this.showRequest("/api/providers", "POST", { providerId: id, ...patch });
  };

  update = async (id: string, options: ProviderOptions): Promise<void> => {
    const patch = this.providerPatch(options);
    requireConfigChange(patch);
    await this.validateTemplate(patch.providerType);
    await this.showRequest(this.path(id), "PUT", patch);
  };

  remove = async (id: string): Promise<void> => this.showRequest(this.path(id), "DELETE");
  enabled = async (id: string, enabled: boolean): Promise<void> => this.showRequest(this.path(id), "PUT", { enabled });

  models = async (id: string): Promise<void> => {
    const result = await this.createApi().request<ProvidersView>({ path: "/api/providers" });
    if (!Object.hasOwn(result.providers, id)) throw new Error(`Unknown provider: ${id}`);
    const provider = result.providers[id];
    printConfigResult({ providerId: id, models: provider.models ?? [], modelConfig: provider.modelConfig ?? {} });
  };

  discover = async (id: string): Promise<void> => this.showRequest(`${this.path(id)}/models/discover`, "POST", {});
  setModels = async (id: string, models: string[]): Promise<void> => this.showRequest(this.path(id), "PUT", { models });

  configureModels = async (id: string, options: ModelOptions): Promise<void> => {
    const { vision = [], thinking = [], thinkingDefault = [], clear } = options;
    const entries = [...vision, ...thinking, ...thinkingDefault];
    if (clear && entries.length) throw new Error("--clear cannot be combined with model capability options.");
    if (!clear && !entries.length) throw new Error("Specify model capabilities or --clear.");
    const modelConfig: NonNullable<ProviderConfigUpdate["modelConfig"]> = Object.create(null);
    for (const entry of vision) {
      const [model, value] = parseConfigAssignment(entry);
      (modelConfig[model] ??= {}).vision = parseConfigBoolean(value);
    }
    for (const entry of thinking) {
      const [model, value] = parseConfigAssignment(entry);
      (modelConfig[model] ??= {}).thinking = { supported: value.split(",").map(parseThinkingLevel) };
    }
    for (const entry of thinkingDefault) {
      const [model, value] = parseConfigAssignment(entry);
      const config = modelConfig[model] ??= {};
      const level = parseThinkingLevel(value);
      if (!config.thinking?.supported?.includes(level)) {
        throw new Error(`Default thinking level for ${model} must be included in --thinking for that model.`);
      }
      config.thinking.default = level;
    }
    await this.showRequest(this.path(id), "PUT", { modelConfig });
  };

  test = async (id: string, options: { model?: string }): Promise<void> => {
    const result = await this.createApi().request<ProviderConnectionTestResult>({
      path: `${this.path(id)}/test`, method: "POST", body: { model: options.model },
    });
    printConfigResult(result);
    if (!result.success) process.exitCode = 1;
  };

  startAuth = async (id: string, options: { method?: string }): Promise<void> =>
    this.showRequest(`${this.path(id)}/auth/start`, "POST", { methodId: options.method });

  pollAuth = async (id: string, sessionId: string): Promise<void> => {
    const result = await this.createApi().request<ProviderAuthPollResult>({
      path: `${this.path(id)}/auth/poll`, method: "POST", body: { sessionId },
    });
    printConfigResult(result);
    if (["denied", "expired", "error"].includes(result.status)) process.exitCode = 1;
  };

  importAuth = async (id: string): Promise<void> => this.showRequest(`${this.path(id)}/auth/import-cli`, "POST", {});

  private validateTemplate = async (type: string | null | undefined): Promise<void> => {
    if (type == null) return;
    const { providerTemplates } = await this.createApi().request<ProviderTemplatesView>({ path: "/api/provider-templates" });
    if (!providerTemplates.some((template) => template.id === type)) {
      throw new Error(`Unknown provider type: ${type}. Use providers templates or --type custom.`);
    }
  };

  private providerPatch = (options: ProviderOptions): ProviderConfigUpdate => {
    const { type, name, apiBase, wireApi, header, clearHeaders } = options;
    const patch: ProviderConfigUpdate = {};
    if (type !== undefined) patch.providerType = type === "custom" ? null : type;
    if (name !== undefined) patch.displayName = name;
    if (apiBase !== undefined) patch.apiBase = apiBase || null;
    if (wireApi !== undefined) patch.wireApi = wireApi;
    const key = readConfigApiKey(options);
    if (key !== undefined) patch.apiKey = key;
    if (header && clearHeaders) throw new Error("Choose --header or --clear-headers, not both.");
    if (header) patch.extraHeaders = Object.fromEntries(header.map(parseConfigAssignment));
    if (clearHeaders) patch.extraHeaders = null;
    return patch;
  };
}

function parseThinkingLevel(value: string): Exclude<ThinkingLevel, null | undefined> {
  const level = thinkingLevels.find((item) => item === value);
  if (!level) throw new Error(`Unknown thinking level: ${value}. Choose ${thinkingLevels.join(", ")}.`);
  return level;
}
