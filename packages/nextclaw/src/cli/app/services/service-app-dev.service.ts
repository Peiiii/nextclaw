import path from "node:path";
import {
  getConfigPath,
  loadConfig,
  resolveConfigSecrets,
  type Config,
} from "@nextclaw/core";
import {
  buildServiceActionId,
  getServiceAppManifestPath,
  McpServiceAppRuntimeService,
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
  McpServiceAppRuntimeService,
  "dispose" | "getStatus" | "invokeAction" | "listActions"
>;

export class ServiceAppDevService {
  constructor(private readonly params: {
    getConfig?: () => Config;
    runtimeService?: RuntimeService;
  } = {}) {}

  inspect = async (target: string): Promise<ServiceAppDevReport> => {
    const appPath = path.resolve(target);
    const issues: ServiceAppDevIssue[] = [];
    const loaded = await this.loadServiceApp(appPath, issues);
    if (!loaded) {
      return this.buildDevReport(appPath, undefined, [], issues);
    }
    if (this.hasErrors(issues)) {
      return this.buildDevReport(
        appPath,
        this.toServiceAppRecord(appPath, loaded.manifest, this.idleRuntimeStatus),
        [],
        issues,
      );
    }

    const runtime = this.createRuntimeService();
    try {
      const startRecord = this.toServiceAppRecord(appPath, loaded.manifest, runtime);
      const runtimeActions = await runtime.listActions({
        app: startRecord,
        manifest: loaded.manifest,
      });
      const record = this.toServiceAppRecord(appPath, loaded.manifest, runtime);
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

    const runtime = this.createRuntimeService();
    try {
      const record = this.toServiceAppRecord(appPath, loaded.manifest, runtime);
      const result = await runtime.invokeAction({
        app: record,
        manifest: loaded.manifest,
        actionName: action,
        input,
      });
      const nextRecord = this.toServiceAppRecord(appPath, loaded.manifest, runtime);
      return this.buildCallReport(
        appPath,
        nextRecord,
        buildServiceActionId(loaded.manifest.id, action),
        result,
        issues,
      );
    } catch (error) {
      const record = this.toServiceAppRecord(appPath, loaded.manifest, runtime);
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

  private createRuntimeService = (): RuntimeService =>
    this.params.runtimeService ?? new McpServiceAppRuntimeService({
      getConfig: this.params.getConfig ?? this.loadRuntimeConfig,
    });

  private loadRuntimeConfig = (): Config => {
    const configPath = getConfigPath();
    return resolveConfigSecrets(loadConfig(configPath), { configPath });
  };

  private readonly idleRuntimeStatus = {
    getStatus: (): { status: "idle" } => ({ status: "idle" }),
  };

  private toServiceAppRecord = (
    dirPath: string,
    manifest: ServiceAppManifest,
    runtime: Pick<RuntimeService, "getStatus">,
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
