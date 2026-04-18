import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import type {
  HostAutostartCheck,
  HostAutostartDoctorReport,
  HostAutostartInstallResult,
  HostAutostartOwner,
  HostAutostartRunCommand,
  HostAutostartRunCommandResult,
  HostAutostartScope,
  HostAutostartStatus,
  HostAutostartUninstallResult,
} from "./host-autostart.types.js";
import { HostAutostartRuntimeService } from "./host-autostart-runtime.service.js";

type CheckedCommandParams = {
  command: string;
  args: string[];
};

type LinuxSystemdAutostartServiceOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  getHomeDir?: () => string;
  existsSync?: (path: string) => boolean;
  mkdirSync?: typeof mkdirSync;
  writeFileSync?: typeof writeFileSync;
  rmSync?: typeof rmSync;
  runCommand?: HostAutostartRunCommand;
  runtimeService?: HostAutostartRuntimeService;
};

type ResolvedScopeStatus = {
  scope: HostAutostartScope | null;
  reasonIfUnavailable: string | null;
};

const DEFAULT_SYSTEMD_SERVICE_NAME = "nextclaw.service";
const SUPPORTED_PLATFORM = "linux";

export class LinuxSystemdAutostartService {
  private readonly platform: NodeJS.Platform;
  private readonly env: NodeJS.ProcessEnv;
  private readonly getHomeDir: () => string;
  private readonly pathExists: (path: string) => boolean;
  private readonly ensureDir: typeof mkdirSync;
  private readonly writeFile: typeof writeFileSync;
  private readonly removeFile: typeof rmSync;
  private readonly runCommandImpl: HostAutostartRunCommand;
  private readonly runtimeService: HostAutostartRuntimeService;

  constructor(options: LinuxSystemdAutostartServiceOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.env = options.env ?? process.env;
    this.getHomeDir = options.getHomeDir ?? homedir;
    this.pathExists = options.existsSync ?? existsSync;
    this.ensureDir = options.mkdirSync ?? mkdirSync;
    this.writeFile = options.writeFileSync ?? writeFileSync;
    this.removeFile = options.rmSync ?? rmSync;
    this.runCommandImpl = options.runCommand ?? defaultRunCommand;
    this.runtimeService = options.runtimeService ?? new HostAutostartRuntimeService();
  }

  install = async (scope: HostAutostartScope, options: { dryRun?: boolean } = {}): Promise<HostAutostartInstallResult> => {
    if (!this.isSupported()) {
      return this.createUnsupportedInstallResult(scope, Boolean(options.dryRun));
    }

    const plan = this.buildPlan(scope);
    const actions = [
      `write unit file ${plan.resourcePath}`,
      `run ${this.formatCommand(plan.systemctlCommand, [...plan.systemctlScopeArgs, "daemon-reload"])}`,
      `run ${this.formatCommand(plan.systemctlCommand, [...plan.systemctlScopeArgs, "enable", plan.resourceName])}`,
      `run ${this.formatCommand(plan.systemctlCommand, [...plan.systemctlScopeArgs, "restart", plan.resourceName])}`,
    ];

    try {
      if (!options.dryRun) {
        this.ensureDir(dirname(plan.resourcePath), { recursive: true });
        this.writeFile(plan.resourcePath, plan.unitContent);
        await this.runCheckedCommand({
          command: plan.systemctlCommand,
          args: [...plan.systemctlScopeArgs, "daemon-reload"],
        });
        await this.runCheckedCommand({
          command: plan.systemctlCommand,
          args: [...plan.systemctlScopeArgs, "enable", plan.resourceName],
        });
        await this.runCheckedCommand({
          command: plan.systemctlCommand,
          args: [...plan.systemctlScopeArgs, "restart", plan.resourceName],
        });
      }
    } catch (error) {
      return {
        ok: false,
        dryRun: Boolean(options.dryRun),
        scope,
        hostOwner: plan.hostOwner,
        resourceName: plan.resourceName,
        resourcePath: plan.resourcePath,
        homeDir: plan.homeDir,
        command: plan.command,
        logHint: plan.logHint,
        actions,
        reasonIfUnavailable: error instanceof Error ? error.message : "systemd autostart install failed.",
      };
    }

    return {
      ok: true,
      dryRun: Boolean(options.dryRun),
      scope,
      hostOwner: plan.hostOwner,
      resourceName: plan.resourceName,
      resourcePath: plan.resourcePath,
      homeDir: plan.homeDir,
      command: plan.command,
      logHint: plan.logHint,
      actions,
      reasonIfUnavailable: null,
    };
  };

  uninstall = async (scope: HostAutostartScope, options: { dryRun?: boolean } = {}): Promise<HostAutostartUninstallResult> => {
    const plan = this.buildPlan(scope);
    if (!this.isSupported()) {
      return {
        ok: false,
        dryRun: Boolean(options.dryRun),
        scope,
        hostOwner: plan.hostOwner,
        resourceName: plan.resourceName,
        resourcePath: plan.resourcePath,
        removed: false,
        logHint: plan.logHint,
        actions: [],
        reasonIfUnavailable: this.getUnsupportedReason(),
      };
    }

    const installed = this.pathExists(plan.resourcePath);
    const actions: string[] = [];

    if (!installed) {
      return {
        ok: true,
        dryRun: Boolean(options.dryRun),
        scope,
        hostOwner: plan.hostOwner,
        resourceName: plan.resourceName,
        resourcePath: plan.resourcePath,
        removed: false,
        logHint: plan.logHint,
        actions: ["no installed unit file found"],
        reasonIfUnavailable: null,
      };
    }

    actions.push(`run ${this.formatCommand(plan.systemctlCommand, [...plan.systemctlScopeArgs, "disable", "--now", plan.resourceName])}`);
    actions.push(`remove unit file ${plan.resourcePath}`);
    actions.push(`run ${this.formatCommand(plan.systemctlCommand, [...plan.systemctlScopeArgs, "daemon-reload"])}`);

    try {
      if (!options.dryRun) {
        await this.runCheckedCommand({
          command: plan.systemctlCommand,
          args: [...plan.systemctlScopeArgs, "disable", "--now", plan.resourceName],
        });
        this.removeFile(plan.resourcePath, { force: true });
        await this.runCheckedCommand({
          command: plan.systemctlCommand,
          args: [...plan.systemctlScopeArgs, "daemon-reload"],
        });
      }
    } catch (error) {
      return {
        ok: false,
        dryRun: Boolean(options.dryRun),
        scope,
        hostOwner: plan.hostOwner,
        resourceName: plan.resourceName,
        resourcePath: plan.resourcePath,
        removed: false,
        logHint: plan.logHint,
        actions,
        reasonIfUnavailable: error instanceof Error ? error.message : "systemd autostart uninstall failed.",
      };
    }

    return {
      ok: true,
      dryRun: Boolean(options.dryRun),
      scope,
      hostOwner: plan.hostOwner,
      resourceName: plan.resourceName,
      resourcePath: plan.resourcePath,
      removed: true,
      logHint: plan.logHint,
      actions,
      reasonIfUnavailable: null,
    };
  };

  status = async (requestedScope?: HostAutostartScope): Promise<HostAutostartStatus> => {
    if (!this.isSupported()) {
      return this.createUnsupportedStatus();
    }

    const resolvedScope = this.resolveScopeForRead(requestedScope);
    if (!resolvedScope.scope) {
      return {
        supported: true,
        installed: false,
        enabled: null,
        active: null,
        scope: null,
        hostOwner: null,
        resourceName: null,
        resourcePath: null,
        homeDir: null,
        command: null,
        logHint: null,
        reasonIfUnavailable: resolvedScope.reasonIfUnavailable,
      };
    }

    const plan = this.buildPlan(resolvedScope.scope);
    const installed = this.pathExists(plan.resourcePath);
    if (!installed) {
      return {
        supported: true,
        installed: false,
        enabled: false,
        active: false,
        scope: resolvedScope.scope,
        hostOwner: plan.hostOwner,
        resourceName: plan.resourceName,
        resourcePath: plan.resourcePath,
        homeDir: plan.homeDir,
        command: plan.command,
        logHint: plan.logHint,
        reasonIfUnavailable: null,
      };
    }

    const enabledResult = await this.runCommandImpl(plan.systemctlCommand, [...plan.systemctlScopeArgs, "is-enabled", plan.resourceName]);
    const activeResult = await this.runCommandImpl(plan.systemctlCommand, [...plan.systemctlScopeArgs, "is-active", plan.resourceName]);

    return {
      supported: true,
      installed: true,
      enabled: enabledResult.code === 0,
      active: activeResult.code === 0,
      scope: resolvedScope.scope,
      hostOwner: plan.hostOwner,
      resourceName: plan.resourceName,
      resourcePath: plan.resourcePath,
      homeDir: plan.homeDir,
      command: plan.command,
      logHint: plan.logHint,
      reasonIfUnavailable: null,
    };
  };

  doctor = async (requestedScope?: HostAutostartScope): Promise<HostAutostartDoctorReport> => {
    const status = await this.status(requestedScope);
    const checks: HostAutostartCheck[] = [];
    const launchPlan = this.runtimeService.resolveForegroundServeLaunch();

    checks.push({
      name: "platform",
      status: status.supported ? "pass" : "fail",
      detail: status.supported ? "linux supported" : (status.reasonIfUnavailable ?? "unsupported platform"),
    });

    checks.push({
      name: "unit-file",
      status: status.installed ? "pass" : "warn",
      detail: status.resourcePath ?? "no unit path",
    });

    checks.push({
      name: "exec-path",
      status: this.pathExists(launchPlan.command) ? "pass" : "fail",
      detail: launchPlan.command,
    });

    checks.push({
      name: "home-dir",
      status: this.pathExists(launchPlan.homeDir) ? "pass" : "warn",
      detail: launchPlan.homeDir,
    });

    if (status.installed) {
      checks.push({
        name: "enabled",
        status: status.enabled ? "pass" : "warn",
        detail: status.enabled ? "systemd unit enabled" : "systemd unit not enabled",
      });
      checks.push({
        name: "active",
        status: status.active ? "pass" : "warn",
        detail: status.active ? "systemd unit active" : "systemd unit not active",
      });
    }

    const exitCode = checks.some((check) => check.status === "fail")
      ? 1
      : checks.some((check) => check.status === "warn")
        ? 1
        : 0;

    return {
      status,
      checks,
      exitCode,
    };
  };

  private isSupported = (): boolean => {
    return this.platform === SUPPORTED_PLATFORM;
  };

  private getUnsupportedReason = (): string => {
    return "systemd autostart currently supports Linux only.";
  };

  private createUnsupportedStatus = (): HostAutostartStatus => {
    return {
      supported: false,
      installed: false,
      enabled: null,
      active: null,
      scope: null,
      hostOwner: null,
      resourceName: null,
      resourcePath: null,
      homeDir: null,
      command: null,
      logHint: null,
      reasonIfUnavailable: this.getUnsupportedReason(),
    };
  };

  private createUnsupportedInstallResult = (scope: HostAutostartScope, dryRun: boolean): HostAutostartInstallResult => {
    const plan = this.buildPlan(scope);
    return {
      ok: false,
      dryRun,
      scope,
      hostOwner: plan.hostOwner,
      resourceName: plan.resourceName,
      resourcePath: plan.resourcePath,
      homeDir: plan.homeDir,
      command: plan.command,
      logHint: plan.logHint,
      actions: [],
      reasonIfUnavailable: this.getUnsupportedReason(),
    };
  };

  private resolveScopeForRead = (requestedScope?: HostAutostartScope): ResolvedScopeStatus => {
    if (requestedScope) {
      return { scope: requestedScope, reasonIfUnavailable: null };
    }
    const userInstalled = this.pathExists(this.getUnitPath("user"));
    const systemInstalled = this.pathExists(this.getUnitPath("system"));
    if (userInstalled && systemInstalled) {
      return {
        scope: null,
        reasonIfUnavailable: "Both user and system units are installed. Re-run with --user or --system.",
      };
    }
    if (userInstalled) {
      return { scope: "user", reasonIfUnavailable: null };
    }
    if (systemInstalled) {
      return { scope: "system", reasonIfUnavailable: null };
    }
    return { scope: "user", reasonIfUnavailable: null };
  };

  private buildPlan = (scope: HostAutostartScope) => {
    const launch = this.runtimeService.resolveForegroundServeLaunch();
    const command = this.formatCommand(launch.command, launch.args);
    const resourceName = DEFAULT_SYSTEMD_SERVICE_NAME;
    const resourcePath = this.getUnitPath(scope);
    const homeDir = launch.homeDir;
    const hostOwner: HostAutostartOwner = scope === "user" ? "systemd-user-service" : "systemd-system-service";
    const systemctlScopeArgs = scope === "user" ? ["--user"] : [];
    const logHint = scope === "user"
      ? `journalctl --user -u ${resourceName} -f`
      : `journalctl -u ${resourceName} -f`;
    const wantedBy = scope === "user" ? "default.target" : "multi-user.target";

    return {
      scope,
      resourceName,
      resourcePath,
      homeDir,
      hostOwner,
      command,
      logHint,
      unitContent: [
        "[Unit]",
        "Description=NextClaw managed local service",
        "After=network-online.target",
        "Wants=network-online.target",
        "",
        "[Service]",
        "Type=simple",
        `WorkingDirectory=${this.escapeSystemdValue(homeDir)}`,
        `Environment=NEXTCLAW_HOME=${this.escapeSystemdValue(homeDir)}`,
        `ExecStart=${command}`,
        "Restart=on-failure",
        "RestartSec=2",
        "",
        "[Install]",
        `WantedBy=${wantedBy}`,
        "",
      ].join("\n"),
      systemctlCommand: "systemctl",
      systemctlScopeArgs,
    };
  };

  private getUnitPath = (scope: HostAutostartScope): string => {
    if (scope === "system") {
      return "/etc/systemd/system/nextclaw.service";
    }
    const xdgConfigHome = this.env.XDG_CONFIG_HOME?.trim();
    const configHome = xdgConfigHome || join(this.getHomeDir(), ".config");
    return resolve(configHome, "systemd", "user", "nextclaw.service");
  };

  private escapeSystemdValue = (value: string): string => {
    if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
      return value;
    }
    return `"${value.replace(/(["\\])/g, "\\$1")}"`;
  };

  private formatCommand = (command: string, args: string[]): string => {
    return [command, ...args].map((value) => this.escapeSystemdValue(value)).join(" ");
  };

  private runCheckedCommand = async ({ command, args }: CheckedCommandParams): Promise<void> => {
    const result = await this.runCommandImpl(command, args);
    if (result.code === 0) {
      return;
    }
    const detail = result.stderr || result.stdout || `exit code ${result.code}`;
    throw new Error(`Command failed: ${this.formatCommand(command, args)} (${detail})`);
  };
}

const defaultRunCommand = async (command: string, args: string[]): Promise<HostAutostartRunCommandResult> => {
  return await new Promise<HostAutostartRunCommandResult>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf-8");
    child.stderr?.setEncoding("utf-8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      rejectPromise(error);
    });
    child.on("close", (code) => {
      resolvePromise({
        code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
};
