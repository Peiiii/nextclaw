import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

type NextclawConfig = {
  providers?: Record<string, {
    apiKey?: string;
    apiBase?: string | null;
  } | undefined>;
};

export type PlatformPublishAuthState = {
  token: string | null;
  apiBaseUrl?: string;
};

export class PlatformAuthStateService {
  readCurrentAuthState = (): PlatformPublishAuthState => {
    const configPath = this.resolveConfigPath();
    if (!existsSync(configPath)) {
      return {
        token: null,
      };
    }
    try {
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw) as NextclawConfig;
      const provider = parsed.providers?.nextclaw;
      const token = typeof provider?.apiKey === "string" && provider.apiKey.trim().length > 0
        ? provider.apiKey.trim()
        : null;
      const apiBase = typeof provider?.apiBase === "string" && provider.apiBase.trim().length > 0
        ? provider.apiBase.trim()
        : undefined;
      return {
        token,
        apiBaseUrl: apiBase,
      };
    } catch {
      return {
        token: null,
      };
    }
  };

  private resolveConfigPath = (): string => {
    const nextclawHome = process.env.NEXTCLAW_HOME?.trim();
    const dataHome = nextclawHome && nextclawHome.length > 0
      ? resolve(nextclawHome)
      : resolve(homedir(), ".nextclaw");
    return resolve(dataHome, "config.json");
  };
}
