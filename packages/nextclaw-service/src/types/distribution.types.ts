export type NextclawDistribution = {
  version: string;
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
