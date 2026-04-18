import { AppInstallationService } from "../install/app-installation.service.js";

export class InstallCommand {
  constructor(
    private readonly installationService: AppInstallationService = new AppInstallationService(),
  ) {}

  run = async (params: {
    appSource: string;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appSource, json, write } = params;
    const result = await this.installationService.install(appSource);
    if (json) {
      write(`${JSON.stringify({ ok: true, installation: result }, null, 2)}\n`);
      return;
    }
    write(`Installed ${result.name} (${result.appId}) ${result.version}\n`);
    write(`Code: ${result.installDirectory}\n`);
    write(`Data: ${result.dataDirectory}\n`);
  };
}
