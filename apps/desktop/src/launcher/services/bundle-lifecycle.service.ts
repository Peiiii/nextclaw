import type { DesktopBundleLayoutStore } from "../stores/bundle-layout.store";
import type { DesktopLauncherStateStore } from "../stores/launcher-state.store";
import { DesktopBundleService, type ResolvedDesktopBundle } from "./bundle.service";

type DesktopBundleLifecycleServiceOptions = {
  layout: DesktopBundleLayoutStore;
  stateStore: DesktopLauncherStateStore;
  bundleService?: DesktopBundleService;
};

export type DesktopBundleActivationResult = {
  activatedVersion: string;
  previousVersion: string | null;
  bundle: ResolvedDesktopBundle;
};

export type DesktopBundleRollbackResult = {
  rolledBackFrom: string;
  rolledBackTo: string | null;
};

export class DesktopBundleLifecycleService {
  private readonly bundleService: DesktopBundleService;

  constructor(private readonly options: DesktopBundleLifecycleServiceOptions) {
    this.bundleService =
      options.bundleService ??
      new DesktopBundleService({
        layout: options.layout,
        stateStore: options.stateStore
      });
  }

  activateVersion = async (version: string): Promise<DesktopBundleActivationResult> => {
    const bundle = this.bundleService.resolveVersion(version);
    const state = this.options.stateStore.read();
    const previousVersion = state.currentVersion && state.currentVersion !== version ? state.currentVersion : null;

    await this.options.layout.writeCurrentPointer({ version });
    if (previousVersion) {
      await this.options.layout.writePreviousPointer({ version: previousVersion });
    } else {
      await this.options.layout.clearPreviousPointer();
    }

    await this.options.stateStore.write({
      ...state,
      currentVersion: version,
      previousVersion,
      candidateVersion: version,
      candidateLaunchCount: 0,
      downloadedVersion: null,
      downloadedReleaseNotesUrl: null
    });
    await this.bundleService.pruneRetainedArtifacts();

    return {
      activatedVersion: version,
      previousVersion,
      bundle
    };
  };

  recoverPendingCandidate = async (): Promise<DesktopBundleRollbackResult | null> => {
    const state = this.options.stateStore.read();
    if (!state.candidateVersion) {
      return null;
    }
    if (state.currentVersion === state.candidateVersion && state.candidateLaunchCount === 0) {
      await this.options.stateStore.update((currentState) => {
        if (!currentState.candidateVersion) {
          return currentState;
        }
        return {
          ...currentState,
          candidateLaunchCount: currentState.candidateLaunchCount + 1
        };
      });
      return null;
    }

    const candidateVersion = state.candidateVersion;
    const rollbackVersion = this.resolveRollbackVersion(state.previousVersion, state.lastKnownGoodVersion, candidateVersion);
    if (!rollbackVersion) {
      await this.options.layout.clearCurrentPointer();
      await this.options.layout.clearPreviousPointer();
      await this.options.stateStore.write({
        ...state,
        currentVersion: null,
        previousVersion: null,
        candidateVersion: null,
        candidateLaunchCount: 0,
        badVersions: [...new Set([...state.badVersions, candidateVersion])],
        downloadedVersion: null,
        downloadedReleaseNotesUrl: null
      });
      await this.bundleService.removeVersion(candidateVersion);
      await this.bundleService.pruneRetainedArtifacts();
      return {
        rolledBackFrom: candidateVersion,
        rolledBackTo: null
      };
    }

    this.bundleService.resolveVersion(rollbackVersion);
    await this.options.layout.writeCurrentPointer({ version: rollbackVersion });
    await this.options.layout.clearPreviousPointer();
    await this.options.stateStore.write({
      ...state,
      currentVersion: rollbackVersion,
      previousVersion: null,
      candidateVersion: null,
      candidateLaunchCount: 0,
      lastKnownGoodVersion: rollbackVersion,
      badVersions: [...new Set([...state.badVersions, candidateVersion])],
      downloadedVersion: null,
      downloadedReleaseNotesUrl: null
    });
    await this.bundleService.pruneRetainedArtifacts();

    return {
      rolledBackFrom: candidateVersion,
      rolledBackTo: rollbackVersion
    };
  };

  markVersionHealthy = async (version: string): Promise<void> => {
    await this.options.stateStore.update((state) => {
      if (state.currentVersion !== version) {
        throw new Error(`cannot mark ${version} healthy because currentVersion is ${state.currentVersion ?? "null"}`);
      }
      if (state.candidateVersion && state.candidateVersion !== version) {
        throw new Error(
          `cannot mark ${version} healthy because pending candidate is ${state.candidateVersion}`
        );
      }
      return {
        ...state,
        candidateVersion: null,
        candidateLaunchCount: 0,
        lastKnownGoodVersion: version,
        badVersions: state.badVersions.filter((entry) => entry !== version)
      };
    });
    await this.bundleService.pruneRetainedArtifacts();
  };

  private resolveRollbackVersion = (
    previousVersion: string | null,
    lastKnownGoodVersion: string | null,
    candidateVersion: string
  ): string | null => {
    const candidates = [previousVersion, lastKnownGoodVersion];
    for (const version of candidates) {
      if (version && version !== candidateVersion) {
        return version;
      }
    }
    return null;
  };
}
