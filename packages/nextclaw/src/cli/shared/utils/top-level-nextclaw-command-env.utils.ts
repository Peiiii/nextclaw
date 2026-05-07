import { createExternalCommandEnv } from "@nextclaw/core";

const NEXTCLAW_RUNTIME_BUNDLE_ENV_KEYS = [
  "NEXTCLAW_RUNTIME_BUNDLE_CHILD",
  "NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER",
] as const;

export function createTopLevelNextclawCommandEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  extraEnv: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  const env = createExternalCommandEnv(baseEnv, extraEnv);
  for (const key of NEXTCLAW_RUNTIME_BUNDLE_ENV_KEYS) {
    delete env[key];
  }
  return env;
}
