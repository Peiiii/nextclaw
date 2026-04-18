import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
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

type CheckedCommandParams = {
  command: string;
  args: string[];
};

type MacosLaunchAgentAutostartServiceOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  getHomeDir?: () => string;
  getUid?: () => number;
  existsSync?: (path: string) => boolean;
  mkdirSync?: typeof mkdirSync;
  writeFileSync?: typeof writeFileSync;
  rmSync?: typeof rmSync;
  runCommand?: HostAutostartRunCommand;
  runtimeService?: HostAutostartRuntimeService;
};

const DEFAULT_LAUNCH_AGENT_LABEL = "io.nextclaw.host-agent";
const SUPPORTED_PLATFORM = "darwin";

export class MacosLaunchAgentAutostartService {
  private readonly platform: NodeJS.Platform;
  private readonly env: NodeJS.ProcessEnv;
  private readonly getHomeDir: () => string;
  private readonly getUid: () => number;
  private readonly pathExists: (path: string) => boolean;
  private readonly ensureDir: typeof mkdirSync;
  private readonly writeFile: typeof writeFileSync;
  private readonly removeFile: typeof rmSync;
  private readonly runCommandImpl: HostAutostartRunCommand;
  private readonly runtimeService: HostAutostartRuntimeService;

  constructor(options: MacosLaunchAgentAutostartServiceOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.env = options.env ?? process.env;
    this.getHomeDir = options.getHomeDir ?? homedir;
    this.getUid = options.getUid ?? (() => process.getuid?.() ?? Number(this.env.UID ?? 0));
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
      return this.createUnsupportedInstallResult(scope, Boolean(options.dryRun), "macOS launch agent currently supports --user only.");
    }

    const actions = [
      `write launch agent plist ${plan.resourcePath}`,
      `if the GUI login domain is active, run ${this.formatCommand("launchctl", ["bootstrap", plan.guiDomain, plan.resourcePath])}`,
      `if the GUI login domain is active, run ${this.formatCommand("launchctl", ["enable", plan.serviceTarget])}`,
      `if the GUI login domain is active, run ${this.formatCommand("launchctl", ["kickstart", "-k", plan.serviceTarget])}`,
    ];

    try {
      if (!options.dryRun) {
        this.ensureDir(dirname(plan.resourcePath), { recursive: true });
        this.ensureDir(dirname(plan.stdoutPath), { recursive: true });
        this.writeFile(plan.resourcePath, plan.plistContent);
        if (await this.hasGuiDomain(plan.guiDomain)) {
          await this.runTolerantCommand({
            command: "launchctl",
            args: ["bootout", plan.serviceTarget],
          });
          await this.runCheckedCommand({
            command: "launchctl",
            args: ["bootstrap", plan.guiDomain, plan.resourcePath],
          });
          await this.runCheckedCommand({
            command: "launchctl",
            args: ["enable", plan.serviceTarget],
          });
          await this.runCheckedCommand({
            command: "launchctl",
            args: ["kickstart", "-k", plan.serviceTarget],
          });
        }
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
        reasonIfUnavailable: error instanceof Error ? error.message : "launch agent install failed.",
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
      return this.createUnsupportedUninstallResult(scope, Boolean(options.dryRun), "macOS launch agent currently supports --user only.");
    }

    const installed = this.pathExists(plan.resourcePath);
    const actions = [
      `if the GUI login domain is active, run ${this.formatCommand("launchctl", ["bootout", plan.serviceTarget])}`,
      `remove launch agent plist ${plan.resourcePath}`,
    ];

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
        actions: ["no installed launch agent plist found"],
        reasonIfUnavailable: null,
      };
    }

    try {
      if (!options.dryRun) {
        if (await this.hasGuiDomain(plan.guiDomain)) {
          await this.runTolerantCommand({
            command: "launchctl",
            args: ["bootout", plan.serviceTarget],
          });
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
        reasonIfUnavailable: error instanceof Error ? error.message : "launch agent uninstall failed.",
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
      return this.createUnsupportedStatus("macOS launch agent currently supports --user only.");
    }

    const installed = this.pathExists(plan.resourcePath);
    const enabled = installed ? await this.readEnabledState(plan.guiDomain, plan.resourceName) : false;
    const guiDomainAvailable = await this.hasGuiDomain(plan.guiDomain);
    const active = installed && guiDomainAvailable
      ? (await this.runCommandImpl("launchctl", ["print", plan.serviceTarget])).code === 0
      : false;

    return {
      supported: true,
      installed,
      enabled,
      active,
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
    const checks: HostAutostartCheck[] = [];
    const guiDomainAvailable = await this.hasGuiDomain(plan.guiDomain);

    checks.push({
      name: "platform",
      status: status.supported ? "pass" : "fail",
      detail: status.supported ? "macOS supported" : (status.reasonIfUnavailable ?? "unsupported platform"),
    });

    checks.push({
      name: "plist-file",
      status: status.installed ? "pass" : "warn",
      detail: plan.resourcePath,
    });

    checks.push({
      name: "gui-domain",
      status: guiDomainAvailable ? "pass" : "warn",
      detail: guiDomainAvailable ? plan.guiDomain : "GUI login domain is not active; the agent will load on next login.",
    });

    checks.push({
      name: "exec-path",
      status: this.pathExists(plan.launch.command) ? "pass" : "fail",
      detail: plan.launch.command,
    });

    checks.push({
      name: "home-dir",
      status: this.pathExists(plan.homeDir) ? "pass" : "warn",
      detail: plan.homeDir,
    });

    if (status.installed) {
      checks.push({
        name: "enabled",
        status: status.enabled === false ? "warn" : "pass",
        detail: status.enabled === false ? "launch agent is disabled" : "launch agent enabled",
      });
      checks.push({
        name: "active",
        status: status.active ? "pass" : "warn",
        detail: status.active ? "launch agent active" : "launch agent not active in the current GUI session",
      });
    }

    return {
      status,
      checks,
      exitCode: checks.some((check) => check.status === "fail" || check.status === "warn") ? 1 : 0,
    };
  };

  private isSupported = (): boolean => {
    return this.platform === SUPPORTED_PLATFORM;
  };

  private createUnsupportedStatus = (reason = "launch agent autostart currently supports macOS only."): HostAutostartStatus => {
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
    reason = "launch agent autostart currently supports macOS only.",
  ): HostAutostartInstallResult => {
    const plan = this.buildPlan();
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
      reasonIfUnavailable: reason,
    };
  };

  private createUnsupportedUninstallResult = (
    scope: HostAutostartScope,
    dryRun: boolean,
    reason = "launch agent autostart currently supports macOS only.",
  ): HostAutostartUninstallResult => {
    const plan = this.buildPlan();
    return {
      ok: false,
      dryRun,
      scope,
      hostOwner: plan.hostOwner,
      resourceName: plan.resourceName,
      resourcePath: plan.resourcePath,
      removed: false,
      logHint: plan.logHint,
      actions: [],
      reasonIfUnavailable: reason,
    };
  };

  private buildPlan = () => {
    const launch = this.runtimeService.resolveForegroundServeLaunch();
    const homeDir = launch.homeDir;
    const resourceName = DEFAULT_LAUNCH_AGENT_LABEL;
    const resourcePath = resolve(this.getHomeDir(), "Library", "LaunchAgents", `${resourceName}.plist`);
    const stdoutPath = resolve(homeDir, "logs", "host-autostart", "macos-launch-agent.stdout.log");
    const stderrPath = resolve(homeDir, "logs", "host-autostart", "macos-launch-agent.stderr.log");
    const guiDomain = `gui/${this.getUid()}`;
    const serviceTarget = `${guiDomain}/${resourceName}`;

    return {
      launch,
      homeDir,
      hostOwner: "launchd-launch-agent" as const,
      resourceName,
      resourcePath,
      stdoutPath,
      stderrPath,
      guiDomain,
      serviceTarget,
      command: this.formatCommand(launch.command, launch.args),
      logHint: `tail -f ${this.escapeShellValue(stdoutPath)} ${this.escapeShellValue(stderrPath)}`,
      plistContent: this.renderPlist({
        label: resourceName,
        launch,
        homeDir,
        stdoutPath,
        stderrPath,
      }),
    };
  };

  private renderPlist = (params: {
    label: string;
    launch: { command: string; args: string[] };
    homeDir: string;
    stdoutPath: string;
    stderrPath: string;
  }): string => {
    const {
      label,
      launch,
      homeDir,
      stdoutPath,
      stderrPath,
    } = params;
    const lines = [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
      "<plist version=\"1.0\">",
      "<dict>",
      `  <key>Label</key><string>${this.escapeXml(label)}</string>`,
      "  <key>ProgramArguments</key>",
      "  <array>",
      ...[launch.command, ...launch.args].map((value) => `    <string>${this.escapeXml(value)}</string>`),
      "  </array>",
      `  <key>WorkingDirectory</key><string>${this.escapeXml(homeDir)}</string>`,
      "  <key>EnvironmentVariables</key>",
      "  <dict>",
      "    <key>NEXTCLAW_HOME</key>",
      `    <string>${this.escapeXml(homeDir)}</string>`,
      "  </dict>",
      "  <key>RunAtLoad</key><true/>",
      "  <key>KeepAlive</key><true/>",
      `  <key>StandardOutPath</key><string>${this.escapeXml(stdoutPath)}</string>`,
      `  <key>StandardErrorPath</key><string>${this.escapeXml(stderrPath)}</string>`,
      "</dict>",
      "</plist>",
      "",
    ];
    return lines.join("\n");
  };

  private escapeXml = (value: string): string => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  private escapeShellValue = (value: string): string => {
    return `'${value.replace(/'/g, "'\\''")}'`;
  };

  private formatCommand = (command: string, args: string[]): string => {
    return [command, ...args].map((value) => this.escapeShellValue(value)).join(" ");
  };

  private hasGuiDomain = async (guiDomain: string): Promise<boolean> => {
    const result = await this.runCommandImpl("launchctl", ["print", guiDomain]);
    return result.code === 0;
  };

  private readEnabledState = async (guiDomain: string, label: string): Promise<boolean | null> => {
    const result = await this.runCommandImpl("launchctl", ["print-disabled", guiDomain]);
    if (result.code !== 0) {
      return null;
    }
    const matched = result.stdout.match(new RegExp(`"${this.escapeRegExp(label)}"\\s*=>\\s*(enabled|disabled)`));
    if (!matched) {
      return true;
    }
    return matched[1] === "enabled";
  };

  private escapeRegExp = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  private runCheckedCommand = async ({ command, args }: CheckedCommandParams): Promise<void> => {
    const result = await this.runCommandImpl(command, args);
    if (result.code === 0) {
      return;
    }
    const detail = result.stderr || result.stdout || `exit code ${result.code}`;
    throw new Error(`Command failed: ${this.formatCommand(command, args)} (${detail})`);
  };

  private runTolerantCommand = async ({ command, args }: CheckedCommandParams): Promise<void> => {
    await this.runCommandImpl(command, args);
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
