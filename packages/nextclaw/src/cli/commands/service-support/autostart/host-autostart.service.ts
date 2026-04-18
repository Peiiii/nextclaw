import type {
  HostAutostartDoctorReport,
  HostAutostartInstallResult,
  HostAutostartScope,
  HostAutostartStatus,
  HostAutostartUninstallResult,
} from "./host-autostart.types.js";
import { LinuxSystemdAutostartService } from "./linux-systemd-autostart.service.js";

type HostAutostartServiceOptions = {
  linuxSystemdService?: LinuxSystemdAutostartService;
};

export class HostAutostartService {
  private readonly linuxSystemdService: LinuxSystemdAutostartService;

  constructor(options: HostAutostartServiceOptions = {}) {
    this.linuxSystemdService = options.linuxSystemdService ?? new LinuxSystemdAutostartService();
  }

  installSystemd = async (scope: HostAutostartScope, options: { dryRun?: boolean } = {}): Promise<HostAutostartInstallResult> => {
    return await this.linuxSystemdService.install(scope, options);
  };

  uninstallSystemd = async (scope: HostAutostartScope, options: { dryRun?: boolean } = {}): Promise<HostAutostartUninstallResult> => {
    return await this.linuxSystemdService.uninstall(scope, options);
  };

  status = async (scope?: HostAutostartScope): Promise<HostAutostartStatus> => {
    return await this.linuxSystemdService.status(scope);
  };

  doctor = async (scope?: HostAutostartScope): Promise<HostAutostartDoctorReport> => {
    return await this.linuxSystemdService.doctor(scope);
  };
}
