import { AppPublishValidationService } from "../publish/app-publish-validation.service.js";

export class ValidatePublishCommand {
  constructor(
    private readonly validationService: AppPublishValidationService = new AppPublishValidationService(),
  ) {}

  run = async (params: {
    appDirectory: string;
    metadataPath?: string;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appDirectory, metadataPath, json, write } = params;
    const result = await this.validationService.validate({
      appDirectory,
      metadataPath,
    });
    if (json) {
      write(`${JSON.stringify({ ok: true, validation: result }, null, 2)}\n`);
      return;
    }
    write(`Publish validation ok for ${result.appId}@${result.version}\n`);
    write(`Main kind: ${result.mainKind}\n`);
    write(`Main: ${result.mainEntryPath}\n`);
    write(`Metadata: ${result.metadataPath}\n`);
    write(`Bundle size: ${result.bundleSizeBytes} bytes\n`);
    write(`Main entry size: ${result.mainEntrySizeBytes} bytes\n`);
    write(`Bundle files (${result.bundleFilePaths.length}): ${result.bundleFilePaths.join(", ")}\n`);
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        write(`Warning [${warning.code}]: ${warning.message}\n`);
      }
    }
  };
}
