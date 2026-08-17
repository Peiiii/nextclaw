import { AppPublishingService } from "@nextclaw-cli/cli/app/services/app-publishing.service.js";
import type { AppPackCommandOptions } from "@nextclaw-cli/cli/app/types/app-publishing.types.js";

export class AppPackCommandController {
  constructor(
    private readonly appPublishingService = new AppPublishingService(),
  ) {}

  pack = async (
    target: string,
    options: AppPackCommandOptions,
  ): Promise<void> => {
    try {
      const bundle = await this.appPublishingService.pack({
        appDirectory: target,
        outputPath: options.out,
        target: options.target,
      });
      process.stdout.write(
        options.json
          ? `${JSON.stringify({ ok: true, bundle }, null, 2)}\n`
          : [
              `Packed ${bundle.metadata.name} ${bundle.metadata.version}.`,
              bundle.metadata.target
                ? `Target: ${options.target}`
                : "Target: universal",
              `Bundle: ${bundle.bundlePath}`,
              "",
            ].join("\n"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(
        options.json
          ? `${JSON.stringify({ ok: false, error: { message } }, null, 2)}\n`
          : `Mini App pack failed: ${message}\n`,
      );
      process.exitCode = 1;
    }
  };
}
