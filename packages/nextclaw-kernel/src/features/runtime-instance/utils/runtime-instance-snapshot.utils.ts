import { resolve } from "node:path";
import {
  RUNTIME_INSTANCE_DESKTOP_DATA_DIRECTORY_ENV,
  RUNTIME_INSTANCE_DESKTOP_LOGS_DIRECTORY_ENV,
  RUNTIME_INSTANCE_DISTRIBUTION_ENV,
  RUNTIME_INSTANCE_INSTALLATION_KIND_ENV,
  RUNTIME_INSTANCE_PORTABLE_DATA_ROOT_ENV,
} from "@nextclaw/core";

export {
  RUNTIME_INSTANCE_DESKTOP_DATA_DIRECTORY_ENV,
  RUNTIME_INSTANCE_DESKTOP_LOGS_DIRECTORY_ENV,
  RUNTIME_INSTANCE_DISTRIBUTION_ENV,
  RUNTIME_INSTANCE_INSTALLATION_KIND_ENV,
  RUNTIME_INSTANCE_PORTABLE_DATA_ROOT_ENV,
} from "@nextclaw/core";

export type RuntimeDistribution = "desktop" | "cli" | "unknown";
export type RuntimeInstallationKind = "portable" | "installed" | null;

export type RuntimeInstanceSnapshot = {
  distribution: RuntimeDistribution;
  installationKind: RuntimeInstallationKind;
  storage: {
    portableDataRoot: string | null;
    runtimeHome: string;
    desktopDataDirectory: string | null;
    desktopLogsDirectory: string | null;
    runtimeLogsDirectory: string;
    configPath: string;
    workspacePath: string;
  };
};

export type ResolveRuntimeInstanceSnapshotParams = {
  configPath: string;
  runtimeHome: string;
  runtimeLogsDirectory: string;
  workspacePath: string;
  env?: NodeJS.ProcessEnv;
};

function readPath(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = env[key]?.trim();
  return value ? resolve(value) : null;
}

function resolveDistribution(env: NodeJS.ProcessEnv): RuntimeDistribution {
  const value = env[RUNTIME_INSTANCE_DISTRIBUTION_ENV]?.trim();
  if (!value) return "cli";
  if (value === "desktop" || value === "cli") return value;
  return "unknown";
}

function resolveInstallationKind(
  distribution: RuntimeDistribution,
  env: NodeJS.ProcessEnv,
): RuntimeInstallationKind {
  if (distribution !== "desktop") return null;
  const value = env[RUNTIME_INSTANCE_INSTALLATION_KIND_ENV]?.trim();
  return value === "portable" || value === "installed" ? value : null;
}

export function resolveRuntimeInstanceSnapshot(
  params: ResolveRuntimeInstanceSnapshotParams,
): RuntimeInstanceSnapshot {
  const { configPath, runtimeHome, runtimeLogsDirectory, workspacePath } = params;
  const env = params.env ?? process.env;
  const distribution = resolveDistribution(env);
  const installationKind = resolveInstallationKind(distribution, env);
  const hasDesktopContext = distribution === "desktop" && installationKind !== null;

  return {
    distribution,
    installationKind,
    storage: {
      portableDataRoot: installationKind === "portable"
        ? readPath(env, RUNTIME_INSTANCE_PORTABLE_DATA_ROOT_ENV)
        : null,
      runtimeHome: resolve(runtimeHome),
      desktopDataDirectory: hasDesktopContext
        ? readPath(env, RUNTIME_INSTANCE_DESKTOP_DATA_DIRECTORY_ENV)
        : null,
      desktopLogsDirectory: hasDesktopContext
        ? readPath(env, RUNTIME_INSTANCE_DESKTOP_LOGS_DIRECTORY_ENV)
        : null,
      runtimeLogsDirectory: resolve(runtimeLogsDirectory),
      configPath: resolve(configPath),
      workspacePath: resolve(workspacePath),
    },
  };
}
