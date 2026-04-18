export type HostAutostartScope = "user" | "system";

export type HostAutostartOwner =
  | "systemd-user-service"
  | "systemd-system-service";

export type HostAutostartStatus = {
  supported: boolean;
  installed: boolean;
  enabled: boolean | null;
  active: boolean | null;
  scope: HostAutostartScope | null;
  hostOwner: HostAutostartOwner | null;
  resourceName: string | null;
  unitPath: string | null;
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
  scope: HostAutostartScope;
  unitPath: string;
  resourceName: string;
  homeDir: string;
  command: string;
  logHint: string;
  actions: string[];
  reasonIfUnavailable: string | null;
};

export type HostAutostartUninstallResult = {
  ok: boolean;
  dryRun: boolean;
  scope: HostAutostartScope;
  unitPath: string;
  resourceName: string;
  removed: boolean;
  logHint: string;
  actions: string[];
  reasonIfUnavailable: string | null;
};

export type SystemdScopeFlags = {
  user?: boolean;
  system?: boolean;
};
