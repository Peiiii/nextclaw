import { createRequire } from "node:module";
import { extname, isAbsolute, resolve, win32 as windowsPath } from "node:path";
import { getDataDir } from "@nextclaw/core";
import { NextclawDistributionService } from "@nextclaw-service/services/runtime/nextclaw-distribution.service.js";

type HostAutostartRuntimeServiceOptions = {
  nodePath?: string;
  argvEntry?: string;
  getDataDir?: () => string;
};

export type HostAutostartLaunchPlan = {
  homeDir: string;
  command: string;
  args: string[];
};

const TYPESCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const require = createRequire(import.meta.url);

export class HostAutostartRuntimeService {
  private readonly nodePath: string;
  private readonly argvEntry: string | undefined;
  private readonly getResolvedDataDir: () => string;

  constructor(options: HostAutostartRuntimeServiceOptions = {}) {
    this.nodePath = options.nodePath ?? process.execPath;
    this.argvEntry = options.argvEntry;
    this.getResolvedDataDir = options.getDataDir ?? getDataDir;
  }

  resolveForegroundServeLaunch = (): HostAutostartLaunchPlan => {
    const cliEntry = this.resolveCliEntry();
    return {
      homeDir: this.getResolvedDataDir(),
      command: this.nodePath,
      args: TYPESCRIPT_EXTENSIONS.has(extname(cliEntry).toLowerCase())
        ? [require.resolve("tsx/cli"), cliEntry, "serve"]
        : [cliEntry, "serve"],
    };
  };

  private resolveCliEntry = (): string => {
    const argvEntry = (this.argvEntry ?? NextclawDistributionService.get().launcherEntrypoint).trim();
    if (argvEntry) {
      if (isAbsolute(argvEntry) || windowsPath.isAbsolute(argvEntry)) {
        return argvEntry;
      }
      return resolve(argvEntry);
    }
    throw new Error("NextClaw launcher entrypoint is not configured.");
  };
}
