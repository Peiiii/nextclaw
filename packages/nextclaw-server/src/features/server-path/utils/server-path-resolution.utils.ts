import { homedir } from "node:os";
import { resolve } from "node:path";
import { expandHome } from "@nextclaw/core";

export class ServerPathResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerPathResolutionError";
  }
}

export function resolveServerPath(params: {
  path?: string | null;
  basePath?: string | null;
  defaultToHome?: boolean;
}): string {
  const { path, basePath: rawBasePath, defaultToHome } = params;
  const rawPath = typeof path === "string" ? path.trim() : "";
  const basePath = typeof rawBasePath === "string" ? rawBasePath.trim() : "";
  if (!rawPath) {
    if (defaultToHome) {
      return resolve(expandHome(basePath || homedir()));
    }
    throw new ServerPathResolutionError("server path is required");
  }
  const expandedPath = expandHome(rawPath);
  if (expandedPath.startsWith("/") || /^[a-z]:[\\/]/i.test(expandedPath)) {
    return resolve(expandedPath);
  }
  if (!basePath) {
    throw new ServerPathResolutionError("relative server path requires a base path");
  }
  return resolve(expandHome(basePath), expandedPath);
}
