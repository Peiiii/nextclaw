import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";

export class InspectCommand {
  constructor(
    private readonly manifestService: AppManifestService = new AppManifestService(),
  ) {}

  run = async (params: {
    appDirectory: string;
    json: boolean;
    write: (text: string) => void;
  }): Promise<void> => {
    const { appDirectory, json, write } = params;
    const bundle = await this.manifestService.load(appDirectory);
    const summary = this.manifestService.summarize(bundle);
    if (json) {
      write(`${JSON.stringify({ ok: true, summary }, null, 2)}\n`);
      return;
    }
    write(`App: ${summary.name} (${summary.id})\n`);
    write(`Version: ${summary.version}\n`);
    if (summary.schemaVersion === 2) {
      write(`Profile: components\n`);
      write(`Components (${summary.components.length}): ${summary.components.map((component) => `${component.kind}:${component.id}`).join(", ")}\n`);
      if (summary.primaryPanelId) {
        write(`Primary Panel: ${summary.primaryPanelId}\n`);
      }
      return;
    }
    write(`Main Kind: ${summary.mainKind}\n`);
    if (summary.action) {
      write(`Action: ${summary.action}\n`);
    }
    write(`Main: ${summary.mainEntryPath}\n`);
    write(`UI: ${summary.uiEntryPath}\n`);
  };
}
