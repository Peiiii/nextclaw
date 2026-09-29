/** Host-owned bytes behind one logical workspace. Text tools are views over this store. */
export type WorkspaceEntry = {
  path: string;
  kind: "file" | "directory";
  version: string;
  bytes: number;
  mediaType: string | null;
  updatedAt?: string;
  attributes?: Readonly<Record<string, string>>;
};

export type WorkspaceRead = {
  entry: WorkspaceEntry;
  body: ReadableStream<Uint8Array>;
};

export type WorkspaceWrite = {
  expectedVersion?: string;
  /** Supply a known byte count to let hosts stream directly without staging. */
  byteLength?: number;
  mediaType?: string;
  attributes?: Readonly<Record<string, string>>;
};

export type WorkspaceList = {
  entries: readonly WorkspaceEntry[];
  nextCursor: string | null;
};

export type WorkspaceByteStore = {
  /** Resolve and confine user paths before any physical I/O. */
  resolve(path: string): string;
  stat(path: string): Promise<WorkspaceEntry | null>;
  list(path: string, cursor?: string, limit?: number): Promise<WorkspaceList | null>;
  read(path: string, range?: { offset: number; length?: number }): Promise<WorkspaceRead | null>;
  write(path: string, body: ReadableStream<Uint8Array>, options?: WorkspaceWrite): Promise<WorkspaceEntry>;
  mkdir(path: string): Promise<WorkspaceEntry>;
  move(path: string, destination: string, expectedVersion?: string): Promise<WorkspaceEntry>;
  remove(path: string, expectedVersion?: string): Promise<void>;
};
