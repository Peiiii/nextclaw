import type { BiboFile } from "@nextclaw/bibo-client";
import { BiboSpaceError, type BiboFileStorage } from "@/features/bibo-domain";

const fileKey = (id: string) => `spaceFile:${id}`;
const MAX_FILE_BYTES = 1024 * 1024;
type FileObject = { kind: "r2"; key: string; bytes: number };

/** Stages file changes until the matching space state commits in the same DO transaction. */
export class BiboSpaceFileStore implements BiboFileStorage {
  private readonly changes = new Map<string, string | FileObject | null>();
  private readonly uploaded: string[] = [];

  constructor(private readonly storage: DurableObjectStorage, private readonly objects?: R2Bucket,
    private readonly namespace?: string) {}

  read = async (file: BiboFile): Promise<string> => {
    const key = fileKey(file.id);
    const content = this.changes.has(key) ? this.changes.get(key) : await this.storage.get<string | FileObject>(key);
    if (typeof content === "string") return content;
    if (content === null || content === undefined) throw new BiboSpaceError("文件不存在。", 404);
    const ownFile = content.key.startsWith(`${this.namespace}/files/${file.id}/`);
    const ownMount = content.key.startsWith(`${this.namespace}/mounts/`);
    if (content.kind !== "r2" || !this.objects || !this.namespace || !ownFile && !ownMount) {
      throw new BiboSpaceError("文件内容索引无效。", 500);
    }
    const object = await this.objects.get(content.key);
    if (!object) throw new BiboSpaceError("文件内容暂时无法读取。", 503);
    return object.text();
  };

  create = async (file: BiboFile, content: string | null): Promise<void> => {
    if (content !== null) this.stage(file, content);
  };

  update = async (file: BiboFile, content: string): Promise<void> => {
    await this.read(file);
    this.stage(file, content);
  };

  move = async (): Promise<void> => {
    // Contents are addressed by stable file ID; the state owner changes paths.
  };

  delete = async (_file: BiboFile, removed: readonly BiboFile[]): Promise<void> => {
    for (const item of removed) if (item.kind !== "folder") this.changes.set(fileKey(item.id), null);
  };

  prepare = async (): Promise<ReadonlyMap<string, string | FileObject | null>> => {
    const prepared = new Map<string, string | FileObject | null>();
    try {
      for (const [key, content] of this.changes) {
        if (content === null || typeof content !== "string" || !this.objects || !this.namespace) {
          prepared.set(key, content); continue;
        }
        const id = key.slice(fileKey("").length);
        const objectKey = `${this.namespace}/files/${id}/${crypto.randomUUID()}`;
        await this.objects.put(objectKey, content, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
        this.uploaded.push(objectKey);
        prepared.set(key, { kind: "r2", key: objectKey, bytes: new TextEncoder().encode(content).byteLength });
      }
      return prepared;
    } catch (error) {
      await this.discardUploads();
      throw error;
    }
  };

  discardUploads = async (): Promise<void> => {
    const keys = this.uploaded.splice(0);
    await Promise.allSettled(keys.map((key) => this.objects?.delete(key)));
    this.changes.clear();
  };

  rollback = (): void => { this.changes.clear(); this.uploaded.length = 0; };

  private stage(file: BiboFile, content: string): void {
    if (!this.objects && new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) {
      throw new BiboSpaceError("单个文本文件最多 1 MiB。", 413);
    }
    this.changes.set(fileKey(file.id), content);
  }
}
