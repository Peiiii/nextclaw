import { AppInstallationService } from "../install/app-installation.service.js";

export class InfoCommand {
  constructor(
    private readonly installationService: AppInstallationService = new AppInstallationService(),
  ) {}

  run = async (params: {
    appId: string;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appId, json, write } = params;
    const result = await this.installationService.info(appId);
    if (json) {
      write(`${JSON.stringify({ ok: true, app: result }, null, 2)}\n`);
      return;
    }
    write(`App: ${result.name} (${result.appId})\n`);
    write(`Active version: ${result.activeVersion}\n`);
    write(`Data: ${result.dataDirectory}\n`);
    write(`Installed versions: ${result.installedVersions.map((item) => item.version).join(", ")}\n`);
  };
}
