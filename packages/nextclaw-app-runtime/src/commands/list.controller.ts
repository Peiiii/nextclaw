import { AppInstallationService } from "../install/app-installation.service.js";

export class ListCommand {
  constructor(
    private readonly installationService: AppInstallationService = new AppInstallationService(),
  ) {}

  run = async (params: {
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { json, write } = params;
    const result = await this.installationService.list();
    if (json) {
      write(`${JSON.stringify({ ok: true, apps: result }, null, 2)}\n`);
      return;
    }
    if (result.length === 0) {
      write("No installed apps.\n");
      return;
    }
    for (const appItem of result) {
      write(`${appItem.appId} ${appItem.activeVersion} ${appItem.sourceKind} ${appItem.name}\n`);
    }
  };
}
