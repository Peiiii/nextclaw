import { BiboSpaceService } from "@/features/bibo-domain";
import type { BiboSpaceStateStore } from "@/app/bibo-space-state.service";
import type { BiboWorkspaceFileService } from "./bibo-workspace-file.service";

/** One durable domain owner for UI and Agent actions; model waits hold no domain lock. */
export class BiboSpaceActionService {
  private readonly space: BiboSpaceService;

  constructor(storage: DurableObjectStorage, stateStore: BiboSpaceStateStore,
    private readonly workspaceFiles: Pick<BiboWorkspaceFileService, "executeSpace">) {
    const files = stateStore.createFileStore();
    this.space = new BiboSpaceService("/data", {
      load: stateStore.load,
      save: (state) => stateStore.save(state, {}, files),
    }, files, { read: async () => await storage.get<string>("agentDeliveries") ?? null });
  }

  listActions: BiboSpaceService["listActions"] = (...args) => this.space.listActions(...args);
  execute: BiboSpaceService["execute"] = (action, input = {}, actor) =>
    this.workspaceFiles.executeSpace(this.space, action, input, actor);
}
