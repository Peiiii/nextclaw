import type { ServiceAutostartCommandOptions } from "../../../types.js";
import { HostAutostartService } from "./host-autostart.service.js";
import type {
  HostAutostartDoctorReport,
  HostAutostartInstallResult,
  HostAutostartOwner,
  HostAutostartScope,
  HostAutostartStatus,
  HostAutostartUninstallResult,
  SystemdScopeFlags,
} from "./host-autostart.types.js";

type HostAutostartCommandServiceOptions = {
  hostAutostartService?: HostAutostartService;
};

export class HostAutostartCommandService {
  private readonly hostAutostartService: HostAutostartService;

  constructor(options: HostAutostartCommandServiceOptions = {}) {
    this.hostAutostartService = options.hostAutostartService ?? new HostAutostartService();
  }

  installSystemd = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    const scope = this.resolveRequiredSystemdScope(options);
    if (!scope) {
      process.exitCode = 1;
      return;
    }
    const result = await this.hostAutostartService.installSystemd(scope, {
      dryRun: Boolean(options.dryRun),
    });
    this.handleInstallResult(result, options, "systemd autostart installed.");
  };

  uninstallSystemd = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    const scope = this.resolveRequiredSystemdScope(options);
    if (!scope) {
      process.exitCode = 1;
      return;
    }
    const result = await this.hostAutostartService.uninstallSystemd(scope, {
      dryRun: Boolean(options.dryRun),
    });
    this.handleUninstallResult(result, options, "systemd autostart uninstalled.");
  };

  installLaunchAgent = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    const result = await this.hostAutostartService.installLaunchAgent({
      dryRun: Boolean(options.dryRun),
    });
    this.handleInstallResult(result, options, "LaunchAgent autostart installed.");
  };

  uninstallLaunchAgent = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    const result = await this.hostAutostartService.uninstallLaunchAgent({
      dryRun: Boolean(options.dryRun),
    });
    this.handleUninstallResult(result, options, "LaunchAgent autostart uninstalled.");
  };

  installWindowsTask = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    const result = await this.hostAutostartService.installWindowsTask({
      dryRun: Boolean(options.dryRun),
    });
    this.handleInstallResult(result, options, "Windows task autostart installed.");
  };

  uninstallWindowsTask = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    const result = await this.hostAutostartService.uninstallWindowsTask({
      dryRun: Boolean(options.dryRun),
    });
    this.handleUninstallResult(result, options, "Windows task autostart uninstalled.");
  };

  autostartStatus = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    const scope = this.resolveOptionalSystemdScope(options);
    if (scope === "invalid") {
      process.exitCode = 1;
      return;
    }
    const status = await this.hostAutostartService.status(scope ?? undefined);
    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
      process.exitCode = 0;
      return;
    }
    this.printAutostartStatus(status);
    process.exitCode = 0;
  };

  autostartDoctor = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    const scope = this.resolveOptionalSystemdScope(options);
    if (scope === "invalid") {
      process.exitCode = 1;
      return;
    }
    const report = await this.hostAutostartService.doctor(scope ?? undefined);
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.exitCode;
      return;
    }
    this.printAutostartDoctor(report);
    process.exitCode = report.exitCode;
  };

  private handleInstallResult = (
    result: HostAutostartInstallResult,
    options: ServiceAutostartCommandOptions,
    successMessage: string,
  ): void => {
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
      return;
    }
    if (!result.ok) {
      process.exitCode = 1;
      console.error(`Error: ${result.reasonIfUnavailable ?? "host autostart install failed."}`);
      return;
    }
    this.printInstallLikeResult(result);
    console.log(result.dryRun ? "Dry run complete." : successMessage);
    process.exitCode = 0;
  };

  private handleUninstallResult = (
    result: HostAutostartUninstallResult,
    options: ServiceAutostartCommandOptions,
    successMessage: string,
  ): void => {
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
      return;
    }
    if (!result.ok) {
      process.exitCode = 1;
      console.error(`Error: ${result.reasonIfUnavailable ?? "host autostart uninstall failed."}`);
      return;
    }
    this.printInstallLikeResult(result);
    if (!result.removed) {
      console.log("No installed host autostart resource was found.");
    }
    console.log(result.dryRun ? "Dry run complete." : successMessage);
    process.exitCode = 0;
  };

  private printInstallLikeResult = (
    result: HostAutostartInstallResult | HostAutostartUninstallResult,
  ): void => {
    if (result.hostOwner) {
      console.log(`Host autostart owner: ${this.formatOwner(result.hostOwner)}`);
    }
    if (result.scope) {
      console.log(`Scope: ${result.scope}`);
    }
    if (result.resourceName) {
      console.log(`Resource: ${result.resourceName}`);
    }
    if (result.resourcePath) {
      console.log(`Resource path: ${result.resourcePath}`);
    }
    if ("homeDir" in result && result.homeDir) {
      console.log(`Home: ${result.homeDir}`);
    }
    if ("command" in result && result.command) {
      console.log(`Command: ${result.command}`);
    }
    if (result.logHint) {
      console.log(`Logs: ${result.logHint}`);
    }
    for (const action of result.actions) {
      console.log(`- ${action}`);
    }
  };

  private resolveRequiredSystemdScope = (options: SystemdScopeFlags): HostAutostartScope | null => {
    if (Boolean(options.user) === Boolean(options.system)) {
      console.error("Error: Choose exactly one scope: --user or --system.");
      return null;
    }
    return options.system ? "system" : "user";
  };

  private resolveOptionalSystemdScope = (options: SystemdScopeFlags): HostAutostartScope | "invalid" | null => {
    const { system, user } = options;
    if (user && system) {
      console.error("Error: Choose at most one scope: --user or --system.");
      return "invalid";
    }
    if (system) {
      return "system";
    }
    if (user) {
      return "user";
    }
    return null;
  };

  private printAutostartStatus = (status: HostAutostartStatus): void => {
    console.log("Host autostart status:");
    console.log(`- Supported: ${status.supported ? "yes" : "no"}`);
    console.log(`- Installed: ${status.installed ? "yes" : "no"}`);
    if (status.scope) {
      console.log(`- Scope: ${status.scope}`);
    }
    if (status.hostOwner) {
      console.log(`- Owner: ${this.formatOwner(status.hostOwner)}`);
    }
    if (status.resourceName) {
      console.log(`- Resource: ${status.resourceName}`);
    }
    if (status.resourcePath) {
      console.log(`- Resource path: ${status.resourcePath}`);
    }
    if (status.homeDir) {
      console.log(`- Home: ${status.homeDir}`);
    }
    if (status.command) {
      console.log(`- Command: ${status.command}`);
    }
    if (status.enabled !== null) {
      console.log(`- Enabled: ${status.enabled ? "yes" : "no"}`);
    }
    if (status.active !== null) {
      console.log(`- Active: ${status.active ? "yes" : "no"}`);
    }
    if (status.logHint) {
      console.log(`- Logs: ${status.logHint}`);
    }
    if (status.reasonIfUnavailable) {
      console.log(`- Note: ${status.reasonIfUnavailable}`);
    }
  };

  private printAutostartDoctor = (report: HostAutostartDoctorReport): void => {
    this.printAutostartStatus(report.status);
    console.log("Autostart doctor:");
    for (const check of report.checks) {
      console.log(`- [${check.status}] ${check.name}: ${check.detail}`);
    }
  };

  private formatOwner = (owner: HostAutostartOwner): string => {
    if (owner === "systemd-user-service") {
      return "systemd user service";
    }
    if (owner === "systemd-system-service") {
      return "systemd system service";
    }
    if (owner === "launchd-launch-agent") {
      return "launchd LaunchAgent";
    }
    return "Windows Scheduled Task";
  };
}
