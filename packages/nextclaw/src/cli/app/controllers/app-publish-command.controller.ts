import { AppPublishingService } from "@nextclaw-cli/cli/app/services/app-publishing.service.js";
import type {
  AppPublishCommandOptions,
  NextClawAppPublishResult,
} from "@nextclaw-cli/cli/app/types/app-publishing.types.js";

const PLATFORM_APPS_URL = "https://platform.nextclaw.io/apps";

export class AppPublishCommandController {
  constructor(
    private readonly appPublishingService = new AppPublishingService(),
  ) {}

  publish = async (
    target: string,
    options: AppPublishCommandOptions,
  ): Promise<void> => {
    const { allowWarnings, artifacts, json, meta } = options;
    try {
      const result = await this.appPublishingService.publish({
        appDirectory: target,
        metadataPath: meta,
        artifactsDirectory: artifacts,
        allowWarnings,
      });
      process.stdout.write(
        json
          ? `${JSON.stringify({ ok: true, ...result }, null, 2)}\n`
          : this.format(result),
      );
    } catch (error) {
      this.writeError(error, Boolean(json));
      process.exitCode = 1;
    }
  };

  private format = (result: NextClawAppPublishResult): string => {
    const { item } = result.publish;
    if (item.publishStatus === "pending") {
      return [
        `Submitted ${item.name} (${item.appId}) ${item.latestVersion} for review.`,
        "Status: pending",
        "The app will appear in the App Marketplace after approval.",
        `Manage submissions: ${PLATFORM_APPS_URL}`,
        "",
      ].join("\n");
    }
    return [
      `${result.publish.created ? "Published" : "Updated"} ${item.name} (${item.appId}) ${item.latestVersion}.`,
      "Status: published",
      item.webUrl ? `Details: ${item.webUrl}` : "",
      `Manage apps: ${PLATFORM_APPS_URL}`,
      "",
    ]
      .filter((line, index, lines) => line || index === lines.length - 1)
      .join("\n");
  };

  private writeError = (error: unknown, json: boolean): void => {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(
      json
        ? `${JSON.stringify({ ok: false, error: { message } }, null, 2)}\n`
        : `Mini App publish failed: ${message}\n`,
    );
  };
}
