import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import type { PanelAppStateStore } from "@kernel/stores/panel-app-state.store.js";
import type { PanelAppSource } from "@kernel/utils/panel-app-source.utils.js";

export class PanelAppRemovalService {
  constructor(private readonly params: {
    capabilityGrantManager: CapabilityGrantManager;
    suspendBridgeSessions: (appId: string) => () => void;
  }) {}

  remove = async (params: {
    appId: string;
    panelAppId: string;
    source: PanelAppSource;
    stateStore: PanelAppStateStore;
  }): Promise<void> => {
    const { appId, panelAppId, source, stateStore } = params;
    const originalState = await stateStore.load();
    const originalGrants = await this.params.capabilityGrantManager.list({
      subject: { type: "panel-app", id: appId },
    });
    const stagedPath = join(
      dirname(source.sourcePath),
      `.deleting-${source.sourceName}-${randomUUID()}`,
    );
    await rename(source.sourcePath, stagedPath);
    const restoreBridgeSessions = this.params.suspendBridgeSessions(appId);
    try {
      await stateStore.deleteEntry(panelAppId, appId);
      await this.params.capabilityGrantManager.revoke({
        subject: { type: "panel-app", id: appId },
      });
      await rm(stagedPath, {
        force: true,
        recursive: source.kind === "folder",
      });
    } catch (error) {
      const recoveryErrors = await this.restore({
        originalGrants,
        originalState,
        restoreBridgeSessions,
        sourcePath: source.sourcePath,
        stagedPath,
        stateStore,
      });
      if (recoveryErrors.length > 0) {
        throw new AggregateError(
          [error, ...recoveryErrors],
          `Panel App ${appId} 删除失败，且恢复未完整完成。`,
        );
      }
      throw error;
    }
  };

  private restore = async (params: {
    originalGrants: Awaited<ReturnType<CapabilityGrantManager["list"]>>;
    originalState: Awaited<ReturnType<PanelAppStateStore["load"]>>;
    restoreBridgeSessions: () => void;
    sourcePath: string;
    stagedPath: string;
    stateStore: PanelAppStateStore;
  }): Promise<unknown[]> => {
    const errors: unknown[] = [];
    for (const operation of [
      async () => await this.params.capabilityGrantManager.import(params.originalGrants),
      async () => await params.stateStore.replace(params.originalState),
      async () => params.restoreBridgeSessions(),
      async () => await rename(params.stagedPath, params.sourcePath),
    ]) {
      try {
        await operation();
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  };
}
