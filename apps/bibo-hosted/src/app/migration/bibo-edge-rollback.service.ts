import type { exportBiboEdgeState } from "./bibo-edge-export.service";
import { BiboSpaceStateStore } from "../bibo-space-state.service";
import { BiboSpaceFileStore } from "../stores/bibo-space-file.store";
import { BiboEdgeSessionStore } from "../stores/bibo-edge-session.store";

type EdgeExport = Awaited<ReturnType<typeof exportBiboEdgeState>>;

/** Freeze the complete edge owner state before a rare reverse migration to the Node host. */
export class BiboEdgeRollbackService {
  constructor(private readonly storage: DurableObjectStorage) {}

  read = async (): Promise<EdgeExport> => {
    if (await this.storage.get<string>("conversationMode") !== "edge") throw new Error("Bibo user is not in edge mode");
    const spaceState = await new BiboSpaceStateStore(this.storage).load() ?? {
      schema: 1 as const, projects: [], tasks: [], events: [], inbox: [], files: [], deliveryStatuses: {}, replays: {},
    };
    const indexes = await this.storage.list({ prefix: "ncpSession:" });
    const sessions: EdgeExport["sessions"] = [];
    const store = new BiboEdgeSessionStore(this.storage);
    for (const key of indexes.keys()) {
      const sessionId = key.slice("ncpSession:".length);
      const record = await store.load(sessionId);
      if (!record) throw new Error(`Bibo edge session ${sessionId} is missing`);
      const first = record.messages[0]?.timestamp ?? new Date().toISOString();
      const last = record.messages.at(-1)?.timestamp ?? first;
      sessions.push({ sessionId, record: { sessionId, messages: record.messages, metadata: record.metadata,
        createdAt: first, updatedAt: last } });
    }
    const files = new BiboSpaceFileStore(this.storage);
    const contents = await Promise.all(spaceState.files.filter((file) => file.kind !== "folder").map(async (file) => ({
      id: file.id, content: await files.read(file),
    })));
    const index = await this.storage.get<string[]>("edgeWorkspaceIndex") ?? [];
    const workspaceTexts: Record<string, string> = {};
    for (const path of index) {
      const content = await this.storage.get<string>(`edgeWorkspace:${path}`);
      if (typeof content !== "string") throw new Error(`Bibo edge workspace ${path} is missing`);
      workspaceTexts[path] = content;
    }
    return { schema: 1, sessions, spaceState, files: contents, workspaceTexts,
      deliveries: await this.storage.get<string>("agentDeliveries") ?? null };
  };
}
