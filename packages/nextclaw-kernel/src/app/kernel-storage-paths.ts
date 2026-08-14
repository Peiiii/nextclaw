import { resolve } from "node:path";
import {
  ensureDir,
  expandHome,
  getDataDir,
  getSessionsPath,
} from "@nextclaw/core";

export type KernelStoragePathOptions = {
  homeDir?: string;
};

export function resolveKernelAppHomeDirectory(options: KernelStoragePathOptions): string {
  const homeDir = options.homeDir?.trim();
  return resolve(homeDir ? expandHome(homeDir) : getDataDir(), "apps");
}

export function resolveKernelSessionsDir(options: KernelStoragePathOptions): string {
  const homeDir = options.homeDir?.trim();
  return homeDir
    ? ensureDir(resolve(expandHome(homeDir), "sessions"))
    : getSessionsPath();
}

export function resolveKernelAutomationStorePath(options: KernelStoragePathOptions): string {
  return resolveKernelDataPath(options, "cron", "jobs.json");
}

export function resolveKernelPreferenceStorePath(options: KernelStoragePathOptions): string {
  return resolveKernelDataPath(options, "preferences", "preferences.json");
}

export function resolveKernelProjectStorePath(options: KernelStoragePathOptions): string {
  return resolveKernelDataPath(options, "projects", "projects.json");
}

export function resolveKernelInboxDeliveryStorePath(options: KernelStoragePathOptions): string {
  return resolveKernelDataPath(options, "inbox", "deliveries.json");
}

function resolveKernelDataPath(
  options: KernelStoragePathOptions,
  ...segments: string[]
): string {
  const homeDir = options.homeDir?.trim();
  return resolve(homeDir ? expandHome(homeDir) : getDataDir(), ...segments);
}
