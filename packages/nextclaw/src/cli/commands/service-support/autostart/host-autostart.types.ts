export type HostAutostartScope = "user" | "system";

export type HostAutostartOwner =
  | "systemd-user-service"
  | "systemd-system-service"
  | "launchd-launch-agent"
  | "windows-logon-task";

export type HostAutostartRunCommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type HostAutostartRunCommand = (
  command: string,
  args: string[],
) => Promise<HostAutostartRunCommandResult>;

export type HostAutostartStatus = {
  supported: boolean;
  installed: boolean;
  enabled: boolean | null;
  active: boolean | null;
  scope: HostAutostartScope | null;
  hostOwner: HostAutostartOwner | null;
  resourceName: string | null;
  resourcePath: string | null;
  homeDir: string | null;
  command: string | null;
  logHint: string | null;
  reasonIfUnavailable: string | null;
};

export type HostAutostartCheck = {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export type HostAutostartDoctorReport = {
  status: HostAutostartStatus;
  checks: HostAutostartCheck[];
  exitCode: number;
};

export type HostAutostartInstallResult = {
  ok: boolean;
  dryRun: boolean;
  scope: HostAutostartScope | null;
  hostOwner: HostAutostartOwner | null;
  resourceName: string | null;
  resourcePath: string | null;
  homeDir: string | null;
  command: string | null;
  logHint: string | null;
  actions: string[];
  reasonIfUnavailable: string | null;
};

export type HostAutostartUninstallResult = {
  ok: boolean;
  dryRun: boolean;
  scope: HostAutostartScope | null;
  hostOwner: HostAutostartOwner | null;
  resourceName: string | null;
  resourcePath: string | null;
  removed: boolean;
  logHint: string | null;
  actions: string[];
  reasonIfUnavailable: string | null;
};

export type SystemdScopeFlags = {
  user?: boolean;
  system?: boolean;
};
