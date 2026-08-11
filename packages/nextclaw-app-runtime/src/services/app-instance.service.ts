import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AppStandaloneManifestBundle } from "#app-runtime/types/app-manifest.types.js";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import { AppPermissionsService } from "#app-runtime/services/app-permissions.service.js";
import type {
  AppDocumentGrantMap,
  AppPermissionSummary,
  ResolvedPermissions,
} from "#app-runtime/types/app-permissions.types.js";
import { WasmMainRunnerService } from "#app-runtime/services/wasm-main-runner.service.js";
import type { MainRunResult, WasmDocumentSummaryInput } from "#app-runtime/types/main-runner.types.js";

export type AppRunResult = {
  action: string;
  input: WasmDocumentSummaryInput;
  output: MainRunResult;
  observedAt: string;
};

export class AppInstanceService {
  private permissions?: ResolvedPermissions;

  constructor(
    readonly bundle: AppStandaloneManifestBundle,
    private readonly permissionsService: AppPermissionsService = new AppPermissionsService(),
    private readonly mainRunner: WasmMainRunnerService = new WasmMainRunnerService(),
    private readonly manifestService: AppManifestService = new AppManifestService(),
  ) {}

  initialize = async (
    documentGrantMap: AppDocumentGrantMap,
    context?: {
      appId?: string;
    },
  ): Promise<void> => {
    this.permissions = await this.permissionsService.resolve(
      this.bundle,
      documentGrantMap,
      context,
    );
  };

  summarizeManifest = () => {
    return this.manifestService.summarize(this.bundle);
  };

  summarizePermissions = (): AppPermissionSummary => {
    return this.permissionsService.summarize(this.bundle, this.getPermissions());
  };

  runAction = async (action?: string): Promise<AppRunResult> => {
    if (this.bundle.manifest.main.kind !== "wasm") {
      throw new Error("当前应用不支持 __napp/run action，请通过 /api/* 调用 WASI HTTP 后端。");
    }
    const expectedAction = this.bundle.manifest.main.action;
    if (action && action !== expectedAction) {
      throw new Error(`当前应用只支持动作 ${expectedAction}。`);
    }

    const input = await this.collectDocumentSummaryInput();
    const output = await this.mainRunner.runDocumentSummary({
      bundle: this.bundle,
      input,
    });

    return {
      action: expectedAction,
      input,
      output,
      observedAt: new Date().toISOString(),
    };
  };

  private collectDocumentSummaryInput = async (): Promise<WasmDocumentSummaryInput> => {
    const permissions = this.getPermissions();
    let documentCount = 0;
    let textBytes = 0;

    for (const grant of permissions.documentAccess) {
      const scopeSummary = await this.collectDirectorySummary(grant.path);
      documentCount += scopeSummary.documentCount;
      textBytes += scopeSummary.textBytes;
    }

    return {
      documentCount,
      textBytes,
    };
  };

  private collectDirectorySummary = async (
    directoryPath: string,
  ): Promise<WasmDocumentSummaryInput> => {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    let documentCount = 0;
    let textBytes = 0;

    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        const childSummary = await this.collectDirectorySummary(entryPath);
        documentCount += childSummary.documentCount;
        textBytes += childSummary.textBytes;
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const content = await readFile(entryPath, "utf-8");
      documentCount += 1;
      textBytes += Buffer.byteLength(content, "utf-8");
    }

    return {
      documentCount,
      textBytes,
    };
  };

  private getPermissions = (): ResolvedPermissions => {
    if (!this.permissions) {
      throw new Error("应用实例尚未初始化权限。");
    }
    return this.permissions;
  };
}
