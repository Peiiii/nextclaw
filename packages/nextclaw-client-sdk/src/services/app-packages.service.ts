import type { AppPackageList, AppPackageView } from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class AppPackagesClientService {
  constructor(private readonly requestService: RequestService) {}

  readonly list = async (): Promise<AppPackageList> =>
    await this.requestService.get<AppPackageList>("/api/app-packages");

  readonly get = async (appId: string): Promise<AppPackageView> =>
    await this.requestService.get<AppPackageView>(
      `/api/app-packages/${encodeURIComponent(appId)}`,
    );

  readonly install = async (input: {
    source: string;
    registryUrl?: string;
  }): Promise<AppPackageView> =>
    await this.requestService.post<AppPackageView>("/api/app-packages/install", input);

  readonly enable = async (appId: string): Promise<AppPackageView> =>
    await this.requestService.post<AppPackageView>(
      `/api/app-packages/${encodeURIComponent(appId)}/enable`,
    );

  readonly disable = async (appId: string): Promise<AppPackageView> =>
    await this.requestService.post<AppPackageView>(
      `/api/app-packages/${encodeURIComponent(appId)}/disable`,
    );

  readonly update = async (
    appId: string,
    input: { version?: string; registryUrl?: string } = {},
  ): Promise<{ package: AppPackageView }> =>
    await this.requestService.post<{ package: AppPackageView }>(
      `/api/app-packages/${encodeURIComponent(appId)}/update`,
      input,
    );

  readonly rollback = async (
    appId: string,
    version: string,
  ): Promise<{ package: AppPackageView }> =>
    await this.requestService.post<{ package: AppPackageView }>(
      `/api/app-packages/${encodeURIComponent(appId)}/rollback`,
      { version },
    );

  readonly uninstall = async (
    appId: string,
    purgeData: boolean = false,
  ): Promise<{ appId: string; removedVersions: string[]; dataRemoved: boolean }> =>
    await this.requestService.request(
      `/api/app-packages/${encodeURIComponent(appId)}`,
      { method: "DELETE", body: { purgeData } },
    );
}
