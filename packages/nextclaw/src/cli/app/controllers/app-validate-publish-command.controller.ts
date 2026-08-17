import { AppPublishingService } from "@nextclaw-cli/cli/app/services/app-publishing.service.js";
import type {
  AppPublishingCommandOptions,
  NextClawAppPublishValidationResult,
} from "@nextclaw-cli/cli/app/types/app-publishing.types.js";

export class AppValidatePublishCommandController {
  constructor(
    private readonly appPublishingService = new AppPublishingService(),
  ) {}

  validate = async (
    target: string,
    options: AppPublishingCommandOptions,
  ): Promise<void> => {
    try {
      const validation = await this.appPublishingService.validate({
        appDirectory: target,
        metadataPath: options.meta,
        artifactsDirectory: options.artifacts,
      });
      process.stdout.write(
        options.json
          ? `${JSON.stringify({ ok: true, validation }, null, 2)}\n`
          : this.format(validation),
      );
    } catch (error) {
      this.writeError(error, Boolean(options.json));
      process.exitCode = 1;
    }
  };

  private format = (validation: NextClawAppPublishValidationResult): string => {
    const lines = [
      `Mini App publish validation passed: ${validation.appId}@${validation.version}`,
      `Components: ${validation.componentCount ?? 0}`,
      `Bundle size: ${validation.bundleSizeBytes} bytes`,
      `Metadata: ${validation.metadataPath}`,
    ];
    for (const artifact of validation.artifacts ?? []) {
      lines.push(`Artifact ${artifact.targetKey}: ${artifact.sizeBytes} bytes`);
    }
    for (const warning of validation.warnings) {
      lines.push(`Warning [${warning.code}]: ${warning.message}`);
    }
    return `${lines.join("\n")}\n`;
  };

  private writeError = (error: unknown, json: boolean): void => {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(
      json
        ? `${JSON.stringify({ ok: false, error: { message } }, null, 2)}\n`
        : `Mini App publish validation failed: ${message}\n`,
    );
  };
}
