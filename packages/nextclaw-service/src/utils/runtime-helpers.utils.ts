import { expandHome, getWorkspacePath, type Config } from "@nextclaw/core";

export function resolveSkillsInstallWorkdir(params: {
  explicitWorkdir?: string;
  configuredWorkspace?: string;
}): string {
  if (params.explicitWorkdir) {
    return expandHome(params.explicitWorkdir);
  }
  return getWorkspacePath(params.configuredWorkspace);
}

export function parseStartTimeoutMs(value: string | number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error("Invalid --start-timeout value. Provide milliseconds (e.g. 45000).");
    process.exit(1);
  }
  return Math.floor(parsed);
}

export function resolveManagedServiceUiOverrides(params: {
  uiPort: string | number | undefined;
  forcedPublicHost: string;
}): Partial<Config["ui"]> {
  const uiOverrides: Partial<Config["ui"]> = {
    enabled: true,
    host: params.forcedPublicHost,
    open: false,
  };
  if (params.uiPort) {
    uiOverrides.port = Number(params.uiPort);
  }
  return uiOverrides;
}
