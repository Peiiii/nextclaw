import { lstat, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { WorkspaceFilePort } from "@kernel/tools/workspace-file.tools.js";

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

/** Local host binding for the same workspace tools used by other hosts. */
export class LocalWorkspaceFileStore implements WorkspaceFilePort {
  constructor(private readonly allowedDir?: string) {}

  resolve = (path: string): string => {
    const resolved = resolve(this.allowedDir ?? process.cwd(), path);
    if (this.allowedDir) {
      const rel = relative(resolve(this.allowedDir), resolved);
      if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) {
        throw new Error("Access denied: path outside allowed directory");
      }
    }
    return resolved;
  };

  private guardPhysical = async (path: string): Promise<void> => {
    if (!this.allowedDir) return;
    const root = await realpath(this.allowedDir);
    const parent = await realpath(dirname(path));
    const rel = relative(root, parent);
    if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) {
      throw new Error("Access denied: path outside allowed directory");
    }
  };

  read = async (path: string) => {
    try {
      await this.guardPhysical(path);
      if ((await lstat(path)).isSymbolicLink()) throw new Error("Access denied: symbolic link");
      return { content: await readFile(path, "utf8") };
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  };

  write = async (path: string, content: string): Promise<void> => {
    try {
      await this.guardPhysical(path);
      if ((await lstat(path)).isSymbolicLink()) throw new Error("Access denied: symbolic link");
    } catch (error) {
      if (!missing(error)) throw error;
    }
    await writeFile(path, content, "utf8");
  };

  list = async (path: string) => {
    try {
      await this.guardPhysical(`${path}/entry`);
      if ((await lstat(path)).isSymbolicLink()) throw new Error("Access denied: symbolic link");
      const entries = await readdir(path, { withFileTypes: true });
      return await Promise.all(entries.map(async (entry) => ({
        name: entry.name, directory: entry.isDirectory(), bytes: (await lstat(resolve(path, entry.name))).size,
      })));
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  };
}
