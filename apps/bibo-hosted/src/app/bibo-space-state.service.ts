import { BiboSpaceService, BiboSpaceError, type BiboSpaceState } from "@/features/bibo-domain";
import { BiboSpaceFileStore } from "./stores/bibo-space-file.store";
import { applyBiboStorageChanges } from "./utils/bibo-storage.utils";

// Keep each SQLite-backed KV value below 2 MiB, including non-ASCII text.
// JSON can escape one UTF-16 code unit into six bytes (for example, a lone surrogate).
const CHUNK_CHARACTERS = 300_000;
const MAX_STATE_BYTES = 32 * 1024 * 1024;
const chunkKey = (index: number) => `spaceState:${index}`;

export class BiboSpaceStateStore {
  readonly files: BiboSpaceFileStore;

  constructor(private readonly storage: DurableObjectStorage, private readonly objects?: R2Bucket,
    private readonly namespace?: string) {
    this.files = this.createFileStore();
  }

  createFileStore = (): BiboSpaceFileStore => new BiboSpaceFileStore(this.storage, this.objects, this.namespace);

  load = async (): Promise<BiboSpaceState | undefined> => {
    const header = await this.storage.get<{ chunks: number }>("spaceState");
    if (!header) return undefined;
    if (!Number.isInteger(header.chunks) || header.chunks < 1 || header.chunks > 128) throw new BiboSpaceError("个人空间数据不完整。", 500);
    const keys = Array.from({ length: header.chunks }, (_, index) => chunkKey(index));
    const values = await this.storage.get<string>(keys);
    const source = keys.map((key) => {
      const value = values.get(key);
      if (typeof value !== "string") throw new BiboSpaceError("个人空间数据不完整。", 500);
      return value;
    }).join("");
    return BiboSpaceService.parseState(JSON.parse(source));
  };

  save = async (state: BiboSpaceState, metadata: Record<string, unknown> = {}, filesToCommit: BiboSpaceFileStore = this.files,
    deletedKeys: readonly string[] = []): Promise<void> => {
    const source = JSON.stringify(state);
    if (new TextEncoder().encode(source).byteLength > MAX_STATE_BYTES) throw new BiboSpaceError("个人空间结构化数据最多 32 MiB，操作未保存。", 413);
    const chunks = Math.ceil(source.length / CHUNK_CHARACTERS);
    const entries: Record<string, unknown> = { ...metadata, spaceState: { chunks } };
    for (let index = 0; index < chunks; index += 1) entries[chunkKey(index)] = source.slice(index * CHUNK_CHARACTERS, (index + 1) * CHUNK_CHARACTERS);
    const files = [...await filesToCommit.prepare()];
    try {
      await this.storage.transaction(async (transaction) => {
        const previous = await transaction.get<{ chunks: number }>("spaceState");
        const contents = Object.fromEntries(files.filter(([, content]) => content !== null));
        const deleted = files.filter(([, content]) => content === null).map(([key]) => key);
        const obsoleteChunks = previous && previous.chunks > chunks
          ? Array.from({ length: previous.chunks - chunks }, (_, index) => chunkKey(index + chunks)) : [];
        await applyBiboStorageChanges(transaction, { ...entries, ...contents }, [...obsoleteChunks, ...deleted, ...deletedKeys]);
      });
      filesToCommit.rollback();
    } catch (error) {
      await filesToCommit.discardUploads();
      throw error;
    }
  };
}
