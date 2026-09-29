import type { BiboSpaceState } from "@/features/bibo-domain";
import { json } from "../bibo-auth.utils";
import { BiboEdgeMigrationService } from "./bibo-edge-migration.service";
import { BiboEdgeRollbackService } from "./bibo-edge-rollback.service";
import type { exportBiboEdgeState } from "./bibo-edge-export.service";
import type { BiboSession } from "../utils/bibo-session.utils";

type Bridge = {
  storage: DurableObjectStorage;
  snapshots: R2Bucket;
  id: string;
  containerFetch: (url: string, init?: RequestInit) => Promise<Response>;
  syncSpace: (state: BiboSpaceState) => Promise<void>;
  exportSpace: () => Promise<BiboSpaceState>;
  commitSnapshot: (metadata: Record<string, unknown>) => Promise<Response | null>;
};

export class BiboEdgeOwnerController {
  constructor(private readonly bridge: Bridge) {}

  status = async (): Promise<Response> => {
    const { storage, snapshots, id } = this.bridge;
    const mode = await storage.get<string>("conversationMode") ?? "uninitialized";
    const sessions = await storage.get<BiboSession[]>("sessions") ?? [];
    const messageCount = sessions.reduce((count, session) => count + session.messages.length, 0);
    const snapshotKey = await storage.get<string>("snapshotKey");
    const hasSnapshot = Boolean(snapshotKey || await snapshots.head(id));
    return json({ mode, sessionCount: sessions.length, messageCount, hasSnapshot,
      containerStartCount: await storage.get<number>("containerStartCount") ?? 0,
      edgeRunCount: await storage.get<number>("edgeRunCount") ?? 0,
      hasLegacyData: messageCount > 0 || hasSnapshot });
  };

  migrate = async (): Promise<Response> => {
    const { storage, exportSpace, syncSpace, containerFetch } = this.bridge;
    const sessions = await storage.get<BiboSession[]>("sessions") ?? [];
    await syncSpace(await exportSpace());
    const response = await containerFetch("http://localhost/edge/export", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionIds: sessions.map((session) => session.id) }),
    });
    if (!response.ok) throw new Error(`Bibo legacy export failed: ${response.status}`);
    const source = await response.json() as Awaited<ReturnType<typeof exportBiboEdgeState>>;
    const evidence = await new BiboEdgeMigrationService(storage).migrate(source, sessions);
    return json({ ok: true, evidence });
  };

  rollback = async (): Promise<Response> => {
    const { storage, containerFetch, commitSnapshot } = this.bridge;
    const source = await new BiboEdgeRollbackService(storage).read();
    const response = await containerFetch("http://localhost/edge/import", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(source),
    });
    await response.arrayBuffer();
    if (!response.ok) throw new Error(`Bibo reverse import failed: ${response.status}`);
    const failed = await commitSnapshot({ conversationMode: "legacy" });
    if (failed) throw new Error(`Bibo reverse snapshot failed: ${failed.status}`);
    return json({ ok: true, sessions: source.sessions.length, files: source.files.length });
  };
}
