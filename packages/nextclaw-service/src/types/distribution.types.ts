export type NextclawDistribution = {
  version: string;
  productEnvironment: "production" | "development" | "test";
  releaseChannel: "stable" | "beta" | "nightly" | "development";
  appEntrypoint: string;
  launcherVersion: string;
  launcherEntrypoint: string;
  launchedByLauncher: boolean;
  templatesDir: string;
  uiDistDir: string;
  runtimeUpdatePublicKeyPath: string;
  builtInAppsDirectory?: string;
  portableServiceRunnerPath?: string;
};
