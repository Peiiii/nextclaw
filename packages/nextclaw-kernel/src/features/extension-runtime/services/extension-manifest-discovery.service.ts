import { getDataPath } from "@nextclaw/core";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config, ExtensionManifest } from "@kernel/features/extension-runtime/index.js";

const EXTENSION_MANIFEST_FILE = "nextclaw.extension.json";
const BUILTIN_EXTENSION_PACKAGES = [
  "@nextclaw/channel-extension-dingtalk",
  "@nextclaw/channel-extension-discord",
  "@nextclaw/channel-extension-email",
  "@nextclaw/channel-extension-feishu",
  "@nextclaw/channel-extension-qq",
  "@nextclaw/channel-extension-slack",
  "@nextclaw/channel-extension-telegram",
  "@nextclaw/channel-extension-wecom",
  "@nextclaw/channel-extension-whatsapp",
  "@nextclaw/channel-extension-weixin",
] as const;
const runtimeRequire = createRequire(import.meta.url);

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value);
  return entries.every(([, item]) => typeof item === "string")
    ? Object.fromEntries(entries) as Record<string, string>
    : undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const path of paths) {
    const normalized = resolve(path);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(normalized);
    }
  }
  return unique;
}

function findExtensionManifestRoot(startPath: string): string | undefined {
  let current = resolve(startPath);
  while (true) {
    if (existsSync(join(current, EXTENSION_MANIFEST_FILE))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function resolveDevFirstPartyExtensionDir(
  explicitDir = process.env.NEXTCLAW_DEV_FIRST_PARTY_EXTENSION_DIR,
  moduleDir = dirname(fileURLToPath(import.meta.url)),
): string | undefined {
  const configured = explicitDir?.trim();
  if (configured) {
    return configured;
  }
  const candidates = [
    resolve(moduleDir, "../../extensions"),
    resolve(moduleDir, "../../../extensions"),
    resolve(moduleDir, "../../../../extensions"),
    resolve(moduleDir, "../../../../../extensions"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function toManifest(value: unknown, rootDir: string): ExtensionManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("extension manifest must be an object");
  }
  const record = value as Record<string, unknown>;
  const server = readRecord(record.server);
  const id = readString(record.id);
  const command = readString(server.command);
  if (!id) {
    throw new Error("extension manifest id is required");
  }
  if (server.type !== "stdio") {
    throw new Error("extension server.type must be stdio");
  }
  if (!command) {
    throw new Error("extension server.command is required");
  }
  return {
    id,
    rootDir,
    ...(readString(record.name) ? { name: readString(record.name) } : {}),
    ...(readString(record.version) ? { version: readString(record.version) } : {}),
    server: {
      type: "stdio",
      command,
      ...(readStringArray(server.args) ? { args: readStringArray(server.args) } : {}),
      ...(readStringRecord(server.env) ? { env: readStringRecord(server.env) } : {}),
    },
    ...(record.contributes && typeof record.contributes === "object" && !Array.isArray(record.contributes)
      ? { contributes: record.contributes as ExtensionManifest["contributes"] }
      : {}),
  };
}

export function resolveBuiltinExtensionManifestRoots(): string[] {
  if (process.env.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS === "1") {
    return [];
  }
  const roots: string[] = [];
  for (const packageName of BUILTIN_EXTENSION_PACKAGES) {
    try {
      const entryPath = runtimeRequire.resolve(packageName);
      const root = findExtensionManifestRoot(dirname(entryPath));
      if (root) {
        roots.push(root);
      }
    } catch {
      // Built-in packages can be omitted by some development package manager installs.
    }
  }
  return uniquePaths(roots);
}

export function resolveExtensionManifestRoots(params: {
  config: Config;
  workspace: string;
}): string[] {
  const devExtensionsDir = resolveDevFirstPartyExtensionDir();
  return uniquePaths([
    join(getDataPath(), "extensions"),
    join(params.workspace, ".nextclaw", "extensions"),
    ...(devExtensionsDir ? [devExtensionsDir] : []),
    ...resolveBuiltinExtensionManifestRoots(),
    ...(params.config.plugins.load?.paths ?? []),
  ]);
}

export class ExtensionManifestDiscoveryService {
  discover = async (roots: string[]): Promise<ExtensionManifest[]> => {
    const manifests: ExtensionManifest[] = [];
    for (const root of roots) {
      manifests.push(...(await this.discoverRoot(root)));
    }
    return this.uniqueById(manifests);
  };

  discoverSync = (roots: string[]): ExtensionManifest[] => {
    const manifests: ExtensionManifest[] = [];
    for (const root of roots) {
      manifests.push(...this.discoverRootSync(root));
    }
    return this.uniqueById(manifests);
  };

  private uniqueById = (manifests: ExtensionManifest[]): ExtensionManifest[] => {
    const seen = new Set<string>();
    const unique: ExtensionManifest[] = [];
    for (const manifest of manifests) {
      if (seen.has(manifest.id)) {
        continue;
      }
      seen.add(manifest.id);
      unique.push(manifest);
    }
    return unique;
  };

  private discoverRoot = async (root: string): Promise<ExtensionManifest[]> => {
    const directManifest = await this.readManifestIfExists(join(root, EXTENSION_MANIFEST_FILE));
    if (directManifest) {
      return [directManifest];
    }
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    const manifests = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => this.readManifestIfExists(join(root, entry.name, EXTENSION_MANIFEST_FILE))),
    );
    return manifests.filter((manifest): manifest is ExtensionManifest => Boolean(manifest));
  };

  private discoverRootSync = (root: string): ExtensionManifest[] => {
    const directManifest = this.readManifestIfExistsSync(join(root, EXTENSION_MANIFEST_FILE));
    if (directManifest) {
      return [directManifest];
    }
    return this.readDirectoriesSync(root)
      .map((entry) => this.readManifestIfExistsSync(join(root, entry, EXTENSION_MANIFEST_FILE)))
      .filter((manifest): manifest is ExtensionManifest => Boolean(manifest));
  };

  private readManifestIfExists = async (path: string): Promise<ExtensionManifest | null> => {
    try {
      return toManifest(JSON.parse(await readFile(path, "utf-8")), dirname(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  };

  private readManifestIfExistsSync = (path: string): ExtensionManifest | null => {
    try {
      return toManifest(JSON.parse(readFileSync(path, "utf-8")), dirname(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  };

  private readDirectoriesSync = (root: string): string[] => {
    try {
      return readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  };
}
