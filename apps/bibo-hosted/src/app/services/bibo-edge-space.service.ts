import { BiboSpaceService, type BiboSpaceState } from "@/features/bibo-domain";
import { json } from "../bibo-auth.utils";
import { BiboSpaceStateStore } from "../bibo-space-state.service";
import { BiboSpaceFileStore } from "../stores/bibo-space-file.store";

/** Run a personal-space action against DO state, committing file bodies and index together. */
export async function executeBiboEdgeSpace(storage: DurableObjectStorage, stateStore: BiboSpaceStateStore,
  action: string, input: unknown): Promise<Response> {
  const files = new BiboSpaceFileStore(storage);
  let changed: BiboSpaceState | undefined;
  const space = new BiboSpaceService("/data", {
    load: () => stateStore.load(),
    save: async (state) => { changed = structuredClone(state); },
  }, files, { read: async () => await storage.get<string>("agentDeliveries") ?? null });
  try {
    const started = performance.now();
    const result = await space.execute(action, input);
    if (changed) await stateStore.save(changed, {}, files);
    return json({ result }, 200, { "server-timing": `space;dur=${(performance.now() - started).toFixed(1)}` });
  } finally { files.rollback(); }
}
