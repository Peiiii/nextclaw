import { existsSync, readFileSync } from "node:fs";
import { getConfigPath, loadConfig, resolveConfigSecrets, saveConfig, type Config } from "@nextclaw/core";
import type { ConfigPersistence } from "@kernel/types/config-persistence.types.js";

/** Node adapter preserving the installed product's configuration and secret resolution. */
export class LocalConfigStore implements ConfigPersistence {
  readonly location: string;

  constructor(configPath?: string) {
    this.location = configPath ?? getConfigPath();
  }

  load = (): Config => resolveConfigSecrets(loadConfig(this.location), { configPath: this.location });
  readRaw = (): string | null => existsSync(this.location) ? readFileSync(this.location, "utf-8") : null;
  save = (config: Config): void => saveConfig(config, this.location);
}
