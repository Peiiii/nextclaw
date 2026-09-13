import { pathToFileURL } from "node:url";
import { isAbsolute } from "node:path";
import type {
  Connection,
  SourceAdapter,
  SourceFactory,
} from "../types/collaboration.types.js";
import { GitHubSource } from "../services/github-source.service.js";
import { LinearSource } from "../services/linear-source.service.js";
import { OfficialSource } from "../services/official-source.service.js";

export const builtinSources: Record<string, SourceFactory> = {
  github: (connection) => new GitHubSource(connection),
  linear: (connection) => new LinearSource(connection),
  official: (connection) => new OfficialSource(connection),
};
export async function loadSource(
  connection: Connection,
): Promise<SourceAdapter> {
  const builtin = builtinSources[connection.adapter];
  if (builtin) return builtin(connection);
  if (!connection.options.module || !isAbsolute(connection.options.module))
    throw new Error(
      "Custom adapter requires an explicitly installed absolute module path",
    );
  const module = (await import(
    pathToFileURL(connection.options.module).href
  )) as { contractVersion: number; createSource: SourceFactory };
  if (module.contractVersion !== 1 || typeof module.createSource !== "function")
    throw new Error(
      "Adapter must export contractVersion=1 and createSource(connection)",
    );
  const source = module.createSource(connection);
  if (source.id !== connection.adapter)
    throw new Error("Adapter ID does not match installed module");
  return source;
}
