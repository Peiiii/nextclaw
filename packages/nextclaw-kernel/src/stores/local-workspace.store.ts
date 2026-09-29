import { createReadStream } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import type { WorkspaceByteStore, WorkspaceEntry, WorkspaceList, WorkspaceRead, WorkspaceWrite } from "./workspace.store.js";

function missing(error: unknown): boolean { return (error as NodeJS.ErrnoException).code === "ENOENT"; }
function conflict(): never { throw new Error("Workspace file version has changed"); }

/** The ordinary Node filesystem remains the local NextClaw host implementation. */
export class LocalWorkspaceStore implements WorkspaceByteStore {
  constructor(private readonly root: string) {}

  resolve = (path: string): string => {
    if (!path || path.includes("\0")) throw new Error("Invalid workspace path");
    const root = resolve(this.root);
    const target = isAbsolute(path) ? resolve(path) : resolve(root, path);
    const inside = relative(root, target);
    if (inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) throw new Error("Path outside workspace");
    return target;
  };

  private physical = async (path: string, createParent = false): Promise<string> => {
    const target = this.resolve(path);
    const root = this.resolve(".");
    await mkdir(root, { recursive: true });
    if (target === root) return root;
    if (createParent) {
      let next = root;
      const segments = relative(root, dirname(target)).split(sep).filter(Boolean);
      for (const segment of segments) {
        next = join(next, segment);
        try {
          const info = await lstat(next);
          if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Invalid workspace directory");
        } catch (error) {
          if (!missing(error)) throw error;
          await mkdir(next);
        }
      }
    }
    const actualRoot = await realpath(root);
    const actualParent = await realpath(dirname(target));
    if (actualParent !== actualRoot && !actualParent.startsWith(`${actualRoot}${sep}`)) {
      throw new Error("Path outside workspace");
    }
    try { if ((await lstat(target)).isSymbolicLink()) throw new Error("Symbolic links are not supported"); }
    catch (error) { if (!missing(error)) throw error; }
    return target;
  };

  private entry = async (path: string): Promise<WorkspaceEntry | null> => {
    try {
      const info = await stat(path, { bigint: true });
      return {
        path, kind: info.isDirectory() ? "directory" : "file",
        version: `${info.dev}:${info.ino}:${info.mtimeNs}:${info.ctimeNs}:${info.size}`,
        bytes: Number(info.size), mediaType: null,
      };
    } catch (error) { if (missing(error)) return null; throw error; }
  };

  stat = async (path: string): Promise<WorkspaceEntry | null> => this.entry(await this.physical(path));

  list = async (path: string, cursor = "", limit = 100): Promise<WorkspaceList | null> => {
    const target = await this.physical(path);
    const root = await this.entry(target);
    if (!root || root.kind !== "directory") return null;
    const names = (await readdir(target)).filter((name) => name > cursor).sort();
    const bounded = Math.min(100, Math.max(1, Math.floor(limit)));
    const selected = names.slice(0, bounded);
    const entries = (await Promise.all(selected.map((name) => this.stat(resolve(target, name)))))
      .filter((entry): entry is WorkspaceEntry => entry !== null);
    return { entries, nextCursor: names.length > bounded ? selected.at(-1) ?? null : null };
  };

  read = async (path: string, range?: { offset: number; length?: number }): Promise<WorkspaceRead | null> => {
    const target = await this.physical(path);
    const entry = await this.entry(target);
    if (!entry || entry.kind !== "file") return null;
    const start = range?.offset ?? 0;
    const length = range?.length;
    if (!Number.isSafeInteger(start) || start < 0 || length !== undefined && (!Number.isSafeInteger(length) || length < 0)) {
      throw new Error("Invalid byte range");
    }
    const body = length === 0 ? new ReadableStream<Uint8Array>({ start: (controller) => controller.close() })
      : Readable.toWeb(createReadStream(target, {
        start, ...(length === undefined ? {} : { end: start + length - 1 }),
      })) as ReadableStream<Uint8Array>;
    return { entry, body };
  };

  write = async (path: string, body: ReadableStream<Uint8Array>, options: WorkspaceWrite = {}): Promise<WorkspaceEntry> => {
    const target = await this.physical(path, true);
    const current = await this.entry(target);
    if (options.expectedVersion !== undefined && current?.version !== options.expectedVersion) conflict();
    if (current?.kind === "directory") throw new Error("Target is a directory");
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try {
      const reader = body.getReader();
      try {
        while (true) {
          const item = await reader.read();
          if (item.done) break;
          let offset = 0;
          while (offset < item.value.byteLength) {
            const result = await handle.write(item.value, offset, item.value.byteLength - offset);
            offset += result.bytesWritten;
          }
        }
      } finally { reader.releaseLock(); }
      await handle.sync();
      await handle.close();
      if (options.expectedVersion !== undefined && (await this.entry(target))?.version !== options.expectedVersion) conflict();
      await rename(temporary, target);
      return (await this.entry(target))!;
    } catch (error) {
      await handle.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  };

  mkdir = async (path: string): Promise<WorkspaceEntry> => {
    const target = await this.physical(path);
    await mkdir(target);
    return (await this.entry(target))!;
  };

  move = async (path: string, destination: string, expectedVersion?: string): Promise<WorkspaceEntry> => {
    const source = await this.physical(path);
    const target = await this.physical(destination);
    const current = await this.entry(source);
    if (!current || expectedVersion !== undefined && current.version !== expectedVersion) conflict();
    if (await this.entry(target)) throw new Error("Destination already exists");
    await rename(source, target);
    return (await this.entry(target))!;
  };

  remove = async (path: string, expectedVersion?: string): Promise<void> => {
    const target = await this.physical(path);
    const current = await this.entry(target);
    if (!current || expectedVersion !== undefined && current.version !== expectedVersion) conflict();
    await rm(target, { recursive: current.kind === "directory" });
  };
}
