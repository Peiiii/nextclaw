import { createPluginJiti } from "./plugin-loader-jiti.js";
import { buildPluginLoaderAliases } from "./plugin-loader-aliases.utils.js";
import type { OpenClawPluginModule, PluginRegistry } from "./types.js";

type PluginDiagnostic = PluginRegistry["diagnostics"][number];

export function resolveBundledPluginEntry(
  require: NodeRequire,
  packageName: string,
  onDiagnostic: (diagnostic: PluginDiagnostic) => void,
  resolvePackageRootFromEntry: (entryFile: string) => string
): { entryFile: string; rootDir: string } | null {
  try {
    const entryFile = require.resolve(packageName);
    return {
      entryFile,
      rootDir: resolvePackageRootFromEntry(entryFile)
    };
  } catch (err) {
    onDiagnostic({
      level: "error",
      source: packageName,
      message: `bundled plugin package not resolvable: ${String(err)}`
    });
    return null;
  }
}

export function loadBundledPluginModule(entryFile: string, rootDir: string): OpenClawPluginModule {
  const pluginJiti = createPluginJiti(buildPluginLoaderAliases(rootDir));
  return pluginJiti(entryFile) as OpenClawPluginModule;
}
