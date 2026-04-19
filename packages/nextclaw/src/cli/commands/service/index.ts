import { HostAutostartCommandService } from "./services/autostart/host-autostart-command.service.js";
import type { ServiceAutostartCommandOptions } from "../../shared/types/cli.types.js";

export class ServiceCommands {
  private readonly hostAutostartCommandService = new HostAutostartCommandService();

  installSystemd = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    await this.hostAutostartCommandService.installSystemd(options);
  };

  uninstallSystemd = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    await this.hostAutostartCommandService.uninstallSystemd(options);
  };

  installLaunchAgent = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    await this.hostAutostartCommandService.installLaunchAgent(options);
  };

  uninstallLaunchAgent = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    await this.hostAutostartCommandService.uninstallLaunchAgent(options);
  };

  installWindowsTask = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    await this.hostAutostartCommandService.installWindowsTask(options);
  };

  uninstallWindowsTask = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    await this.hostAutostartCommandService.uninstallWindowsTask(options);
  };

  autostartStatus = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    await this.hostAutostartCommandService.autostartStatus(options);
  };

  autostartDoctor = async (options: ServiceAutostartCommandOptions = {}): Promise<void> => {
    await this.hostAutostartCommandService.autostartDoctor(options);
  };
}
