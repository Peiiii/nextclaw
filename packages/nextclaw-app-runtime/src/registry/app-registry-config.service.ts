import { readFile, rm, writeFile } from "node:fs/promises";
import { AppHomeService } from "../paths/app-home.service.js";
import {
  DEFAULT_APP_REGISTRY_URL,
  type AppRegistryConfig,
  type AppRegistryConfigSnapshot,
} from "./app-remote-registry.types.js";

export class AppRegistryConfigService {
  constructor(
    private readonly appHomeService: AppHomeService = new AppHomeService(),
  ) {}

  getSnapshot = async (): Promise<AppRegistryConfigSnapshot> => {
    const envUrl = process.env.NEXTCLAW_APP_REGISTRY?.trim();
    if (envUrl) {
      return {
        defaultUrl: DEFAULT_APP_REGISTRY_URL,
        currentUrl: this.normalizeRegistryUrl(envUrl),
        source: "env",
      };
    }
    const config = await this.loadOptionalConfig();
    if (config) {
      return {
        defaultUrl: DEFAULT_APP_REGISTRY_URL,
        currentUrl: this.normalizeRegistryUrl(config.registry.url),
        source: "config",
      };
    }
    return {
      defaultUrl: DEFAULT_APP_REGISTRY_URL,
      currentUrl: DEFAULT_APP_REGISTRY_URL,
      source: "default",
    };
  };

  setRegistryUrl = async (registryUrl: string): Promise<AppRegistryConfigSnapshot> => {
    const normalized = this.normalizeRegistryUrl(registryUrl);
    await this.appHomeService.ensureBaseDirectories();
    await writeFile(
      this.appHomeService.getConfigPath(),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          registry: {
            url: normalized,
          },
        } satisfies AppRegistryConfig,
        null,
        2,
      )}\n`,
      "utf-8",
    );
    return {
      defaultUrl: DEFAULT_APP_REGISTRY_URL,
      currentUrl: normalized,
      source: "config",
    };
  };

  resetRegistryUrl = async (): Promise<AppRegistryConfigSnapshot> => {
    await rm(this.appHomeService.getConfigPath(), { force: true });
    return {
      defaultUrl: DEFAULT_APP_REGISTRY_URL,
      currentUrl: DEFAULT_APP_REGISTRY_URL,
      source: "default",
    };
  };

  private loadOptionalConfig = async (): Promise<AppRegistryConfig | undefined> => {
    try {
      const raw = await readFile(this.appHomeService.getConfigPath(), "utf-8");
      return this.parseConfig(JSON.parse(raw) as unknown);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return undefined;
      }
      throw error;
    }
  };

  private parseConfig = (rawConfig: unknown): AppRegistryConfig => {
    if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
      throw new Error("config.json 必须是对象。");
    }
    const candidate = rawConfig as Record<string, unknown>;
    if (candidate.schemaVersion !== 1) {
      throw new Error("当前只支持 config schemaVersion = 1。");
    }
    const registry = candidate.registry;
    if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
      throw new Error("config.registry 必须是对象。");
    }
    const registryUrl = (registry as Record<string, unknown>).url;
    if (typeof registryUrl !== "string" || !registryUrl.trim()) {
      throw new Error("config.registry.url 必须是非空字符串。");
    }
    return {
      schemaVersion: 1,
      registry: {
        url: this.normalizeRegistryUrl(registryUrl),
      },
    };
  };

  private normalizeRegistryUrl = (registryUrl: string): string => {
    let normalized: URL;
    try {
      normalized = new URL(registryUrl);
    } catch {
      throw new Error(`非法 registry URL：${registryUrl}`);
    }
    if (normalized.protocol !== "http:" && normalized.protocol !== "https:") {
      throw new Error(`registry URL 只支持 http/https：${registryUrl}`);
    }
    const text = normalized.toString();
    return text.endsWith("/") ? text : `${text}/`;
  };
}
