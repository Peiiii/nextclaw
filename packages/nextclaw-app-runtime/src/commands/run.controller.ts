import { AppHostService } from "../host/app-host.service.js";
import { AppInstanceService } from "../host/app-instance.service.js";
import { AppInstallationService } from "../install/app-installation.service.js";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import type { AppDocumentGrantMap } from "../permissions/app-permissions.types.js";
import { WasmtimeWasiHttpComponentService } from "../runtime/wasmtime-wasi-http-component.service.js";

export type RunCommandInput = {
  appReference: string;
  host: string;
  port: number;
  dataDirectory?: string;
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
    const { appReference, host, port, dataDirectory, json, documentGrantMap, write } = params;
    const launch = await this.installationService.resolveLaunch(appReference, documentGrantMap);
    const bundle = await this.manifestService.load(launch.appDirectory);
    const appInstance = new AppInstanceService(bundle);
    await appInstance.initialize(launch.documentGrantMap, {
      appId: launch.appId,
    });
    await this.installationService.persistGrants(launch.appId, launch.documentGrantMap);
    const wasiHttpComponentService =
      bundle.manifest.main.kind === "wasi-http-component"
        ? new WasmtimeWasiHttpComponentService()
        : undefined;
    const effectiveDataDirectory = dataDirectory ?? launch.dataDirectory;
    if (wasiHttpComponentService) {
      if (!effectiveDataDirectory) {
        throw new Error("wasi-http-component 应用需要通过 --data /path 指定后端数据目录。");
      }
      await wasiHttpComponentService.start({
        wasmPath: bundle.mainEntryPath,
        dataDirectory: effectiveDataDirectory,
      });
    }
    const appHost = new AppHostService(appInstance, wasiHttpComponentService);
    let hostHandle: Awaited<ReturnType<AppHostService["start"]>>;
    try {
      hostHandle = await appHost.start({
        host,
        port,
      });
    } catch (error) {
      await wasiHttpComponentService?.stop();
      throw error;
    }

    const shutdown = async (): Promise<void> => {
      await appHost.stop();
      await wasiHttpComponentService?.stop();
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
              dataDirectory: effectiveDataDirectory,
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
