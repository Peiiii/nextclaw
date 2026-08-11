import { AppHostService } from "#app-runtime/services/app-host.service.js";
import { AppInstanceService } from "#app-runtime/services/app-instance.service.js";
import { AppInstallationService } from "#app-runtime/services/app-installation.service.js";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import { isAppStandaloneManifestBundle } from "#app-runtime/types/app-manifest.types.js";
import type { AppDocumentGrantMap } from "#app-runtime/types/app-permissions.types.js";
import { WasmtimeWasiHttpComponentService } from "#app-runtime/services/wasmtime-wasi-http-component.service.js";

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
    if (!isAppStandaloneManifestBundle(bundle)) {
      throw new Error("schema v2 组合包由 NextClaw 主产品运行，不能使用 napp run。");
    }
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
