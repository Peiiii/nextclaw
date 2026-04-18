import { AppPublishService } from "../publish/app-publish.service.js";

export class PublishCommand {
  constructor(
    private readonly publishService: AppPublishService = new AppPublishService(),
  ) {}

  run = async (params: {
    appDirectory: string;
    metadataPath?: string;
    apiBaseUrl?: string;
    token?: string;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const result = await this.publishService.publish({
      appDirectory: params.appDirectory,
      metadataPath: params.metadataPath,
      apiBaseUrl: params.apiBaseUrl,
      token: params.token,
    });
    if (params.json) {
      params.write(`${JSON.stringify({ ok: true, publish: result }, null, 2)}\n`);
      return;
    }
    params.write(
      `${result.created ? "Published" : "Updated"} ${result.item.name} (${result.item.appId}) ${result.item.latestVersion}\n`,
    );
    params.write(`Bundle: ${result.bundle.path}\n`);
    params.write(`Install: ${result.item.install.command}\n`);
  };
}
