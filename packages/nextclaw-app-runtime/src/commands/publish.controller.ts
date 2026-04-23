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
    mode: "source" | "bundle";
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appDirectory, metadataPath, apiBaseUrl, token, mode, json, write } = params;
    const result = await this.publishService.publish({
      appDirectory,
      metadataPath,
      apiBaseUrl,
      token,
      mode,
    });
    if (json) {
      write(`${JSON.stringify({ ok: true, publish: result }, null, 2)}\n`);
      return;
    }
    write(
      `${result.created ? "Published" : "Updated"} ${result.item.name} (${result.item.appId}) ${result.item.latestVersion}\n`,
    );
    write(`Distribution: ${result.distribution.path} (${result.distribution.mode})\n`);
    if (result.item.webUrl) {
      write(`Details: ${result.item.webUrl}\n`);
    }
    write(`Install: ${result.item.install.command}\n`);
  };
}
