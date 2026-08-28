import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  AppManifestService,
  AppHomeService,
  AppInstanceInventoryService,
  AppInstanceStorageService,
  type AppStorageContext,
  type AppPermissions,
  isAppComponentManifestBundle,
} from "@nextclaw/app-runtime";
import {
  getConfigPath,
  loadConfig,
  resolveConfigSecrets,
  type Config,
} from "@nextclaw/core";
import {
  buildServiceActionId,
  getServiceAppManifestPath,
  type McpServiceAppRuntimeService,
  ServiceAppRuntimeService,
  mergeServiceAppRuntimeActions,
  readServiceAppManifest,
  type ServiceAction,
  type ServiceAppManifest,
  type ServiceAppRecord,
} from "@nextclaw/kernel";
import type {
  ServiceAppCallReport,
  ServiceAppDevIssue,
  ServiceAppDevReport,
} from "@nextclaw-cli/cli/app/types/service-app-dev.types.js";

type RuntimeService = Pick<
  McpServiceAppRuntimeService | ServiceAppRuntimeService,
  "dispose" | "getStatus" | "invokeAction" | "listActions"
>;

type PortableDevContext = {
  componentPath: string;
  permissions: AppPermissions;
};

export class ServiceAppDevService {
  private readonly instanceInventoryService = new AppInstanceInventoryService();
  private readonly instanceStorageService = new AppInstanceStorageService();

  constructor(private readonly params: {
    getConfig?: () => Config;
    runtimeService?: RuntimeService;
    portableServiceRunnerPath?: string;
  } = {}) {}

  inspect = async (
    target: string,
    options: { resetData?: boolean; confirmAppId?: string } = {},
  ): Promise<ServiceAppDevReport> => {
    const appPath = path.resolve(target);
    const issues: ServiceAppDevIssue[] = [];
    const loaded = await this.loadServiceApp(appPath, issues);
    if (!loaded) {
      return this.buildDevReport(appPath, undefined, [], issues);
    }
    if (options.resetData && options.confirmAppId?.trim() !== loaded.manifest.id) {
      issues.push({
        severity: "error",
        code: "service.data.confirmationMismatch",
        message: `--reset-data requires --confirm ${loaded.manifest.id}.`,
      });
    }
    if (this.hasErrors(issues)) {
      return this.buildDevReport(
        appPath,
        this.toServiceAppRecord(appPath, loaded.manifest, this.idleRuntimeStatus),
        [],
        issues,
      );
    }

    const portable = await this.loadPortableDevContext(appPath, loaded.manifest, issues);
    if (this.hasErrors(issues)) {
      return this.buildDevReport(
        appPath,
        this.toServiceAppRecord(appPath, loaded.manifest, this.idleRuntimeStatus),
        [],
        issues,
      );
    }
    const runtime = this.createRuntimeService();
    const storage = await this.createDevStorage(
      appPath,
      loaded.manifest.id,
      options.resetData === true,
    );
    try {
      const startRecord = this.toServiceAppRecord(appPath, loaded.manifest, runtime, storage, portable);
      const runtimeActions = await runtime.listActions({
        app: startRecord,
        manifest: loaded.manifest,
      });
      const record = this.toServiceAppRecord(appPath, loaded.manifest, runtime, storage, portable);
      const actions = mergeServiceAppRuntimeActions({
        record,
        manifest: loaded.manifest,
        runtimeActions,
      });
      this.collectRuntimeIssues(record, actions, issues);
      return this.buildDevReport(appPath, record, actions, issues);
    } finally {
      await runtime.dispose();
    }
  };

  call = async (
    target: string,
    actionName: string,
    input: Record<string, unknown>,
  ): Promise<ServiceAppCallReport> => {
    const appPath = path.resolve(target);
    const issues: ServiceAppDevIssue[] = [];
    const loaded = await this.loadServiceApp(appPath, issues);
    if (!loaded) {
      return this.buildCallReport(appPath, undefined, undefined, undefined, issues);
    }
    if (this.hasErrors(issues)) {
      return this.buildCallReport(
        appPath,
        this.toServiceAppRecord(appPath, loaded.manifest, this.idleRuntimeStatus),
        undefined,
        undefined,
        issues,
      );
    }

    const action = actionName.trim();
    if (!Object.hasOwn(loaded.manifest.actions, action)) {
      issues.push({
        severity: "error",
        code: "service.action.notDeclared",
        message: `service-app.json does not declare action: ${action || "(empty)"}.`,
      });
      const record = this.toServiceAppRecord(appPath, loaded.manifest, this.idleRuntimeStatus);
      return this.buildCallReport(appPath, record, undefined, undefined, issues);
    }

    const portable = await this.loadPortableDevContext(appPath, loaded.manifest, issues);
    if (this.hasErrors(issues)) {
      return this.buildCallReport(
        appPath,
        this.toServiceAppRecord(appPath, loaded.manifest, this.idleRuntimeStatus),
        undefined,
        undefined,
        issues,
      );
    }
    const runtime = this.createRuntimeService();
    const storage = await this.createDevStorage(appPath, loaded.manifest.id);
    try {
      const record = this.toServiceAppRecord(appPath, loaded.manifest, runtime, storage, portable);
      const result = await runtime.invokeAction({
        app: record,
        manifest: loaded.manifest,
        actionName: action,
        input,
      });
      const nextRecord = this.toServiceAppRecord(appPath, loaded.manifest, runtime, storage, portable);
      return this.buildCallReport(
        appPath,
        nextRecord,
        buildServiceActionId(loaded.manifest.id, action),
        result,
        issues,
      );
    } catch (error) {
      const record = this.toServiceAppRecord(appPath, loaded.manifest, runtime, storage, portable);
      issues.push({
        severity: "error",
        code: "service.runtime.callFailed",
        message: error instanceof Error ? error.message : String(error),
      });
      return this.buildCallReport(
        appPath,
        record,
        buildServiceActionId(loaded.manifest.id, action),
        undefined,
        issues,
      );
    } finally {
      await runtime.dispose();
    }
  };

  private loadServiceApp = async (
    appPath: string,
    issues: ServiceAppDevIssue[],
  ): Promise<{ manifest: ServiceAppManifest } | null> => {
    try {
      const manifest = await readServiceAppManifest(appPath);
      if (manifest.id !== path.basename(appPath)) {
        issues.push({
          severity: "error",
          code: "service.id.invalid",
          message: `service-app.json id must equal directory name: ${path.basename(appPath)}.`,
        });
      }
      if (!manifest.enabled) {
        issues.push({
          severity: "error",
          code: "service.disabled",
          message: "Service App is disabled and cannot be started by app dev.",
        });
      }
      return { manifest };
    } catch (error) {
      issues.push({
        severity: "error",
        code: "service.manifest.readFailed",
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };

  private createRuntimeService = (): RuntimeService => {
    if (this.params.runtimeService) return this.params.runtimeService;
    return new ServiceAppRuntimeService({
      getConfig: this.params.getConfig ?? this.loadRuntimeConfig,
      portableServiceRunnerPath: this.params.portableServiceRunnerPath,
    });
  };

  private loadPortableDevContext = async (
    appPath: string,
    manifest: ServiceAppManifest,
    issues: ServiceAppDevIssue[],
  ): Promise<PortableDevContext | undefined> => {
    if (manifest.protocol !== "wasi-component") return undefined;
    const componentPath = path.resolve(appPath, manifest.componentEntry ?? "");
    if (!(await this.pathExists(componentPath))) {
      issues.push({
        severity: "error",
        code: "service.component.notFound",
        message: `Portable Component does not exist: ${manifest.componentEntry ?? "(missing)"}.`,
      });
      return undefined;
    }
    const packageContext = await this.findOwningPackage(appPath);
    if (!packageContext) {
      issues.push({
        severity: "error",
        code: "service.package.required",
        message: "Portable Service App development requires an owning schema v2 Mini App so permissions have one product owner.",
        fixHint: "Place the service under a manifest.json components entry and run app dev on that service directory.",
      });
      return undefined;
    }
    return {
      componentPath,
      permissions: packageContext.permissions,
    };
  };

  private findOwningPackage = async (
    appPath: string,
  ): Promise<{ permissions: AppPermissions } | undefined> => {
    let candidate = path.dirname(appPath);
    while (true) {
      const permissions = await this.readOwningPackagePermissions(candidate, appPath);
      if (permissions) return { permissions };
      const parent = path.dirname(candidate);
      if (parent === candidate) return undefined;
      candidate = parent;
    }
  };

  private readOwningPackagePermissions = async (
    candidate: string,
    appPath: string,
  ): Promise<AppPermissions | undefined> => {
    if (!(await this.pathExists(path.join(candidate, "manifest.json")))) return undefined;
    const manifestService = new AppManifestService();
    try {
      const bundle = await manifestService.load(candidate);
      if (!isAppComponentManifestBundle(bundle)) return undefined;
      const ownsComponent = bundle.components.some(
        (component) => path.resolve(component.componentDirectory) === path.resolve(appPath),
      );
      return ownsComponent
        ? manifestService.resolvePlatformSecurity(bundle.manifest).permissions
        : undefined;
    } catch {
      // The package validator owns detailed diagnostics; continue to a possible parent package.
      return undefined;
    }
  };

  private loadRuntimeConfig = (): Config => {
    const configPath = getConfigPath();
    return resolveConfigSecrets(loadConfig(configPath), { configPath });
  };

  private readonly idleRuntimeStatus = {
    getStatus: (): { status: "idle" } => ({ status: "idle" }),
  };

  private createDevStorage = async (
    appPath: string,
    appId: string,
    resetData = false,
  ): Promise<AppStorageContext> => {
    const sourceId = this.getSourceId(appPath);
    const appHomeDirectory = new AppHomeService().getAppHomeDirectory();
    const instanceDirectory = path.join(
      appHomeDirectory,
      "dev-instances",
      appId,
      sourceId,
      "default",
    );
    if (resetData && await this.pathExists(instanceDirectory)) {
      await this.instanceInventoryService.purgeNested({
        instancesRoot: appHomeDirectory,
        pathSegments: ["dev-instances", appId, sourceId, "default"],
        appId,
        instanceId: "default",
      });
    }
    return (await this.instanceStorageService.materialize({
      appId,
      instanceId: "default",
      instanceDirectory,
    })).storage;
  };

  private getSourceId = (appPath: string): string =>
    createHash("sha256").update(appPath).digest("hex").slice(0, 16);

  private pathExists = async (targetPath: string): Promise<boolean> => {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  };

  private toServiceAppRecord = (
    dirPath: string,
    manifest: ServiceAppManifest,
    runtime: Pick<RuntimeService, "getStatus">,
    storage?: AppStorageContext,
    portable?: PortableDevContext,
  ): ServiceAppRecord => {
    const runtimeStatus = runtime.getStatus(manifest.id);
    const record: ServiceAppRecord = {
      id: manifest.id,
      title: manifest.title,
      dirPath,
      manifestPath: getServiceAppManifestPath(dirPath),
      command: manifest.command,
      args: manifest.args,
      cwd: dirPath,
      enabled: manifest.enabled,
      protocol: manifest.protocol,
      status: manifest.enabled ? runtimeStatus.status : "stopped",
      dataDirectory: storage?.dataDirectory,
      instanceId: storage?.instanceId,
      storage,
      isolation: manifest.protocol === "wasi-component" ? "host-mediated" : "full-user",
      runtimeProfile: manifest.protocol === "wasi-component" ? "wasi" : "native-process",
      componentPath: portable?.componentPath,
      permissions: portable?.permissions,
      providerIds: manifest.providerIds,
      lifecycle: manifest.lifecycle,
    };
    if (manifest.description) {
      record.description = manifest.description;
    }
    if (runtimeStatus.lastError) {
      record.lastError = runtimeStatus.lastError;
    }
    if (runtimeStatus.lastStartedAt) {
      record.lastStartedAt = runtimeStatus.lastStartedAt;
    }
    if (runtimeStatus.lastReadyAt) {
      record.lastReadyAt = runtimeStatus.lastReadyAt;
    }
    if (runtimeStatus.lastFailedAt) {
      record.lastFailedAt = runtimeStatus.lastFailedAt;
    }
    return record;
  };

  private collectRuntimeIssues = (
    record: ServiceAppRecord,
    actions: ServiceAction[],
    issues: ServiceAppDevIssue[],
  ): void => {
    if (record.status === "failed") {
      issues.push({
        severity: "error",
        code: "service.runtime.startFailed",
        message: record.lastError ?? "Service App runtime failed to start.",
      });
    }
    for (const action of actions) {
      if (action.runtimeState === "missing") {
        issues.push({
          severity: "error",
          code: "service.action.runtimeMissing",
          message: `Declared action is missing from runtime tools/list: ${action.name}.`,
        });
      }
      if (action.runtimeState === "undeclared") {
        issues.push({
          severity: "error",
          code: "service.action.runtimeUndeclared",
          message: `Runtime exposes an undeclared action: ${action.name}.`,
          fixHint: `Add "${action.name}" to service-app.json actions or remove it from the MCP server.`,
        });
      }
    }
  };

  private buildDevReport = (
    target: string,
    app: ServiceAppRecord | undefined,
    actions: ServiceAction[],
    issues: ServiceAppDevIssue[],
  ): ServiceAppDevReport => ({
    ok: !issues.some((issue) => issue.severity === "error"),
    target,
    app,
    actions,
    issues,
  });

  private buildCallReport = (
    target: string,
    app: ServiceAppRecord | undefined,
    actionId: string | undefined,
    result: unknown,
    issues: ServiceAppDevIssue[],
  ): ServiceAppCallReport => ({
    ok: !issues.some((issue) => issue.severity === "error"),
    target,
    actionId,
    app,
    result,
    issues,
  });

  private hasErrors = (issues: ServiceAppDevIssue[]): boolean =>
    issues.some((issue) => issue.severity === "error");
}
