import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { getDataDir } from "@nextclaw/core";
import { resolveCliSubcommandEntry } from "../marketplace/cli-subcommand-launch.js";
import type {
  HostAutostartCheck,
  HostAutostartDoctorReport,
  HostAutostartInstallResult,
  HostAutostartOwner,
  HostAutostartScope,
  HostAutostartStatus,
  HostAutostartUninstallResult,
} from "./host-autostart.types.js";

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type CheckedCommandParams = {
  command: string;
  args: string[];
};

type LinuxSystemdAutostartServiceOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  nodePath?: string;
  argvEntry?: string;
  importMetaUrl?: string;
  getHomeDir?: () => string;
  getDataDir?: () => string;
  existsSync?: (path: string) => boolean;
  mkdirSync?: typeof mkdirSync;
  writeFileSync?: typeof writeFileSync;
  readFileSync?: typeof readFileSync;
  rmSync?: typeof rmSync;
  runCommand?: (command: string, args: string[]) => Promise<CommandResult>;
};

type ResolvedScopeStatus = {
  scope: HostAutostartScope | null;
  reasonIfUnavailable: string | null;
};

const DEFAULT_SYSTEMD_SERVICE_NAME = "nextclaw.service";
const SUPPORTED_PLATFORM = "linux";
const TYPESCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const require = createRequire(import.meta.url);

export class LinuxSystemdAutostartService {
  private readonly platform: NodeJS.Platform;
  private readonly env: NodeJS.ProcessEnv;
  private readonly nodePath: string;
  private readonly argvEntry: string | undefined;
  private readonly importMetaUrl: string;
  private readonly getHomeDir: () => string;
  private readonly getResolvedDataDir: () => string;
  private readonly pathExists: (path: string) => boolean;
  private readonly ensureDir: typeof mkdirSync;
  private readonly writeFile: typeof writeFileSync;
  private readonly readFile: typeof readFileSync;
  private readonly removeFile: typeof rmSync;
  private readonly runCommandImpl: (command: string, args: string[]) => Promise<CommandResult>;

  constructor(options: LinuxSystemdAutostartServiceOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.env = options.env ?? process.env;
    this.nodePath = options.nodePath ?? process.execPath;
    this.argvEntry = options.argvEntry ?? process.argv[1];
    this.importMetaUrl = options.importMetaUrl ?? import.meta.url;
    this.getHomeDir = options.getHomeDir ?? homedir;
    this.getResolvedDataDir = options.getDataDir ?? getDataDir;
    this.pathExists = options.existsSync ?? existsSync;
    this.ensureDir = options.mkdirSync ?? mkdirSync;
    this.writeFile = options.writeFileSync ?? writeFileSync;
    this.readFile = options.readFileSync ?? readFileSync;
    this.removeFile = options.rmSync ?? rmSync;
    this.runCommandImpl = options.runCommand ?? defaultRunCommand;
  }

  install = async (scope: HostAutostartScope, options: { dryRun?: boolean } = {}): Promise<HostAutostartInstallResult> => {
    if (!this.isSupported()) {
      return this.createUnsupportedInstallResult(scope, Boolean(options.dryRun));
    }

    const plan = this.buildPlan(scope);
    const actions = [
      `write unit file ${plan.unitPath}`,
      `run ${this.formatCommand(plan.systemctlCommand, [...plan.systemctlScopeArgs, "daemon-reload"])}`,
      `run ${this.formatCommand(plan.systemctlCommand, [...plan.systemctlScopeArgs, "enable", plan.resourceName])}`,
      `run ${this.formatCommand(plan.systemctlCommand, [...plan.systemctlScopeArgs, "restart", plan.resourceName])}`,
    ];

    try {
      if (!options.dryRun) {
        this.ensureDir(dirname(plan.unitPath), { recursive: true });
        this.writeFile(plan.unitPath, plan.unitContent);
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
        unitPath: plan.unitPath,
        resourceName: plan.resourceName,
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
      unitPath: plan.unitPath,
      resourceName: plan.resourceName,
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
        unitPath: plan.unitPath,
        resourceName: plan.resourceName,
        removed: false,
        logHint: plan.logHint,
        actions: [],
        reasonIfUnavailable: this.getUnsupportedReason(),
      };
    }

    const installed = this.pathExists(plan.unitPath);
    const actions: string[] = [];

    if (!installed) {
      return {
        ok: true,
        dryRun: Boolean(options.dryRun),
        scope,
        unitPath: plan.unitPath,
        resourceName: plan.resourceName,
        removed: false,
        logHint: plan.logHint,
        actions: ["no installed unit file found"],
        reasonIfUnavailable: null,
      };
    }

    actions.push(`run ${this.formatCommand(plan.systemctlCommand, [...plan.systemctlScopeArgs, "disable", "--now", plan.resourceName])}`);
    actions.push(`remove unit file ${plan.unitPath}`);
    actions.push(`run ${this.formatCommand(plan.systemctlCommand, [...plan.systemctlScopeArgs, "daemon-reload"])}`);

    try {
      if (!options.dryRun) {
        await this.runCheckedCommand({
          command: plan.systemctlCommand,
          args: [...plan.systemctlScopeArgs, "disable", "--now", plan.resourceName],
        });
        this.removeFile(plan.unitPath, { force: true });
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
        unitPath: plan.unitPath,
        resourceName: plan.resourceName,
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
      unitPath: plan.unitPath,
      resourceName: plan.resourceName,
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
        unitPath: null,
        homeDir: null,
        command: null,
        logHint: null,
        reasonIfUnavailable: resolvedScope.reasonIfUnavailable,
      };
    }

    const plan = this.buildPlan(resolvedScope.scope);
    const installed = this.pathExists(plan.unitPath);
    if (!installed) {
      return {
        supported: true,
        installed: false,
        enabled: false,
        active: false,
        scope: resolvedScope.scope,
        hostOwner: plan.hostOwner,
        resourceName: plan.resourceName,
        unitPath: plan.unitPath,
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
      unitPath: plan.unitPath,
      homeDir: plan.homeDir,
      command: plan.command,
      logHint: plan.logHint,
      reasonIfUnavailable: null,
    };
  };

  doctor = async (requestedScope?: HostAutostartScope): Promise<HostAutostartDoctorReport> => {
    const status = await this.status(requestedScope);
    const checks: HostAutostartCheck[] = [];

    checks.push({
      name: "platform",
      status: status.supported ? "pass" : "fail",
      detail: status.supported ? "linux supported" : (status.reasonIfUnavailable ?? "unsupported platform"),
    });

    checks.push({
      name: "unit-file",
      status: status.installed ? "pass" : "warn",
      detail: status.unitPath ?? "no unit path",
    });

    checks.push({
      name: "exec-path",
      status: this.pathExists(this.nodePath) ? "pass" : "fail",
      detail: this.nodePath,
    });

    checks.push({
      name: "home-dir",
      status: this.pathExists(status.homeDir ?? this.getResolvedDataDir()) ? "pass" : "warn",
      detail: status.homeDir ?? this.getResolvedDataDir(),
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
      unitPath: null,
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
      unitPath: plan.unitPath,
      resourceName: plan.resourceName,
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
    const cliEntry = resolveCliSubcommandEntry({
      argvEntry: this.argvEntry,
      importMetaUrl: this.importMetaUrl,
    });
    const launch = TYPESCRIPT_EXTENSIONS.has(extname(cliEntry).toLowerCase())
      ? {
          command: this.nodePath,
          args: [require.resolve("tsx/cli"), cliEntry, "serve"],
        }
      : {
          command: this.nodePath,
          args: [cliEntry, "serve"],
        };
    const command = this.formatCommand(launch.command, launch.args);
    const resourceName = DEFAULT_SYSTEMD_SERVICE_NAME;
    const unitPath = this.getUnitPath(scope);
    const homeDir = this.getResolvedDataDir();
    const hostOwner: HostAutostartOwner = scope === "user" ? "systemd-user-service" : "systemd-system-service";
    const systemctlScopeArgs = scope === "user" ? ["--user"] : [];
    const logHint = scope === "user"
      ? `journalctl --user -u ${resourceName} -f`
      : `journalctl -u ${resourceName} -f`;
    const wantedBy = scope === "user" ? "default.target" : "multi-user.target";

    return {
      scope,
      resourceName,
      unitPath,
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

const defaultRunCommand = async (command: string, args: string[]): Promise<CommandResult> => {
  return await new Promise<CommandResult>((resolvePromise, rejectPromise) => {
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
