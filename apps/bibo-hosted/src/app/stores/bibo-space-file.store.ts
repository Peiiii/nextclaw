import type { BiboFile } from "@nextclaw/bibo-client";
import { BiboSpaceError, type BiboFileStorage } from "@/features/bibo-domain";

const fileKey = (id: string) => `spaceFile:${id}`;
const MAX_FILE_BYTES = 1024 * 1024;

/** Stages file changes until the matching space state commits in the same DO transaction. */
export class BiboSpaceFileStore implements BiboFileStorage {
  private readonly changes = new Map<string, string | null>();

  constructor(private readonly storage: DurableObjectStorage) {}

  read = async (file: BiboFile): Promise<string> => {
    const key = fileKey(file.id);
    const content = this.changes.has(key) ? this.changes.get(key) : await this.storage.get<string>(key);
    if (typeof content !== "string") throw new BiboSpaceError("文件不存在。", 404);
    return content;
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

  pending = (): ReadonlyMap<string, string | null> => this.changes;
  rollback = (): void => { this.changes.clear(); };

  private stage(file: BiboFile, content: string): void {
    if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) throw new BiboSpaceError("单个文本文件最多 1 MiB。", 413);
    this.changes.set(fileKey(file.id), content);
  }
}
