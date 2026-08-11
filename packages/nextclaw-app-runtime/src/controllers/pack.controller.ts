import { AppBundleService } from "#app-runtime/services/app-bundle.service.js";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";

export class PackCommand {
  constructor(
    private readonly bundleService: AppBundleService = new AppBundleService(),
    private readonly manifestService: AppManifestService = new AppManifestService(),
  ) {}

  run = async (params: {
    appDirectory: string;
    outputPath?: string;
    mode?: "source" | "bundle";
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appDirectory, outputPath, mode, json, write } = params;
    const manifest = await this.manifestService.load(appDirectory);
    const distributionMode = mode ?? (manifest.manifest.schemaVersion === 2 ? "bundle" : "source");
    const result = await this.bundleService.packAppDirectory({
      appDirectory,
      outputPath,
      mode: distributionMode,
    });
    if (json) {
      write(`${JSON.stringify({ ok: true, bundle: result }, null, 2)}\n`);
      return;
    }
    write(`Packed ${result.metadata.name} ${result.metadata.version} (${result.metadata.distributionMode})\n`);
    write(`Bundle: ${result.bundlePath}\n`);
  };
}
