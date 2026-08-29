import { AppBuildService } from "@nextclaw/app-runtime";

export class AppBuildCommandController {
  constructor(private readonly buildService = new AppBuildService()) {}

  build = async (
    target: string,
    options: { json?: boolean },
  ): Promise<void> => {
    const result = await this.buildService.build({
      appDirectory: target,
      install: true,
    });
    process.stdout.write(
      options.json
        ? `${JSON.stringify({ ok: true, build: result }, null, 2)}\n`
        : `Built ${result.mainKind}: ${result.mainEntryPath}\n`,
    );
  };
}
