import { readFile, stat } from "node:fs/promises";
import { platform } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { ServerPathLocationView } from "@nextclaw-server/shared/types/server-api.types.js";

type HomeLocationKind = "desktop" | "documents" | "downloads";

const xdgLocationKinds: Record<string, HomeLocationKind> = {
  XDG_DESKTOP_DIR: "desktop",
  XDG_DOCUMENTS_DIR: "documents",
  XDG_DOWNLOAD_DIR: "downloads",
};

function readAbsoluteEnvironmentPath(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && isAbsolute(value) ? resolve(value) : null;
}

function parseXdgLocationPath(value: string, homePath: string): string | null {
  const unquoted = value.trim().replace(/^(['"])(.*)\1$/, "$2");
  const expanded = unquoted.replace(
    /^\$(?:HOME|\{HOME\})(?=\/|$)/,
    homePath,
  );
  const resolvedPath = isAbsolute(expanded) ? resolve(expanded) : null;
  return resolvedPath && resolvedPath !== homePath ? resolvedPath : null;
}

async function readXdgLocationPaths(
  homePath: string,
): Promise<Partial<Record<HomeLocationKind, string>>> {
  const configRoot =
    readAbsoluteEnvironmentPath("XDG_CONFIG_HOME") ?? join(homePath, ".config");
  let content: string;
  try {
    content = await readFile(join(configRoot, "user-dirs.dirs"), "utf8");
  } catch {
    return {};
  }

  const locations: Partial<Record<HomeLocationKind, string>> = {};
  for (const line of content.split(/\r?\n/)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }
    const kind = xdgLocationKinds[line.slice(0, separatorIndex).trim()];
    if (!kind) {
      continue;
    }
    const path = parseXdgLocationPath(line.slice(separatorIndex + 1), homePath);
    if (path) {
      locations[kind] = path;
    }
  }
  return locations;
}

async function resolveFirstDirectory(
  kind: ServerPathLocationView["kind"],
  candidatePaths: Array<string | null | undefined>,
): Promise<ServerPathLocationView | null> {
  const uniquePaths = [
    ...new Set(candidatePaths.filter((path): path is string => Boolean(path))),
  ];
  for (const path of uniquePaths) {
    try {
      if ((await stat(path)).isDirectory()) {
        return { kind, path };
      }
    } catch {
      // Optional locations are omitted when the server cannot read them.
    }
  }
  return null;
}

export async function resolveServerPathLocations(
  homePath: string,
): Promise<ServerPathLocationView[]> {
  const serverPlatform = platform();
  const xdgLocations =
    serverPlatform === "linux" ? await readXdgLocationPaths(homePath) : {};
  const oneDriveRoots = serverPlatform === "win32"
    ? ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"]
      .map(readAbsoluteEnvironmentPath)
      .filter((path): path is string => path !== null)
    : [];
  const homeLocations = await Promise.all([
    resolveFirstDirectory("desktop", [
      xdgLocations.desktop,
      ...oneDriveRoots.map((path) => join(path, "Desktop")),
      join(homePath, "Desktop"),
    ]),
    resolveFirstDirectory("documents", [
      xdgLocations.documents,
      ...oneDriveRoots.map((path) => join(path, "Documents")),
      join(homePath, "Documents"),
    ]),
    resolveFirstDirectory("downloads", [
      xdgLocations.downloads,
      join(homePath, "Downloads"),
    ]),
  ]);
  const macLocations = serverPlatform === "darwin"
    ? await Promise.all([
      resolveFirstDirectory("icloud-drive", [
        join(homePath, "Library", "Mobile Documents", "com~apple~CloudDocs"),
      ]),
      resolveFirstDirectory("applications", ["/Applications"]),
      resolveFirstDirectory("volumes", ["/Volumes"]),
    ])
    : [];

  return [...homeLocations, ...macLocations].filter(
    (location): location is ServerPathLocationView => location !== null,
  );
}
