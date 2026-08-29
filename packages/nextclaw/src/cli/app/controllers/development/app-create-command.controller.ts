import {
  AppScaffoldService,
  type AppScaffoldTemplate,
} from "@nextclaw/app-runtime";

export class AppCreateCommandController {
  constructor(private readonly scaffoldService = new AppScaffoldService()) {}

  create = async (
    target: string,
    options: { template?: string; json?: boolean },
  ): Promise<void> => {
    const result = await this.scaffoldService.scaffold(target, {
      template: this.parseTemplate(options.template ?? "rust-wasi"),
    });
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify({ ok: true, created: result }, null, 2)}\n`,
      );
      return;
    }
    process.stdout.write(
      [
        `Created NextClaw App at ${result.appDirectory}`,
        `Template: ${result.template}`,
        `Manifest: ${result.manifestPath}`,
        "Next: follow README.md, then run nextclaw app check <app-dir>",
        "",
      ].join("\n"),
    );
  };

  private parseTemplate = (value: string): AppScaffoldTemplate => {
    if (["rust-wasi", "starter", "ts-http", "ts-http-lite"].includes(value)) {
      return value as AppScaffoldTemplate;
    }
    throw new Error(`Unknown App template: ${value}.`);
  };
}
