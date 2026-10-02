import type { BiboFile, BiboFileDetail, BiboOverview } from "@nextclaw/bibo-client";
import { createSystemObjectReferenceUri } from "@nextclaw/shared";
import { BiboSpaceError, type BiboSpaceService } from "@/features/bibo-domain";
import type { BiboWorkspaceStore } from "@/app/stores/bibo-workspace.store";
import type { WorkspaceEntry } from "@nextclaw/kernel";

const ROOT = "/data/workspace";
const EDITOR_BYTES = 1024 * 1024;
const PREVIEW_BYTES = 64 * 1024;
const validKinds = new Set<BiboFile["kind"]>(["folder", "note", "document", "artifact"]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BiboSpaceError("请求格式不正确。", 400);
  return value as Record<string, unknown>;
}

/** Bibo's file page and object actions are views over the same R2 keys mounted by Sandbox. */
export class BiboWorkspaceFileService {
  constructor(readonly workspace: BiboWorkspaceStore) {}

  private path = (value: unknown): string => {
    if (typeof value !== "string") throw new BiboSpaceError("文件路径不正确。", 400);
    try {
      const path = this.workspace.resolve(value);
      if (path === ROOT) throw new Error("Root is not a file");
      return path;
    } catch { throw new BiboSpaceError("文件路径不正确。", 400); }
  };

  private file = (entry: WorkspaceEntry): BiboFile => {
    const path = entry.path.slice(ROOT.length + 1);
    const declared = entry.attributes?.biboKind;
    const kind = entry.kind === "directory" ? "folder"
      : validKinds.has(declared as BiboFile["kind"]) && declared !== "folder"
        ? declared as BiboFile["kind"] : path.toLowerCase().endsWith(".md") ? "note" : "artifact";
    const time = entry.updatedAt ?? new Date(0).toISOString();
    return { id: path, path, kind, createdAt: entry.attributes?.biboCreatedAt ?? time,
      updatedAt: time, version: entry.version };
  };

  private detail = async (entry: WorkspaceEntry): Promise<BiboFileDetail> => {
    const file = this.file(entry);
    if (entry.kind === "directory") return { ...file, content: null,
      uri: createSystemObjectReferenceUri("file", file.id) };
    const read = await this.workspace.read(entry.path, { offset: 0,
      length: Math.min(entry.bytes, entry.bytes > EDITOR_BYTES ? PREVIEW_BYTES : EDITOR_BYTES) });
    if (!read) throw new BiboSpaceError("文件不存在或已删除。", 404);
    const bytes = new Uint8Array(await new Response(read.body).arrayBuffer());
    const truncated = read.entry.bytes > bytes.byteLength;
    let content: string | null;
    try { content = bytes.includes(0) ? null : new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: truncated }); }
    catch { content = null; }
    return { ...this.file(read.entry), content,
      uri: createSystemObjectReferenceUri("file", file.id),
      ...(truncated || content === null ? { preview: { totalBytes: read.entry.bytes,
        readBytes: bytes.byteLength, truncated, binary: content === null } } : {}) };
  };

  download = async (path: string | null): Promise<Response> => {
    const read = await this.workspace.read(this.path(path));
    if (!read) throw new BiboSpaceError("文件不存在或已删除。", 404);
    const name = encodeURIComponent(read.entry.path.split("/").at(-1)!).replace(/[!'()*]/g,
      (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(read.body, { headers: {
      "content-type": "application/octet-stream", "content-length": String(read.entry.bytes),
      "content-disposition": `attachment; filename*=UTF-8''${name}`,
      "cache-control": "private, no-store", "x-content-type-options": "nosniff",
    } });
  };

  private get = async (value: unknown): Promise<WorkspaceEntry> => {
    const path = this.path(value);
    const entry = await this.workspace.stat(path);
    if (!entry) throw new BiboSpaceError("文件不存在或已删除。", 404);
    return entry;
  };

  private expected = (entry: WorkspaceEntry, value: unknown): void => {
    if (typeof value !== "string" && typeof value !== "number") throw new BiboSpaceError("请提供对象版本。", 400);
    if (String(value) !== entry.version) throw new BiboSpaceError("内容已有更新，请重新加载后再保存。", 409);
  };

  private ancestors = (path: string): string[] => {
    const parts = path.split("/");
    return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join("/"));
  };

  /** R2 listing is authoritative, including files written from a mounted OS. */
  private collect = async (root = ROOT): Promise<BiboFile[]> => {
    const files = new Map<string, BiboFile>();
    let cursor = "";
    do {
      const page = await this.workspace.listDescendants(cursor);
      for (const entry of page.entries) {
        if (!entry.path.startsWith(`${root}/`)) continue;
        if (entry.version !== "implicit" || !files.has(entry.path)) files.set(entry.path, this.file(entry));
      }
      cursor = page.nextCursor ?? "";
    } while (cursor);
    return [...files.values()];
  };

  private list = async (input: Record<string, unknown>): Promise<unknown> => {
    const kind = input.kind;
    if (kind !== undefined && !validKinds.has(kind as BiboFile["kind"])) throw new BiboSpaceError("文件类型不正确。", 400);
    if (input.sort !== undefined && input.sort !== "recent") throw new BiboSpaceError("文件排序方式不正确。", 400);
    const limit = typeof input.limit === "number" && Number.isInteger(input.limit)
      ? Math.min(100, Math.max(1, input.limit)) : 50;
    if (input.parentPath !== undefined) {
      if (typeof input.parentPath !== "string" || ["kind", "query", "ancestorOf", "sort"].some(key => input[key] !== undefined)
        || input.cursor !== undefined && typeof input.cursor !== "string") throw new BiboSpaceError("目录读取条件不正确。", 400);
      const path = input.parentPath === "" ? ROOT : this.path(input.parentPath);
      const page = await this.workspace.list(path, input.cursor as string | undefined, limit);
      if (!page) throw new BiboSpaceError("文件夹不存在或已删除。", 404);
      return { items: page.entries.map(this.file), nextCursor: page.nextCursor };
    }
    const offset = input.cursor === undefined ? 0 : Number(input.cursor);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new BiboSpaceError("分页位置不正确。", 400);
    let items: BiboFile[];
    if (typeof input.ancestorOf === "string") {
      const candidates = [...this.ancestors(input.ancestorOf)];
      items = (await Promise.all(candidates.map(async (path) => this.workspace.stat(path))))
        .filter((entry): entry is WorkspaceEntry => entry?.kind === "directory").map((entry) => this.file(entry));
    } else items = await this.collect();
    if (kind) items = items.filter((file) => file.kind === kind);
    if (input.query !== undefined) items = items.filter((file) =>
      file.path.toLocaleLowerCase().includes(String(input.query).toLocaleLowerCase()));
    items.sort((left, right) => input.sort === "recent"
      ? right.updatedAt.localeCompare(left.updatedAt) || left.path.localeCompare(right.path, "zh-CN")
      : left.path.localeCompare(right.path, "zh-CN"));
    return { items: items.slice(offset, offset + limit),
      nextCursor: offset + limit < items.length ? String(offset + limit) : null };
  };

  execute = async (action: string, raw: unknown): Promise<unknown> => {
    const input = record(raw);
    if (action === "file.list") return this.list(input);
    if (action === "file.get") {
      const entry = await this.get(input.path ?? input.id);
      return this.detail(entry);
    }
    if (action === "file.create") {
      const path = this.path(input.path);
      const kind = input.kind as BiboFile["kind"];
      if (!validKinds.has(kind)) throw new BiboSpaceError("文件类型不正确。", 400);
      if (await this.workspace.stat(path)) throw new BiboSpaceError("该位置已有同名项目。", 409);
      const content = input.content ?? "";
      if (kind !== "folder" && typeof content !== "string") throw new BiboSpaceError("请提供文件内容。", 400);
      const body = new Blob([content as string]);
      const entry = kind === "folder" ? await this.workspace.mkdir(path)
        : await this.workspace.write(path, body.stream(), {
          byteLength: body.size,
          mediaType: "text/plain; charset=utf-8",
          attributes: { biboKind: kind, biboCreatedAt: new Date().toISOString() },
        });
      return this.detail(entry);
    }
    const entry = await this.get(input.id);
    this.expected(entry, input.version);
    if (action === "file.update") {
      if (entry.kind !== "file" || typeof input.content !== "string") throw new BiboSpaceError("请提供文件内容。", 400);
      const body = new Blob([input.content]);
      const next = await this.workspace.write(entry.path, body.stream(),
        { expectedVersion: entry.version, byteLength: body.size,
          mediaType: entry.mediaType ?? "text/plain; charset=utf-8" });
      return this.detail(next);
    }
    if (action === "file.move") {
      const next = await this.workspace.move(entry.path, this.path(input.path), entry.version);
      return this.detail(next);
    }
    if (action === "file.delete") {
      const removed = entry.kind === "directory" ? [this.file(entry), ...await this.collect(entry.path)]
        : [this.file(entry)];
      await this.workspace.remove(entry.path, entry.version);
      return { deleted: removed.map((file) => file.id) };
    }
    throw new BiboSpaceError("未知操作。可先查询 help。", 400);
  };

  executeSpace = async (space: BiboSpaceService, action: string, input: unknown,
    actor?: { kind: "user" | "agent"; sessionId?: string }): Promise<unknown> => {
    if (action.startsWith("file.")) return this.execute(action, input);
    const result = await space.execute(action, input, actor);
    if (action !== "overview.get") return result;
    const overview = result as BiboOverview;
    const notes = await this.execute("file.list", { kind: "note", sort: "recent", limit: 3 }) as { items: BiboFile[] };
    return { ...overview, notes: notes.items };
  };
}
