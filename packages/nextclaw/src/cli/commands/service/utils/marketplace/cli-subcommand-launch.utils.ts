import { createRequire } from "node:module";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const TYPESCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

const isTypeScriptEntry = (entry: string): boolean => TYPESCRIPT_EXTENSIONS.has(extname(entry).toLowerCase());

const resolveTsxCliEntry = (): string => require.resolve("tsx/cli");

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

export const resolveCliSubcommandEntry = (params: {
  argvEntry?: string;
  importMetaUrl: string;
}): string => {
  const argvEntry = params.argvEntry?.trim();
  if (argvEntry) {
    return resolve(argvEntry);
  }
  return resolveCliAppEntryFromImportMeta(params.importMetaUrl);
};

export const resolveCliSubcommandLaunch = (params: {
  argvEntry?: string;
  importMetaUrl: string;
  cliArgs: string[];
  nodePath?: string;
}): { command: string; args: string[] } => {
  const cliEntry = resolveCliSubcommandEntry({
    argvEntry: params.argvEntry,
    importMetaUrl: params.importMetaUrl,
  });
  const command = params.nodePath?.trim() || process.execPath;

  if (isTypeScriptEntry(cliEntry)) {
    return {
      command,
      args: [resolveTsxCliEntry(), cliEntry, ...params.cliArgs],
    };
  }

  return {
    command,
    args: [cliEntry, ...params.cliArgs],
  };
};
