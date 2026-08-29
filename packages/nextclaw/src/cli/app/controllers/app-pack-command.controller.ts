import { AppPublishingService } from "@nextclaw-cli/cli/app/services/app-publishing.service.js";
import type { AppCheckService } from "@nextclaw-cli/cli/app/services/app-check.service.js";
import type { AppPackCommandOptions } from "@nextclaw-cli/cli/app/types/app-publishing.types.js";

export class AppPackCommandController {
  constructor(
    private readonly appPublishingService = new AppPublishingService(),
    private readonly appCheckService?: AppCheckService,
  ) {}

  pack = async (
    target: string,
    options: AppPackCommandOptions,
  ): Promise<void> => {
    const { json, out, target: platformTarget } = options;
    try {
      if (this.appCheckService) {
        const check = await this.appCheckService.check(target);
        if (!check.ok) {
          const details = check.issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => `[${issue.code}] ${issue.message}`)
            .join("; ");
          throw new Error(`App check failed before pack: ${details}`);
        }
      }
      const bundle = await this.appPublishingService.pack({
        appDirectory: target,
        outputPath: out,
        target: platformTarget,
      });
      process.stdout.write(
        json
          ? `${JSON.stringify({ ok: true, bundle }, null, 2)}\n`
          : [
              `Packed ${bundle.metadata.name} ${bundle.metadata.version}.`,
              bundle.metadata.target
                ? `Target: ${platformTarget}`
                : "Target: universal",
              `Bundle: ${bundle.bundlePath}`,
              "",
            ].join("\n"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(
        json
          ? `${JSON.stringify({ ok: false, error: { message } }, null, 2)}\n`
          : `Mini App pack failed: ${message}\n`,
      );
      process.exitCode = 1;
    }
  };
}
