import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const CLIENT_SDK_BROWSER_BUNDLE = join("browser", "browser-global-registration.utils.iife.js");

let cachedScript: Promise<string> | null = null;

export function readPanelAppClientSdkScript(): Promise<string> {
  cachedScript ??= readFile(resolvePanelAppClientSdkScriptPath(), "utf8");
  return cachedScript;
}

function resolvePanelAppClientSdkScriptPath(): string {
  const packageRoot = resolveClientSdkPackageRoot();
  const bundlePath = join(packageRoot, "dist", CLIENT_SDK_BROWSER_BUNDLE);
  if (!existsSync(bundlePath)) {
    throw new Error(
      `Panel App client SDK browser bundle is missing at ${bundlePath}. Run @nextclaw/client-sdk build first.`,
    );
  }
  return bundlePath;
}

function resolveClientSdkPackageRoot(): string {
  let current = dirname(require.resolve("@nextclaw/client-sdk"));
  while (current !== dirname(current)) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }
    current = dirname(current);
  }
  throw new Error("Unable to resolve @nextclaw/client-sdk package root.");
}
