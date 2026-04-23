import { AppScaffoldService } from "../scaffold/app-scaffold.service.js";
import type { AppScaffoldTemplate } from "../scaffold/app-scaffold.service.js";

export class CreateCommand {
  constructor(
    private readonly scaffoldService: AppScaffoldService = new AppScaffoldService(),
  ) {}

  run = async (params: {
    appDirectory: string;
    template: AppScaffoldTemplate;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appDirectory, template, json, write } = params;
    const result = await this.scaffoldService.scaffold(appDirectory, { template });
    if (json) {
      write(`${JSON.stringify({ ok: true, created: result }, null, 2)}\n`);
      return;
    }
    write(`Created app scaffold at ${result.appDirectory}\n`);
    write(`Template: ${result.template}\n`);
    write(`Manifest: ${result.manifestPath}\n`);
    write("Next: napp inspect <app-dir> && napp run <app-dir>\n");
  };
}
