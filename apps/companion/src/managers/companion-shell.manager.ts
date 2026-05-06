import { useCompanionShellStore, type CompanionShellSnapshot } from "../stores/companion-shell.store.js";

export class CompanionShellManager {
  readonly bootstrap = async (): Promise<CompanionShellSnapshot> => {
    const bootstrap = await window.nextclawCompanion.getBootstrap();
    const snapshot: CompanionShellSnapshot = {
      baseUrl: bootstrap.baseUrl,
      bootstrapped: true
    };
    useCompanionShellStore.getState().setSnapshot(snapshot);
    return snapshot;
  };

  readonly open = async (): Promise<void> => {
    await window.nextclawCompanion.open();
  };

  readonly quit = async (): Promise<void> => {
    await window.nextclawCompanion.quit();
  };
}
