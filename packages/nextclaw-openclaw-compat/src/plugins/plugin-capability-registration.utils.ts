import type { PluginDiagnostic } from "./types.js";

export function ensureUniqueNames(params: {
  names: string[];
  pluginId: string;
  diagnostics: PluginDiagnostic[];
  source: string;
  owners: Map<string, string>;
  reserved: Set<string>;
  kind: "tool" | "channel" | "provider";
}): string[] {
  const {
    diagnostics,
    kind,
    names,
    owners,
    pluginId,
    reserved,
    source,
  } = params;
  const accepted: string[] = [];
  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) {
      continue;
    }
    if (reserved.has(name)) {
      diagnostics.push({
        level: "error",
        pluginId,
        source,
        message: `${kind} already registered by core: ${name}`,
      });
      continue;
    }
    const owner = owners.get(name);
    if (owner && owner !== pluginId) {
      diagnostics.push({
        level: "error",
        pluginId,
        source,
        message: `${kind} already registered: ${name} (${owner})`,
      });
      continue;
    }
    owners.set(name, pluginId);
    accepted.push(name);
  }
  return accepted;
}
