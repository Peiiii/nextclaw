import type {
  AppPackageDependencyBindingInput,
  AppPackageDependencyView,
  AppPackageList,
  AppPackageOperationList,
  AppPackageOperationView,
  AppPackageView,
} from "@nextclaw/kernel";
import {
  createLocalUiApiClient,
  type UiApiClient,
} from "@nextclaw-cli/cli/app/services/local-api/local-ui-api-client.service.js";
import path from "node:path";

export class AppPackageLiveService {
  constructor(private readonly params: {
    createApiClient?: () => UiApiClient | null;
  } = {}) {}

  list = async (): Promise<AppPackageList> =>
    await this.requireApiClient().request<AppPackageList>({ path: "/api/app-packages" });

  info = async (appId: string): Promise<AppPackageView> =>
    await this.requireApiClient().request<AppPackageView>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}`,
    });

  listOperations = async (): Promise<AppPackageOperationList> =>
    await this.requireApiClient().request<AppPackageOperationList>({ path: "/api/app-package-operations" });

  inspectDependencies = async (appId: string): Promise<AppPackageDependencyView> =>
    await this.requireApiClient().request<AppPackageDependencyView>({ path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/dependencies` });

  verifyDependencies = async (appId: string): Promise<AppPackageDependencyView> =>
    await this.requireApiClient().request<AppPackageDependencyView>({ path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/dependencies/verify` });

  setupDependencies = async (appId: string): Promise<AppPackageDependencyView> =>
    await this.requireApiClient().request<AppPackageDependencyView>({ path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/dependencies/setup`, method: "POST" });

  bindDependency = async (
    appId: string,
    input: AppPackageDependencyBindingInput,
  ): Promise<AppPackageDependencyView> =>
    await this.requireApiClient().request<AppPackageDependencyView>({ path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/dependencies/bind`, method: "POST", body: input });

  unbindDependency = async (
    appId: string,
    input: Omit<AppPackageDependencyBindingInput, "providerId">,
  ): Promise<AppPackageDependencyView> =>
    await this.requireApiClient().request<AppPackageDependencyView>({ path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/dependencies/unbind`, method: "POST", body: input });

  install = async (source: string, registryUrl?: string): Promise<AppPackageOperationView> =>
    await this.requireApiClient().request<AppPackageOperationView>({
      path: "/api/app-package-operations/install",
      method: "POST",
      body: { source: this.normalizeInstallSource(source), registryUrl },
    });

  enable = async (appId: string): Promise<AppPackageView> =>
    await this.changeEnabled(appId, "enable");

  disable = async (appId: string): Promise<AppPackageView> =>
    await this.changeEnabled(appId, "disable");

  update = async (
    appId: string,
    options: { version?: string; registryUrl?: string },
  ): Promise<AppPackageOperationView> =>
    await this.requireApiClient().request<AppPackageOperationView>({
      path: `/api/app-package-operations/${encodeURIComponent(this.requireId(appId))}/update`,
      method: "POST",
      body: options,
    });

  rollback = async (appId: string, version: string): Promise<AppPackageOperationView> =>
    await this.requireApiClient().request<AppPackageOperationView>({
      path: `/api/app-package-operations/${encodeURIComponent(this.requireId(appId))}/rollback`,
      method: "POST",
      body: { version: this.requireVersion(version) },
    });

  uninstall = async (appId: string, purgeData: boolean): Promise<AppPackageOperationView> =>
    await this.requireApiClient().request<AppPackageOperationView>({
      path: `/api/app-package-operations/${encodeURIComponent(this.requireId(appId))}/uninstall`,
      method: "POST",
      body: { purgeData },
    });

  private changeEnabled = async (
    appId: string,
    action: "enable" | "disable",
  ): Promise<AppPackageView> =>
    await this.requireApiClient().request<AppPackageView>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/${action}`,
      method: "POST",
    });

  private requireApiClient = (): UiApiClient => {
    const client = this.params.createApiClient
      ? this.params.createApiClient()
      : createLocalUiApiClient();
    if (!client) {
      throw new Error(
        "NextClaw UI runtime is not running; start NextClaw before managing Apps.",
      );
    }
    return client;
  };

  private requireId = (value: string): string => this.requireValue(value, "App id");

  private requireSource = (value: string): string => this.requireValue(value, "App install source");

  private normalizeInstallSource = (value: string): string => {
    const source = this.requireSource(value);
    return this.looksLikeLocalPath(source) ? path.resolve(source) : source;
  };

  private looksLikeLocalPath = (value: string): boolean =>
    value.startsWith(".") || path.isAbsolute(value) || value.includes(path.sep) || value.endsWith(".napp");

  private requireVersion = (value: string): string => this.requireValue(value, "App version");

  private requireValue = (value: string, name: string): string => {
    const normalized = value.trim();
    if (!normalized) throw new Error(`${name} is required.`);
    return normalized;
  };
}
