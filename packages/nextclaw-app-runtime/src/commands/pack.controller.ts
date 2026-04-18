import { AppBundleService } from "../bundle/app-bundle.service.js";

export class PackCommand {
  constructor(
    private readonly bundleService: AppBundleService = new AppBundleService(),
  ) {}

  run = async (params: {
    appDirectory: string;
    outputPath?: string;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appDirectory, outputPath, json, write } = params;
    const result = await this.bundleService.packAppDirectory({
      appDirectory,
      outputPath,
    });
    if (json) {
      write(`${JSON.stringify({ ok: true, bundle: result }, null, 2)}\n`);
      return;
    }
    write(`Packed ${result.metadata.name} ${result.metadata.version}\n`);
    write(`Bundle: ${result.bundlePath}\n`);
  };
}
