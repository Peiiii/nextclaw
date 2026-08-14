import { AppDataLiveService } from "@nextclaw-cli/cli/app/services/local-api/app-data-live.service.js";

export class AppDataCommandController {
  constructor(private readonly service = new AppDataLiveService()) {}

  list = async (options: { json?: boolean }): Promise<void> => {
    const result = await this.service.list();
    process.stdout.write(options.json
      ? `${JSON.stringify(result, null, 2)}\n`
      : this.formatList(result));
  };

  deleteRetained = async (
    dataId: string,
    options: { confirm: string; json?: boolean },
  ): Promise<void> => {
    const result = await this.service.deleteRetained(dataId, options.confirm);
    process.stdout.write(options.json
      ? `${JSON.stringify(result, null, 2)}\n`
      : `Deleted App data: ${result.appId}/${result.instanceId}\n`);
  };

  private formatList = (
    result: Awaited<ReturnType<AppDataLiveService["list"]>>,
  ): string => {
    if (result.entries.length === 0) return "App data: none\n";
    const lines = result.entries.map((entry) =>
      `${entry.id}\t${entry.lifecycle}\t${entry.source}\t${entry.appId}\t${entry.usage.totalBytes} B\t${entry.storage.instanceDirectory}`);
    return `${lines.join("\n")}\n`;
  };
}
