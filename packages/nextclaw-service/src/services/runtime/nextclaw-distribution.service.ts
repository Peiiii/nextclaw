import type { NextclawDistribution } from "@nextclaw-service/types/distribution.types.js";

const RUNTIME_BOOTSTRAP_ENV_KEYS = [
  "NEXTCLAW_RUNTIME_BUNDLE_CHILD",
  "NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER",
  "NEXTCLAW_NPM_LAUNCHER_VERSION",
  "NEXTCLAW_NPM_LAUNCHER_ENTRYPOINT",
] as const;

export class NextclawDistributionService {
  private static currentDistribution: NextclawDistribution | null = null;

  static configure(distribution: NextclawDistribution): void {
    NextclawDistributionService.currentDistribution = distribution;
  }

  static configureRuntime(
    distribution: NextclawDistribution,
    env: NodeJS.ProcessEnv = process.env,
  ): void {
    const launchedByLauncher = env.NEXTCLAW_RUNTIME_BUNDLE_CHILD === "1";
    const launcherVersion = launchedByLauncher
      ? env.NEXTCLAW_NPM_LAUNCHER_VERSION?.trim() || distribution.launcherVersion
      : distribution.launcherVersion;
    const launcherEntrypoint = launchedByLauncher
      ? env.NEXTCLAW_NPM_LAUNCHER_ENTRYPOINT?.trim() || distribution.launcherEntrypoint
      : distribution.launcherEntrypoint;

    for (const key of RUNTIME_BOOTSTRAP_ENV_KEYS) {
      delete env[key];
    }

    NextclawDistributionService.configure({
      ...distribution,
      launcherVersion,
      launcherEntrypoint,
      launchedByLauncher,
    });
  }

  static get(): NextclawDistribution {
    if (!NextclawDistributionService.currentDistribution) {
      throw new Error("NextClaw distribution is not configured.");
    }
    return NextclawDistributionService.currentDistribution;
  }
}
