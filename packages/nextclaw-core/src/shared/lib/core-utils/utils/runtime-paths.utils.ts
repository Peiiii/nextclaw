import { resolve } from "node:path";
import { ensureDir, getDataPath } from "./helpers.js";

export const ENV_RUN_HOME_KEY = "NEXTCLAW_RUN_HOME";

export function getRunPath(): string {
  const override = process.env[ENV_RUN_HOME_KEY]?.trim();
  if (override) {
    return ensureDir(resolve(override));
  }
  return ensureDir(resolve(getDataPath(), "run"));
}

export function getRuntimeLogsPath(): string {
  const override = process.env[ENV_RUN_HOME_KEY]?.trim();
  if (override) {
    return ensureDir(resolve(override, "logs"));
  }
  return ensureDir(resolve(getDataPath(), "logs"));
}
