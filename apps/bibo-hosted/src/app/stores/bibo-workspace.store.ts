import type {
  WorkspaceByteStore, WorkspaceEntry, WorkspaceList, WorkspaceRead, WorkspaceWrite,
} from "@nextclaw/kernel";

const ROOT = "/data/workspace";
const PART_BYTES = 5 * 1024 * 1024;

function invalid(message: string): never { throw new Error(message); }

/** Keep unknown-length uploads bounded; R2 requires a known length for a single put. */
async function upload(objects: R2Bucket, key: string, body: ReadableStream<Uint8Array>,
  mediaType: string, stagingPrefix: string, attributes?: Readonly<Record<string, string>>,
  expectedEtag?: string, byteLength?: number): Promise<R2Object> {
  if (byteLength !== undefined && (!Number.isSafeInteger(byteLength) || byteLength < 0)) {
    invalid("Invalid workspace byte length");
  }
  const onlyIf = expectedEtag ? { etagMatches: expectedEtag } : { etagDoesNotMatch: "*" };
  const putFinal = async (value: Uint8Array | ReadableStream<Uint8Array>): Promise<R2Object> => {
    const result = await objects.put(key, value, {
      httpMetadata: { contentType: mediaType },
      ...(attributes ? { customMetadata: { ...attributes } } : {}),
      onlyIf,
    });
    if (!result) invalid("Workspace file version has changed");
    return result;
  };
  // Cloudflare's fixed-length stream lets R2 do a single conditional put even
  // for large files. Only truly unknown-length streams need multipart staging.
  if (byteLength !== undefined && typeof FixedLengthStream !== "undefined") {
    return await putFinal(body.pipeThrough(new FixedLengthStream(byteLength)));
  }
  const reader = body.getReader();
  let pending: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  let position = 0;
  let ended = false;
  const part = async (): Promise<Uint8Array> => {
    const output = new Uint8Array(PART_BYTES);
    let filled = 0;
    while (filled < PART_BYTES) {
      if (position === pending.byteLength) {
        const next = await reader.read();
        if (next.done) { ended = true; break; }
        pending = next.value;
        position = 0;
        continue;
      }
      const count = Math.min(PART_BYTES - filled, pending.byteLength - position);
      output.set(pending.subarray(position, position + count), filled);
      position += count;
      filled += count;
    }
    return output.subarray(0, filled);
  };
  try {
    const first = await part();
    if (ended) {
      return await putFinal(first);
    }
    // Multipart completion has no conditional-write option. Complete outside the
    // mounted workspace, then atomically publish through a conditional R2 put.
    const stagingKey = `${stagingPrefix}${crypto.randomUUID()}`;
    const multipart = await objects.createMultipartUpload(stagingKey, {
      httpMetadata: { contentType: mediaType },
      ...(attributes ? { customMetadata: { ...attributes } } : {}),
    });
    const parts: R2UploadedPart[] = [];
    try {
      parts.push(await multipart.uploadPart(1, first));
      while (!ended) {
        const next = await part();
        if (next.byteLength) parts.push(await multipart.uploadPart(parts.length + 1, next));
      }
      await multipart.complete(parts);
    } catch (error) {
      await multipart.abort().catch(() => undefined);
      throw error;
    }
    try {
      const staged = await objects.get(stagingKey);
      if (!staged?.body) invalid("Workspace upload staging body is unavailable");
      return await putFinal(staged.body);
    } finally {
      // The final key is already committed (or rejected). Cleanup failure must
      // not turn a successful user write into an ambiguous retry.
      await objects.delete(stagingKey).catch(() => undefined);
    }
  } finally { reader.releaseLock(); }
}

/** R2 path keys are the byte and directory truth shared by Workers and Sandbox mounts. */
export class BiboWorkspaceStore implements WorkspaceByteStore {
  private readonly prefix: string;
  private readonly stagingPrefix: string;

  constructor(private readonly objects: R2Bucket, namespace: string) {
    if (!namespace || namespace.includes("/") || namespace.includes("..")) invalid("Invalid workspace namespace");
    this.prefix = `${namespace}/workspace/`;
    this.stagingPrefix = `staging/${namespace}/`;
  }

  resolve = (path: string): string => {
    if (!path || path.includes("\0") || path.includes("\\")) invalid("Invalid workspace path");
    const candidate = path === ROOT || path === "." ? "" : path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1)
      : path.startsWith("/") ? invalid("Path outside workspace") : path.replace(/^\.\//, "");
    if (!candidate) return ROOT;
    const parts = candidate.split("/");
    if (parts.some((part) => !part || part === "." || part === "..")) invalid("Invalid workspace path");
    return `${ROOT}/${parts.join("/")}`;
  };

  private key = (path: string): string => `${this.prefix}${path.slice(ROOT.length + 1)}`;
  private directoryKey = (path: string): string => path === ROOT ? this.prefix : `${this.key(path)}/`;
  private parent = (path: string): string => path.slice(0, path.lastIndexOf("/")) || ROOT;
  private fileEntry = (path: string, object: R2Object): WorkspaceEntry => ({ path, kind: "file",
    version: object.etag, bytes: object.size, mediaType: object.httpMetadata?.contentType ?? null,
    updatedAt: object.uploaded?.toISOString(), attributes: object.customMetadata });
  private directoryEntry = (path: string, object?: R2Object): WorkspaceEntry => ({ path, kind: "directory",
    version: object?.etag ?? "implicit", bytes: 0, mediaType: null,
    updatedAt: object?.uploaded?.toISOString(), attributes: object?.customMetadata });

  /** This prefix is mounted directly by the official Sandbox R2 mount, without copying files. */
  mountPrefix = async (path: string): Promise<string> => {
    const resolved = this.resolve(path);
    if ((await this.stat(resolved))?.kind !== "directory") invalid("Workspace directory is missing");
    return `/${this.directoryKey(resolved)}`;
  };

  stat = async (path: string): Promise<WorkspaceEntry | null> => {
    const target = this.resolve(path);
    if (target === ROOT) return this.directoryEntry(ROOT);
    const file = await this.objects.head(this.key(target));
    if (file) return this.fileEntry(target, file);
    const marker = await this.objects.head(this.directoryKey(target));
    if (marker) return this.directoryEntry(target, marker);
    const child = await this.objects.list({ prefix: this.directoryKey(target), limit: 1 });
    return child.objects.length || child.delimitedPrefixes.length || child.truncated
      ? this.directoryEntry(target) : null;
  };

  list = async (path: string, cursor = "", limit = 100): Promise<WorkspaceList | null> => {
    const target = this.resolve(path);
    if ((await this.stat(target))?.kind !== "directory") return null;
    const prefix = this.directoryKey(target);
    const bounded = Math.min(100, Math.max(1, Math.floor(limit)));
    let pageCursor = cursor;
    let page: R2Objects;
    do {
      page = await this.objects.list({ prefix, delimiter: "/", limit: bounded,
        include: ["httpMetadata", "customMetadata"],
        ...(pageCursor ? { cursor: pageCursor } : {}) } as R2ListOptions);
      if (page.objects.some((object) => object.key !== prefix) || page.delimitedPrefixes.length || !page.truncated) break;
      pageCursor = page.cursor;
    } while (pageCursor);
    const children = new Map<string, WorkspaceEntry>();
    for (const object of page.objects) {
      const relative = object.key.slice(prefix.length);
      if (!relative) continue;
      const directory = relative.endsWith("/");
      const child = `${target}/${directory ? relative.slice(0, -1) : relative}`;
      children.set(child, directory ? this.directoryEntry(child, object) : this.fileEntry(child, object));
    }
    for (const group of page.delimitedPrefixes) {
      const relative = group.slice(prefix.length).replace(/\/$/, "");
      if (relative) children.set(`${target}/${relative}`, this.directoryEntry(`${target}/${relative}`));
    }
    return { entries: [...children.values()].sort((left, right) => left.path.localeCompare(right.path)),
      nextCursor: page.truncated ? page.cursor : null };
  };

  read = async (path: string, range?: { offset: number; length?: number }): Promise<WorkspaceRead | null> => {
    const target = this.resolve(path);
    if (target === ROOT) return null;
    if (range && (!Number.isSafeInteger(range.offset) || range.offset < 0 || range.length !== undefined &&
      (!Number.isSafeInteger(range.length) || range.length < 0))) invalid("Invalid byte range");
    const object = range?.length === 0 ? await this.objects.head(this.key(target))
      : await this.objects.get(this.key(target), range ? { range } : undefined);
    if (!object) return null;
    const body: ReadableStream<Uint8Array> | undefined = range?.length === 0
      ? new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } })
      : "body" in object ? object.body as ReadableStream<Uint8Array> : undefined;
    if (!body) invalid("Workspace file body is unavailable");
    return { entry: this.fileEntry(target, object), body };
  };

  write = async (path: string, body: ReadableStream<Uint8Array>, options: WorkspaceWrite = {}): Promise<WorkspaceEntry> => {
    const target = this.resolve(path);
    if (target === ROOT) invalid("Cannot replace workspace root");
    if ((await this.stat(this.parent(target)))?.kind !== "directory") invalid("Workspace parent directory is missing");
    const previous = await this.stat(target);
    if (previous?.kind === "directory") invalid("Target is a directory");
    if (options.expectedVersion !== undefined && previous?.version !== options.expectedVersion) {
      invalid("Workspace file version has changed");
    }
    const uploaded = await upload(this.objects, this.key(target), body,
      options.mediaType ?? "application/octet-stream", this.stagingPrefix,
      options.attributes ?? previous?.attributes,
      previous?.version, options.byteLength);
    return this.fileEntry(target, uploaded);
  };

  mkdir = async (path: string): Promise<WorkspaceEntry> => {
    const target = this.resolve(path);
    if (target === ROOT) return this.directoryEntry(ROOT);
    if ((await this.stat(this.parent(target)))?.kind !== "directory") invalid("Workspace parent directory is missing");
    if (await this.stat(target)) invalid("Workspace path already exists");
    const marker = await this.objects.put(this.directoryKey(target), new Uint8Array(0));
    if (!marker) invalid("Workspace directory creation failed");
    return this.directoryEntry(target, marker);
  };

  private keysUnder = async (prefix: string): Promise<string[]> => {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.objects.list({ prefix, ...(cursor ? { cursor } : {}) });
      keys.push(...page.objects.map((object) => object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return keys;
  };

  move = async (path: string, destination: string, expectedVersion?: string): Promise<WorkspaceEntry> => {
    const source = this.resolve(path);
    const target = this.resolve(destination);
    if (source === ROOT || target === ROOT || target.startsWith(`${source}/`)) invalid("Invalid workspace move");
    const original = await this.stat(source);
    if (!original) invalid("Workspace source is missing");
    if (expectedVersion !== undefined && original.version !== expectedVersion) invalid("Workspace file version has changed");
    if (await this.stat(target)) invalid("Destination already exists");
    if ((await this.stat(this.parent(target)))?.kind !== "directory") invalid("Workspace parent directory is missing");
    const sourceKey = original.kind === "directory" ? this.directoryKey(source) : this.key(source);
    const targetKey = original.kind === "directory" ? this.directoryKey(target) : this.key(target);
    const keys = original.kind === "directory" ? await this.keysUnder(sourceKey) : [sourceKey];
    const copied: string[] = [];
    try {
      for (const key of keys) {
        const object = await this.objects.get(key);
        if (!object || !("body" in object)) invalid("Workspace source changed during move");
        const nextKey = `${targetKey}${key.slice(sourceKey.length)}`;
        await upload(this.objects, nextKey, object.body,
          object.httpMetadata?.contentType ?? "application/octet-stream", this.stagingPrefix,
          object.customMetadata, undefined, object.size);
        copied.push(nextKey);
      }
    } catch (error) {
      for (let offset = 0; offset < copied.length; offset += 1_000) {
        await this.objects.delete(copied.slice(offset, offset + 1_000));
      }
      throw error;
    }
    for (let offset = 0; offset < keys.length; offset += 1_000) {
      await this.objects.delete(keys.slice(offset, offset + 1_000));
    }
    return (await this.stat(target))!;
  };

  remove = async (path: string, expectedVersion?: string): Promise<void> => {
    const target = this.resolve(path);
    if (target === ROOT) invalid("Cannot remove workspace root");
    const original = await this.stat(target);
    if (!original) invalid("Workspace path is missing");
    if (expectedVersion !== undefined && original.version !== expectedVersion) invalid("Workspace file version has changed");
    const keys = original.kind === "directory" ? await this.keysUnder(this.directoryKey(target)) : [this.key(target)];
    for (let offset = 0; offset < keys.length; offset += 1_000) {
      await this.objects.delete(keys.slice(offset, offset + 1_000));
    }
  };
}
