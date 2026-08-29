import type { NextclawDistribution } from "@nextclaw-service/types/distribution.types.js";

const RUNTIME_BOOTSTRAP_ENV_KEYS = [
  "NEXTCLAW_RUNTIME_BUNDLE_CHILD",
  "NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER",
  "NEXTCLAW_NPM_LAUNCHER_VERSION",
  "NEXTCLAW_NPM_LAUNCHER_ENTRYPOINT",
] as const;

const PRODUCT_ANALYTICS_ENVIRONMENT_KEY = "NEXTCLAW_PRODUCT_ANALYTICS_ENVIRONMENT";
const PRODUCT_ANALYTICS_RELEASE_CHANNEL_KEY = "NEXTCLAW_PRODUCT_ANALYTICS_RELEASE_CHANNEL";

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
    const productEnvironment = resolveProductEnvironment(
      env[PRODUCT_ANALYTICS_ENVIRONMENT_KEY],
      launchedByLauncher,
      distribution.productEnvironment,
    );
    const releaseChannel = resolveReleaseChannel({
      explicitChannel: env[PRODUCT_ANALYTICS_RELEASE_CHANNEL_KEY]
        ?? env.NEXTCLAW_DESKTOP_UPDATE_CHANNEL
        ?? env.NEXTCLAW_UPDATE_CHANNEL,
      productEnvironment,
      version: distribution.version,
    });

    for (const key of RUNTIME_BOOTSTRAP_ENV_KEYS) {
      delete env[key];
    }

    NextclawDistributionService.configure({
      ...distribution,
      launcherVersion,
      launcherEntrypoint,
      launchedByLauncher,
      productEnvironment,
      releaseChannel,
    });
  }

  static get(): NextclawDistribution {
    if (!NextclawDistributionService.currentDistribution) {
      throw new Error("NextClaw distribution is not configured.");
    }
    return NextclawDistributionService.currentDistribution;
  }
}

function resolveProductEnvironment(
  explicitEnvironment: string | undefined,
  launchedByLauncher: boolean,
  fallback: NextclawDistribution["productEnvironment"],
): NextclawDistribution["productEnvironment"] {
  const normalized = explicitEnvironment?.trim().toLowerCase();
  if (normalized === "production" || normalized === "development" || normalized === "test") {
    return normalized;
  }
  return launchedByLauncher ? "production" : fallback;
}

function resolveReleaseChannel(params: {
  explicitChannel: string | undefined;
  productEnvironment: NextclawDistribution["productEnvironment"];
  version: string;
}): NextclawDistribution["releaseChannel"] {
  const { explicitChannel, productEnvironment, version } = params;
  const normalized = explicitChannel?.trim().toLowerCase();
  if (normalized === "stable" || normalized === "beta" || normalized === "nightly") {
    return normalized;
  }
  if (productEnvironment !== "production") return "development";
  if (/(?:^|[.-])nightly(?:[.-]|$)/i.test(version)) return "nightly";
  if (/(?:^|[.-])beta(?:[.-]|$)/i.test(version)) return "beta";
  return "stable";
}
