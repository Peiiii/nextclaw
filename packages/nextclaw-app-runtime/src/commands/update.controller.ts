import { AppInstallationService } from "../install/app-installation.service.js";

export class UpdateCommand {
  constructor(
    private readonly installationService: AppInstallationService = new AppInstallationService(),
  ) {}

  run = async (params: {
    appId: string;
    version?: string;
    registryUrl?: string;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appId, version, registryUrl, json, write } = params;
    const result = await this.installationService.update(appId, {
      version,
      registryUrl,
    });
    if (json) {
      write(`${JSON.stringify({ ok: true, update: result }, null, 2)}\n`);
      return;
    }
    if (!result.updated) {
      write(`Already up to date: ${result.appId} ${result.version}\n`);
      return;
    }
    write(`Updated ${result.name} (${result.appId}) ${result.previousVersion} -> ${result.version}\n`);
    write(`Code: ${result.installDirectory}\n`);
  };
}
