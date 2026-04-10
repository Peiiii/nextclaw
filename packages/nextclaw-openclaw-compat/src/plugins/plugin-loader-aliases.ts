import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildWorkspaceHostPackageAliases } from "./development-source/workspace-host-package-aliases.js";

function resolvePluginSdkAliasFile(params: { srcFile: string; distFile: string }): string | null {
  try {
    const modulePath = fileURLToPath(import.meta.url);
    const isProduction = process.env.NODE_ENV === "production";
    let cursor = path.dirname(modulePath);
    for (let i = 0; i < 6; i += 1) {
      const srcCandidate = path.join(cursor, "src", "plugin-sdk", params.srcFile);
      const distCandidate = path.join(cursor, "dist", "plugin-sdk", params.distFile);
      const candidates = isProduction ? [distCandidate, srcCandidate] : [srcCandidate, distCandidate];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
      const parent = path.dirname(cursor);
      if (parent === cursor) {
        break;
      }
      cursor = parent;
    }
  } catch {
    return null;
  }
  return null;
}

function resolvePluginSdkAlias(): string | null {
  return resolvePluginSdkAliasFile({ srcFile: "index.ts", distFile: "index.js" });
}

function resolvePluginShimFile(relativePath: string): string | null {
  try {
    const modulePath = fileURLToPath(import.meta.url);
    const isProduction = process.env.NODE_ENV === "production";
    let cursor = path.dirname(modulePath);
    for (let i = 0; i < 6; i += 1) {
      const srcCandidate = path.join(cursor, "src", "plugins", "shims", relativePath);
      const distCandidate = path.join(cursor, "dist", "plugins", "shims", relativePath.replace(/\.ts$/, ".js"));
      const candidates = isProduction ? [distCandidate, srcCandidate] : [srcCandidate, distCandidate];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
      const parent = path.dirname(cursor);
      if (parent === cursor) {
        break;
      }
      cursor = parent;
    }
  } catch {
    return null;
  }
  return null;
}

export function buildPluginLoaderAliases(pluginRoot?: string): Record<string, string> {
  const aliases = buildWorkspaceHostPackageAliases({
    scope: "@nextclaw",
    pluginRoot,
  });
  const pluginSdkAlias = resolvePluginSdkAlias();
  if (pluginSdkAlias && (!pluginRoot || !fs.existsSync(path.join(pluginRoot, "node_modules", "openclaw")))) {
    aliases["openclaw/plugin-sdk"] = pluginSdkAlias;
  }
  const piCodingAgentShim = resolvePluginShimFile("pi-coding-agent.ts");
  if (piCodingAgentShim) {
    aliases["@mariozechner/pi-coding-agent"] = piCodingAgentShim;
  }
  return aliases;
}
