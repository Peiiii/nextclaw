import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { win32 as windowsPath } from "node:path";
import type {
  HostAutostartCheck,
  HostAutostartDoctorReport,
  HostAutostartInstallResult,
  HostAutostartRunCommand,
  HostAutostartRunCommandResult,
  HostAutostartScope,
  HostAutostartStatus,
  HostAutostartUninstallResult,
} from "./host-autostart.types.js";
import { HostAutostartRuntimeService } from "./host-autostart-runtime.service.js";

type WindowsTaskAutostartServiceOptions = {
  platform?: NodeJS.Platform;
  existsSync?: (path: string) => boolean;
  mkdirSync?: typeof mkdirSync;
  writeFileSync?: typeof writeFileSync;
  rmSync?: typeof rmSync;
  runCommand?: HostAutostartRunCommand;
  runtimeService?: HostAutostartRuntimeService;
};

type WindowsScheduledTaskInfo = {
  installed: boolean;
  enabled: boolean | null;
  active: boolean | null;
  state?: string | null;
  taskPath?: string | null;
  lastTaskResult?: number | null;
};

const DEFAULT_TASK_NAME = "NextClaw Host Autostart";
const SUPPORTED_PLATFORM = "win32";

export class WindowsTaskAutostartService {
  private readonly platform: NodeJS.Platform;
  private readonly pathExists: (path: string) => boolean;
  private readonly ensureDir: typeof mkdirSync;
  private readonly writeFile: typeof writeFileSync;
  private readonly removeFile: typeof rmSync;
  private readonly runCommandImpl: HostAutostartRunCommand;
  private readonly runtimeService: HostAutostartRuntimeService;

  constructor(options: WindowsTaskAutostartServiceOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.pathExists = options.existsSync ?? existsSync;
    this.ensureDir = options.mkdirSync ?? mkdirSync;
    this.writeFile = options.writeFileSync ?? writeFileSync;
    this.removeFile = options.rmSync ?? rmSync;
    this.runCommandImpl = options.runCommand ?? defaultRunCommand;
    this.runtimeService = options.runtimeService ?? new HostAutostartRuntimeService();
  }

  install = async (scope: HostAutostartScope, options: { dryRun?: boolean } = {}): Promise<HostAutostartInstallResult> => {
    const plan = this.buildPlan();
    if (!this.isSupported()) {
      return this.createUnsupportedInstallResult(scope, Boolean(options.dryRun));
    }
    if (scope === "system") {
      return this.createUnsupportedInstallResult(scope, Boolean(options.dryRun), "Windows task autostart currently supports --user only.");
    }

    const actions = [
      `write launcher script ${plan.resourcePath}`,
      `register scheduled task ${plan.resourceName}`,
      `start scheduled task ${plan.resourceName}`,
    ];

    try {
      if (!options.dryRun) {
        this.ensureDir(windowsPath.dirname(plan.resourcePath), { recursive: true });
        this.ensureDir(windowsPath.dirname(plan.logPath), { recursive: true });
        this.writeFile(plan.resourcePath, plan.launcherContent);
        await this.runCheckedPowerShell(this.renderInstallScript(plan));
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
        reasonIfUnavailable: error instanceof Error ? error.message : "windows task install failed.",
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
    const plan = this.buildPlan();
    if (!this.isSupported()) {
      return this.createUnsupportedUninstallResult(scope, Boolean(options.dryRun));
    }
    if (scope === "system") {
      return this.createUnsupportedUninstallResult(scope, Boolean(options.dryRun), "Windows task autostart currently supports --user only.");
    }

    const taskInfo = await this.readTaskInfo(plan.resourceName);
    const installed = taskInfo?.installed ?? false;
    const actions = [
      `unregister scheduled task ${plan.resourceName}`,
      `remove launcher script ${plan.resourcePath}`,
    ];

    if (!installed && !this.pathExists(plan.resourcePath)) {
      return {
        ok: true,
        dryRun: Boolean(options.dryRun),
        scope,
        hostOwner: plan.hostOwner,
        resourceName: plan.resourceName,
        resourcePath: plan.resourcePath,
        removed: false,
        logHint: plan.logHint,
        actions: ["no installed scheduled task or launcher script found"],
        reasonIfUnavailable: null,
      };
    }

    try {
      if (!options.dryRun) {
        if (installed) {
          await this.runCheckedPowerShell(this.renderUninstallScript(plan.resourceName));
        }
        this.removeFile(plan.resourcePath, { force: true });
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
        reasonIfUnavailable: error instanceof Error ? error.message : "windows task uninstall failed.",
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
    const plan = this.buildPlan();
    if (!this.isSupported()) {
      return this.createUnsupportedStatus();
    }
    if (requestedScope === "system") {
      return this.createUnsupportedStatus("Windows task autostart currently supports --user only.");
    }

    const taskInfo = await this.readTaskInfo(plan.resourceName);
    const installed = taskInfo?.installed ?? false;

    return {
      supported: true,
      installed,
      enabled: taskInfo?.enabled ?? false,
      active: taskInfo?.active ?? false,
      scope: "user",
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
    const plan = this.buildPlan();
    const taskInfo = await this.readTaskInfo(plan.resourceName);
    const checks: HostAutostartCheck[] = [
      this.createPlatformCheck(status),
      this.createTaskCheck(status, taskInfo, plan.resourceName),
      this.createLauncherScriptCheck(plan.resourcePath),
      this.createExecPathCheck(plan.launch.command),
      this.createHomeDirCheck(plan.homeDir),
      ...this.createInstalledDoctorChecks(status, taskInfo),
    ];

    return {
      status,
      checks,
      exitCode: checks.some((check) => check.status === "fail" || check.status === "warn") ? 1 : 0,
    };
  };

  private isSupported = (): boolean => {
    return this.platform === SUPPORTED_PLATFORM;
  };

  private createUnsupportedStatus = (reason = "windows task autostart currently supports Windows only."): HostAutostartStatus => {
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
      reasonIfUnavailable: reason,
    };
  };

  private createUnsupportedInstallResult = (
    scope: HostAutostartScope,
    dryRun: boolean,
    reason = "windows task autostart currently supports Windows only.",
  ): HostAutostartInstallResult => {
    const plan = this.buildPlan();
    const includePlan = this.isSupported();
    return {
      ok: false,
      dryRun,
      scope,
      hostOwner: includePlan ? plan.hostOwner : "windows-logon-task",
      resourceName: includePlan ? plan.resourceName : DEFAULT_TASK_NAME,
      resourcePath: includePlan ? plan.resourcePath : null,
      homeDir: includePlan ? plan.homeDir : null,
      command: includePlan ? plan.command : null,
      logHint: includePlan ? plan.logHint : null,
      actions: [],
      reasonIfUnavailable: reason,
    };
  };

  private createUnsupportedUninstallResult = (
    scope: HostAutostartScope,
    dryRun: boolean,
    reason = "windows task autostart currently supports Windows only.",
  ): HostAutostartUninstallResult => {
    const plan = this.buildPlan();
    const includePlan = this.isSupported();
    return {
      ok: false,
      dryRun,
      scope,
      hostOwner: includePlan ? plan.hostOwner : "windows-logon-task",
      resourceName: includePlan ? plan.resourceName : DEFAULT_TASK_NAME,
      resourcePath: includePlan ? plan.resourcePath : null,
      removed: false,
      logHint: includePlan ? plan.logHint : null,
      actions: [],
      reasonIfUnavailable: reason,
    };
  };

  private createPlatformCheck = (status: HostAutostartStatus): HostAutostartCheck => {
    return {
      name: "platform",
      status: status.supported ? "pass" : "fail",
      detail: status.supported ? "windows supported" : (status.reasonIfUnavailable ?? "unsupported platform"),
    };
  };

  private createTaskCheck = (
    status: HostAutostartStatus,
    taskInfo: WindowsScheduledTaskInfo | null,
    taskName: string,
  ): HostAutostartCheck => {
    return {
      name: "task",
      status: status.installed ? "pass" : "warn",
      detail: taskInfo?.taskPath ?? taskName,
    };
  };

  private createLauncherScriptCheck = (resourcePath: string): HostAutostartCheck => {
    return {
      name: "launcher-script",
      status: this.pathExists(resourcePath) ? "pass" : "warn",
      detail: resourcePath,
    };
  };

  private createExecPathCheck = (commandPath: string): HostAutostartCheck => {
    return {
      name: "exec-path",
      status: this.pathExists(commandPath) ? "pass" : "fail",
      detail: commandPath,
    };
  };

  private createHomeDirCheck = (homeDir: string): HostAutostartCheck => {
    return {
      name: "home-dir",
      status: this.pathExists(homeDir) ? "pass" : "warn",
      detail: homeDir,
    };
  };

  private createInstalledDoctorChecks = (
    status: HostAutostartStatus,
    taskInfo: WindowsScheduledTaskInfo | null,
  ): HostAutostartCheck[] => {
    if (!status.installed) {
      return [];
    }
    return [
      {
        name: "enabled",
        status: status.enabled === false ? "warn" : "pass",
        detail: status.enabled === false ? "scheduled task disabled" : "scheduled task enabled",
      },
      {
        name: "active",
        status: status.active ? "pass" : "warn",
        detail: taskInfo?.state ?? (status.active ? "Running" : "Not running"),
      },
      this.createLastTaskResultCheck(taskInfo),
    ];
  };

  private createLastTaskResultCheck = (taskInfo: WindowsScheduledTaskInfo | null): HostAutostartCheck => {
    const lastTaskResult = taskInfo?.lastTaskResult;
    return {
      name: "last-task-result",
      status: lastTaskResult === null || lastTaskResult === undefined || lastTaskResult === 0 ? "pass" : "warn",
      detail: lastTaskResult === null || lastTaskResult === undefined
        ? "no recorded task result"
        : String(lastTaskResult),
    };
  };

  private buildPlan = () => {
    const launch = this.runtimeService.resolveForegroundServeLaunch();
    const homeDir = launch.homeDir;
    const resourcePath = windowsPath.resolve(homeDir, "autostart", "nextclaw-host-autostart.cmd");
    const logPath = windowsPath.resolve(homeDir, "logs", "host-autostart", "windows-task.log");
    const launcherCommand = `cmd.exe /d /c "${resourcePath}"`;

    return {
      launch,
      homeDir,
      hostOwner: "windows-logon-task" as const,
      resourceName: DEFAULT_TASK_NAME,
      resourcePath,
      logPath,
      command: launcherCommand,
      logHint: `Get-Content -Path '${logPath.replace(/'/g, "''")}' -Wait`,
      launcherContent: this.renderLauncher({
        launch,
        homeDir,
        logPath,
      }),
      actionExecute: "cmd.exe",
      actionArguments: `/d /c "${resourcePath}"`,
    };
  };

  private renderLauncher = (params: {
    launch: { command: string; args: string[] };
    homeDir: string;
    logPath: string;
  }): string => {
    const { launch, homeDir, logPath } = params;
    const args = launch.args.map((value) => `"${this.escapeBatchValue(value)}"`).join(" ");
    return [
      "@echo off",
      "setlocal",
      `set "NEXTCLAW_HOME=${this.escapeBatchValue(homeDir)}"`,
      `cd /d "${this.escapeBatchValue(homeDir)}"`,
      `"${this.escapeBatchValue(launch.command)}" ${args} >> "${this.escapeBatchValue(logPath)}" 2>&1`,
      "",
    ].join("\r\n");
  };

  private escapeBatchValue = (value: string): string => {
    return value.replace(/"/g, "\"\"");
  };

  private renderInstallScript = (plan: ReturnType<WindowsTaskAutostartService["buildPlan"]>): string => {
    return [
      `$taskName = '${plan.resourceName.replace(/'/g, "''")}'`,
      `$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name`,
      `$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/d /c "${plan.resourcePath.replace(/'/g, "''")}"'`,
      "$trigger = New-ScheduledTaskTrigger -AtLogOn",
      "$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType InteractiveToken -RunLevel Limited",
      "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries",
      "Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null",
      "Start-ScheduledTask -TaskName $taskName",
    ].join("\n");
  };

  private renderUninstallScript = (taskName: string): string => {
    return [
      `$task = Get-ScheduledTask -TaskName '${taskName.replace(/'/g, "''")}' -ErrorAction SilentlyContinue`,
      "if ($null -ne $task) {",
      "  Unregister-ScheduledTask -TaskName $task.TaskName -Confirm:$false",
      "}",
    ].join("\n");
  };

  private readTaskInfo = async (taskName: string): Promise<WindowsScheduledTaskInfo | null> => {
    const result = await this.runPowerShell(this.renderStatusScript(taskName));
    if (result.code !== 0) {
      return null;
    }
    const payload = result.stdout.trim();
    if (!payload) {
      return null;
    }
    return JSON.parse(payload) as WindowsScheduledTaskInfo;
  };

  private renderStatusScript = (taskName: string): string => {
    return [
      `$task = Get-ScheduledTask -TaskName '${taskName.replace(/'/g, "''")}' -ErrorAction SilentlyContinue`,
      "if ($null -eq $task) {",
      "  [pscustomobject]@{ installed = $false; enabled = $false; active = $false; state = $null; taskPath = $null; lastTaskResult = $null } | ConvertTo-Json -Compress",
      "  exit 0",
      "}",
      "$info = Get-ScheduledTaskInfo -TaskName $task.TaskName",
      "[pscustomobject]@{",
      "  installed = $true",
      "  enabled = [bool]$task.Settings.Enabled",
      "  active = ([string]$task.State -eq 'Running')",
      "  state = [string]$task.State",
      "  taskPath = [string]$task.TaskPath",
      "  lastTaskResult = [int]$info.LastTaskResult",
      "} | ConvertTo-Json -Compress",
    ].join("\n");
  };

  private runCheckedPowerShell = async (script: string): Promise<void> => {
    const result = await this.runPowerShell(script);
    if (result.code === 0) {
      return;
    }
    const detail = result.stderr || result.stdout || `exit code ${result.code}`;
    throw new Error(`PowerShell command failed: ${detail}`);
  };

  private runPowerShell = async (script: string): Promise<HostAutostartRunCommandResult> => {
    const encodedScript = Buffer.from(script, "utf16le").toString("base64");
    return await this.runCommandImpl("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      encodedScript,
    ]);
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
