import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  ConfigSchema,
  type Config
} from "./schema.js";
import { getDataPath } from "../utils/helpers.js";

export function getConfigPath(): string {
  return resolve(getDataPath(), "config.json");
}

export function getDataDir(): string {
  return getDataPath();
}

export function loadConfig(configPath?: string): Config {
  const path = configPath ?? getConfigPath();
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf-8");
      const data = JSON.parse(raw);
      const migrated = migrateConfig(data);
      return ConfigSchema.parse(migrated);
    } catch (err) {
      const message = err instanceof z.ZodError ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`Warning: Failed to load config from ${path}: ${message}`);
    }
  }
  return ConfigSchema.parse({});
}

export function saveConfig(config: Config, configPath?: string): void {
  const path = configPath ?? getConfigPath();
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2));
}

function migrateConfig(data: Record<string, unknown>): Record<string, unknown> {
  const tools = (data.tools ?? {}) as Record<string, unknown>;
  const execConfig = (tools.exec ?? {}) as Record<string, unknown>;
  if (execConfig.restrictToWorkspace !== undefined && tools.restrictToWorkspace === undefined) {
    tools.restrictToWorkspace = execConfig.restrictToWorkspace;
  }
  return { ...data, tools };
}
