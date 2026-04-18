import { AppHostService } from "../host/app-host.service.js";
import { AppInstanceService } from "../host/app-instance.service.js";
import { AppInstallationService } from "../install/app-installation.service.js";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import type { AppDocumentGrantMap } from "../permissions/app-permissions.types.js";

export type RunCommandInput = {
  appReference: string;
  host: string;
  port: number;
  json: boolean;
  documentGrantMap: AppDocumentGrantMap;
  write: (text: string) => void;
};

export class RunCommand {
  constructor(
    private readonly manifestService: AppManifestService = new AppManifestService(),
    private readonly installationService: AppInstallationService = new AppInstallationService(),
  ) {}

  run = async (params: RunCommandInput): Promise<void> => {
    const { appReference, host, port, json, documentGrantMap, write } = params;
    const launch = await this.installationService.resolveLaunch(appReference, documentGrantMap);
    const bundle = await this.manifestService.load(launch.appDirectory);
    const appInstance = new AppInstanceService(bundle);
    await appInstance.initialize(launch.documentGrantMap);
    await this.installationService.persistGrants(launch.appId, launch.documentGrantMap);
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
      write(
        `${JSON.stringify(
          {
            ok: true,
            host: hostHandle,
            app: {
              appId: launch.appId ?? bundle.manifest.id,
              appDirectory: launch.appDirectory,
            },
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    write(`[napp] ${bundle.manifest.name} listening on ${hostHandle.url}\n`);
  };
}
