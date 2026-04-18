import { AppHostService } from "../host/app-host.service.js";
import { AppInstanceService } from "../host/app-instance.service.js";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import type { AppDocumentGrantMap } from "../permissions/app-permissions.types.js";

export type RunCommandInput = {
  appDirectory: string;
  host: string;
  port: number;
  json: boolean;
  documentGrantMap: AppDocumentGrantMap;
  write: (text: string) => void;
};

export class RunCommand {
  constructor(
    private readonly manifestService: AppManifestService = new AppManifestService(),
  ) {}

  run = async (params: RunCommandInput): Promise<void> => {
    const { appDirectory, host, port, json, documentGrantMap, write } = params;
    const bundle = await this.manifestService.load(appDirectory);
    const appInstance = new AppInstanceService(bundle);
    await appInstance.initialize(documentGrantMap);
    const appHost = new AppHostService(appInstance);
    const hostHandle = await appHost.start({
      host,
      port,
    });

    const shutdown = async (): Promise<void> => {
      await appHost.stop();
      process.exit(0);
    };

    process.once("SIGINT", () => {
      void shutdown();
    });
    process.once("SIGTERM", () => {
      void shutdown();
    });

    if (json) {
      write(`${JSON.stringify({ ok: true, host: hostHandle }, null, 2)}\n`);
      return;
    }

    write(`[napp] ${bundle.manifest.name} listening on ${hostHandle.url}\n`);
  };
}
