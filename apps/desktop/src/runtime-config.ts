import { app } from "electron";
import { DesktopBundleService } from "./launcher/services/bundle.service";
import { DesktopBundleLayoutStore } from "./launcher/stores/bundle-layout.store";
import { DesktopLauncherStateStore } from "./launcher/stores/launcher-state.store";

export type RuntimeCommand = {
  scriptPath: string;
  source: "bundle" | "environment-override";
  bundleVersion?: string;
  bundleDirectory?: string;
};

export class RuntimeConfigResolver {
  resolveCommand = (): RuntimeCommand => {
    const envScript = process.env.NEXTCLAW_DESKTOP_RUNTIME_SCRIPT?.trim();
    if (envScript) {
      return {
        scriptPath: envScript,
        source: "environment-override"
      };
    }

    const bundleRuntime = this.resolveBundleRuntime();
    if (bundleRuntime) {
      return bundleRuntime;
    }

    throw new Error(
      [
        "Unable to locate nextclaw runtime script.",
        "Provide a current desktop bundle or set NEXTCLAW_DESKTOP_RUNTIME_SCRIPT."
      ].join(" ")
    );
  };

  private resolveBundleRuntime = (): RuntimeCommand | null => {
    const layout = new DesktopBundleLayoutStore();
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    const bundleManager = new DesktopBundleService({
      layout,
      stateStore,
      launcherVersion: app.getVersion()
    });
    const resolvedBundle = bundleManager.resolveCurrentBundle();
    if (!resolvedBundle) {
      return null;
    }
    return {
      scriptPath: resolvedBundle.runtimeScriptPath,
      source: "bundle",
      bundleVersion: resolvedBundle.manifest.bundleVersion,
      bundleDirectory: resolvedBundle.bundleDirectory
    };
  };
}
