import { createRequire } from "node:module";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const TYPESCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

const isTypeScriptEntry = (entry: string): boolean => TYPESCRIPT_EXTENSIONS.has(extname(entry).toLowerCase());

const resolveTsxCliEntry = (): string => require.resolve("tsx/dist/cli.mjs");

export const resolveCliSubcommandEntry = (params: {
  argvEntry?: string;
  importMetaUrl: string;
}): string => {
  const argvEntry = params.argvEntry?.trim();
  if (argvEntry) {
    return resolve(argvEntry);
  }
  return fileURLToPath(new URL("../index.js", params.importMetaUrl));
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
