import { AppInstallationService } from "../install/app-installation.service.js";

export class UninstallCommand {
  constructor(
    private readonly installationService: AppInstallationService = new AppInstallationService(),
  ) {}

  run = async (params: {
    appId: string;
    purgeData: boolean;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appId, purgeData, json, write } = params;
    const result = await this.installationService.uninstall(appId, purgeData);
    if (json) {
      write(`${JSON.stringify({ ok: true, uninstall: result }, null, 2)}\n`);
      return;
    }
    write(`Uninstalled ${result.appId}\n`);
    write(`Versions: ${result.removedVersions.join(", ")}\n`);
    write(`Data removed: ${result.dataRemoved ? "yes" : "no"}\n`);
  };
}
