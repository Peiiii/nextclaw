import type {
  AppPackageList,
  AppPackageOperationList,
  AppPackageOperationView,
  AppPackageView,
} from "@nextclaw/kernel";
import { formatNextClawAppInstallCommand } from "@nextclaw/shared";
import {
  AppMarketplaceQueryService,
  type AppMarketplaceItem,
  type AppMarketplaceSearchResult,
} from "@nextclaw-cli/cli/app/services/app-packages/app-marketplace-query.service.js";
import { AppPackageLiveService } from "@nextclaw-cli/cli/app/services/local-api/app-package-live.service.js";

type JsonOptions = { json?: boolean };

export class AppPackageCommandController {
  constructor(
    private readonly liveService = new AppPackageLiveService(),
    private readonly marketplaceService = new AppMarketplaceQueryService(),
  ) {}

  searchMarketplace = async (options: {
    query?: string;
    tag?: string;
    cursor?: string;
    limit?: string;
    json?: boolean;
  }): Promise<void> => {
    const { query, tag, cursor, limit } = options;
    const result = await this.marketplaceService.search({
      query,
      tag,
      cursor,
      limit: limit === undefined ? undefined : Number(limit),
    });
    this.write(result, options, this.formatMarketplaceSearch);
  };

  marketplaceInfo = async (selector: string, options: JsonOptions): Promise<void> =>
    this.write(await this.marketplaceService.info(selector), options, this.formatMarketplaceInfo);

  list = async (options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.list(), options, this.formatList);

  info = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.info(appId), options, this.formatApp);

  operations = async (options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.listOperations(), options, this.formatOperations);

  install = async (source: string, options: { registry?: string; json?: boolean }): Promise<void> =>
    this.write(await this.liveService.install(source, options.registry), options, this.formatOperation);

  enable = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.enable(appId), options, this.formatApp);

  disable = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.disable(appId), options, this.formatApp);

  update = async (
    appId: string,
    options: { version?: string; registry?: string; json?: boolean },
  ): Promise<void> =>
    this.write(
      await this.liveService.update(appId, { version: options.version, registryUrl: options.registry }),
      options,
      this.formatOperation,
    );

  rollback = async (appId: string, options: { version: string; json?: boolean }): Promise<void> =>
    this.write(await this.liveService.rollback(appId, options.version), options, this.formatOperation);

  uninstall = async (appId: string, options: {
    purgeData?: boolean;
    confirm?: string;
    json?: boolean;
  }): Promise<void> => {
    const { purgeData, confirm } = options;
    if (purgeData) this.requirePurgeConfirmation(appId, confirm);
    this.write(await this.liveService.uninstall(appId, purgeData === true), options, this.formatOperation);
  };

  private write = <T>(result: T, options: JsonOptions, format: (value: T) => string): void => {
    process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : format(result));
  };

  private formatMarketplaceSearch = (result: AppMarketplaceSearchResult): string => {
    if (result.items.length === 0) return "No Marketplace Apps found.\n";
    return `${result.items.map((item) => this.formatMarketplaceInfo(item).trim()).join("\n\n")}\n`;
  };

  private formatMarketplaceInfo = (item: AppMarketplaceItem): string => [
    `${item.name} (${item.appId})`,
    `  summary: ${item.summary}`,
    `  version: ${item.latestVersion}`,
    `  author: ${item.author}`,
    `  tags: ${item.tags.join(", ") || "-"}`,
    `  install: ${formatNextClawAppInstallCommand(item.install.spec)}`,
  ].join("\n") + "\n";

  private formatList = (result: AppPackageList): string => {
    if (result.entries.length === 0) return "Apps: none\n";
    return `${result.entries.map((app) => this.formatApp(app).trim()).join("\n\n")}\n`;
  };

  private formatApp = (app: AppPackageView): string => [
    `${app.name} (${app.id})`,
    `  version: ${app.activeVersion}`,
    `  enabled: ${app.enabled ? "yes" : "no"}`,
    `  built-in: ${app.builtIn ? "yes" : "no"}`,
    `  versions: ${app.installedVersions.join(", ")}`,
  ].join("\n") + "\n";

  private formatOperations = (result: AppPackageOperationList): string => {
    if (result.entries.length === 0) return "App operations: none\n";
    return `${result.entries.map((operation) => this.formatOperation(operation).trim()).join("\n\n")}\n`;
  };

  private formatOperation = (operation: AppPackageOperationView): string => [
    `App operation ${operation.id}`,
    `  action: ${operation.action}`,
    `  status: ${operation.status}`,
    `  app: ${operation.appId ?? operation.source ?? "-"}`,
    operation.error ? `  error: ${operation.error}` : "",
  ].filter(Boolean).join("\n") + "\n";

  private requirePurgeConfirmation = (appId: string, confirmation?: string): void => {
    if (confirmation?.trim() !== appId.trim()) {
      throw new Error("--purge-data requires --confirm <app-id> matching the exact App id.");
    }
  };
}
