import { DesktopBundleLifecycleService } from "../launcher/services/bundle-lifecycle.service";
import { DesktopBundleService } from "../launcher/services/bundle.service";
import { DesktopUpdateService } from "../launcher/services/update.service";
import { DesktopBundleLayoutStore } from "../launcher/stores/bundle-layout.store";
import { DesktopLauncherStateStore } from "../launcher/stores/launcher-state.store";

type DesktopBundleServicesFactoryOptions = {
  launcherVersion: string;
  resolveChannel: () => string;
  resolveBundlePublicKey: () => string | undefined;
};

export class DesktopBundleServicesFactory {
  constructor(private readonly options: DesktopBundleServicesFactoryOptions) {}

  createUpdateService = (): DesktopUpdateService => {
    return new DesktopUpdateService({
      layout: new DesktopBundleLayoutStore(),
      resolveChannel: this.options.resolveChannel,
      launcherVersion: this.options.launcherVersion,
      bundlePublicKey: this.options.resolveBundlePublicKey()
    });
  };

  createLauncherStateStore = (): DesktopLauncherStateStore => {
    const layout = new DesktopBundleLayoutStore();
    return new DesktopLauncherStateStore(layout.getLauncherStatePath());
  };

  createBundleService = (): DesktopBundleService => {
    const layout = new DesktopBundleLayoutStore();
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    return new DesktopBundleService({
      layout,
      stateStore,
      launcherVersion: this.options.launcherVersion
    });
  };

  createBundleLifecycle = (): DesktopBundleLifecycleService => {
    const layout = new DesktopBundleLayoutStore();
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    return new DesktopBundleLifecycleService({
      layout,
      stateStore,
      bundleService: new DesktopBundleService({
        layout,
        stateStore,
        launcherVersion: this.options.launcherVersion
      })
    });
  };
}
