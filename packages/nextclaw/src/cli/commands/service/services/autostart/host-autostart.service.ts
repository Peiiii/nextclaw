import type {
  HostAutostartDoctorReport,
  HostAutostartInstallResult,
  HostAutostartScope,
  HostAutostartStatus,
  HostAutostartUninstallResult,
} from "../../types/autostart/host-autostart.types.js";
import { LinuxSystemdAutostartService } from "./linux-systemd-autostart.service.js";
import { MacosLaunchAgentAutostartService } from "./macos-launch-agent-autostart.service.js";
import { WindowsTaskAutostartService } from "./windows-task-autostart.service.js";

type HostAutostartServiceOptions = {
  linuxSystemdService?: LinuxSystemdAutostartService;
  macosLaunchAgentService?: MacosLaunchAgentAutostartService;
  windowsTaskService?: WindowsTaskAutostartService;
  platform?: NodeJS.Platform;
};

export class HostAutostartService {
  private readonly platform: NodeJS.Platform;
  private readonly linuxSystemdService: LinuxSystemdAutostartService;
  private readonly macosLaunchAgentService: MacosLaunchAgentAutostartService;
  private readonly windowsTaskService: WindowsTaskAutostartService;

  constructor(options: HostAutostartServiceOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.linuxSystemdService = options.linuxSystemdService ?? new LinuxSystemdAutostartService();
    this.macosLaunchAgentService = options.macosLaunchAgentService ?? new MacosLaunchAgentAutostartService();
    this.windowsTaskService = options.windowsTaskService ?? new WindowsTaskAutostartService();
  }

  installSystemd = async (scope: HostAutostartScope, options: { dryRun?: boolean } = {}): Promise<HostAutostartInstallResult> => {
    return await this.linuxSystemdService.install(scope, options);
  };

  uninstallSystemd = async (scope: HostAutostartScope, options: { dryRun?: boolean } = {}): Promise<HostAutostartUninstallResult> => {
    return await this.linuxSystemdService.uninstall(scope, options);
  };

  installLaunchAgent = async (options: { dryRun?: boolean } = {}): Promise<HostAutostartInstallResult> => {
    return await this.macosLaunchAgentService.install("user", options);
  };

  uninstallLaunchAgent = async (options: { dryRun?: boolean } = {}): Promise<HostAutostartUninstallResult> => {
    return await this.macosLaunchAgentService.uninstall("user", options);
  };

  installWindowsTask = async (options: { dryRun?: boolean } = {}): Promise<HostAutostartInstallResult> => {
    return await this.windowsTaskService.install("user", options);
  };

  uninstallWindowsTask = async (options: { dryRun?: boolean } = {}): Promise<HostAutostartUninstallResult> => {
    return await this.windowsTaskService.uninstall("user", options);
  };

  status = async (scope?: HostAutostartScope): Promise<HostAutostartStatus> => {
    if (this.platform === "linux") {
      return await this.linuxSystemdService.status(scope);
    }
    if (this.platform === "darwin") {
      return await this.macosLaunchAgentService.status(scope);
    }
    if (this.platform === "win32") {
      return await this.windowsTaskService.status(scope);
    }
    return await this.linuxSystemdService.status(scope);
  };

  doctor = async (scope?: HostAutostartScope): Promise<HostAutostartDoctorReport> => {
    if (this.platform === "linux") {
      return await this.linuxSystemdService.doctor(scope);
    }
    if (this.platform === "darwin") {
      return await this.macosLaunchAgentService.doctor(scope);
    }
    if (this.platform === "win32") {
      return await this.windowsTaskService.doctor(scope);
    }
    return await this.linuxSystemdService.doctor(scope);
  };
}
