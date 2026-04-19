import { createRequire } from "node:module";
import { extname, isAbsolute, resolve, win32 as windowsPath } from "node:path";
import { fileURLToPath } from "node:url";
import { getDataDir } from "@nextclaw/core";

type HostAutostartRuntimeServiceOptions = {
  nodePath?: string;
  argvEntry?: string;
  importMetaUrl?: string;
  getDataDir?: () => string;
};

export type HostAutostartLaunchPlan = {
  homeDir: string;
  command: string;
  args: string[];
};

const TYPESCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const require = createRequire(import.meta.url);

const resolveCliAppEntryFromImportMeta = (importMetaUrl: string): string => {
  const modulePath = fileURLToPath(importMetaUrl);
  const normalizedPath = modulePath.replace(/\\/g, "/");
  const cliRootIndex = normalizedPath.lastIndexOf("/cli/");
  if (cliRootIndex === -1) {
    return fileURLToPath(new URL("../../../app/index.js", importMetaUrl));
  }
  const extension = extname(modulePath) || ".js";
  const cliRootPath = modulePath.slice(0, cliRootIndex + "/cli/".length);
  return resolve(cliRootPath, "app", `index${extension}`);
};

export class HostAutostartRuntimeService {
  private readonly nodePath: string;
  private readonly argvEntry: string | undefined;
  private readonly importMetaUrl: string;
  private readonly getResolvedDataDir: () => string;

  constructor(options: HostAutostartRuntimeServiceOptions = {}) {
    this.nodePath = options.nodePath ?? process.execPath;
    this.argvEntry = options.argvEntry ?? process.argv[1];
    this.importMetaUrl = options.importMetaUrl ?? import.meta.url;
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
    const argvEntry = this.argvEntry?.trim();
    if (argvEntry) {
      if (isAbsolute(argvEntry) || windowsPath.isAbsolute(argvEntry)) {
        return argvEntry;
      }
      return resolve(argvEntry);
    }
    return resolveCliAppEntryFromImportMeta(this.importMetaUrl);
  };
}
