import type {
  AppPackageDependencyBindingInput,
  AppPackageDependencyView,
  AppPackageList,
  AppPackageOperationList,
  AppPackageOperationView,
  AppPackageSecretReadiness,
  AppPackageView,
  PortableRuntimeAcceptanceContractView,
  PortableRuntimeAcceptanceStatusView,
  ServiceAppJobList,
  ServiceAppJobView,
  ServiceAppJobWatch,
  ServiceAppResidentEventList,
  ServiceAppResidentEventView,
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

  inspectDependencies = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.inspectDependencies(appId), options, this.formatDependencyView);

  verifyDependencies = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.verifyDependencies(appId), options, this.formatDependencyView);

  setupDependencies = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.setupDependencies(appId), options, this.formatDependencyView);

  bindDependency = async (
    appId: string,
    options: AppPackageDependencyBindingInput & JsonOptions,
  ): Promise<void> => {
    const { componentId, requirementKind, requirementId, providerId } = options;
    this.write(await this.liveService.bindDependency(appId, {
      componentId, requirementKind, requirementId, providerId,
    }), options, this.formatDependencyView);
  };

  unbindDependency = async (
    appId: string,
    options: Omit<AppPackageDependencyBindingInput, "providerId"> & JsonOptions,
  ): Promise<void> =>
    this.write(await this.liveService.unbindDependency(appId, {
      componentId: options.componentId,
      requirementKind: options.requirementKind,
      requirementId: options.requirementId,
    }), options, this.formatDependencyView);

  inspectSecrets = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.inspectSecrets(appId), options, this.formatSecretReadiness);

  inspectAiCapabilities = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.inspectAiCapabilities(appId), options, (value) => JSON.stringify(value, null, 2));

  verifyAiCapabilities = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.verifyAiCapabilities(appId), options, (value) => JSON.stringify(value, null, 2));

  bindAiCapability = async (appId: string, options: { kind: "model" | "agent"; slot: string; target: string; json?: boolean }): Promise<void> =>
    this.write(await this.liveService.bindAiCapability(appId, {
      kind: options.kind, slotId: options.slot, targetId: options.target,
    }), options, (value) => JSON.stringify(value, null, 2));

  unbindAiCapability = async (appId: string, options: { kind: "model" | "agent"; slot: string; json?: boolean }): Promise<void> =>
    this.write(await this.liveService.unbindAiCapability(appId, {
      kind: options.kind, slotId: options.slot,
    }), options, (value) => JSON.stringify(value, null, 2));

  verifySecrets = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.verifySecrets(appId), options, this.formatSecretReadiness);

  bindSecret = async (appId: string, options: {
    slot: string;
    source: "env" | "file" | "exec";
    provider?: string;
    id: string;
    json?: boolean;
  }): Promise<void> => {
    const { slot, source, provider, id } = options;
    this.write(await this.liveService.bindSecret(appId, {
      slotId: slot,
      source,
      provider,
      id,
    }), options, this.formatSecretReadiness);
  };

  unbindSecret = async (appId: string, options: { slot: string; json?: boolean }): Promise<void> =>
    this.write(await this.liveService.unbindSecret(appId, options.slot), options, this.formatSecretReadiness);

  operations = async (options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.listOperations(), options, this.formatOperations);

  install = async (source: string, options: { registry?: string; json?: boolean }): Promise<void> =>
    this.write(await this.liveService.install(source, options.registry), options, this.formatOperation);

  enable = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.enable(appId), options, this.formatApp);

  disable = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.disable(appId), options, this.formatApp);

  invoke = async (appId: string, actionName: string, options: {
    input?: string;
    json?: boolean;
  }): Promise<void> => {
    const input = this.readInput(options.input);
    this.write(await this.liveService.invoke(appId, actionName, input), options, (result) => [
      `Installed App action ${result.actionId}`,
      `  call: ${result.invocation?.callId ?? "-"}`,
      `  trace: ${result.invocation?.traceId ?? "-"}`,
      `  data version: ${result.invocation?.dataVersion ?? "-"}`,
      `  verification: ${result.invocation?.verificationRunId ?? "-"}`,
      `  result: ${JSON.stringify(result.result)}`,
    ].join("\n") + "\n");
  };

  verificationRecords = async (options: {
    acceptance?: string;
    app?: string;
    limit?: string;
    json?: boolean;
  }): Promise<void> => {
    const { acceptance, app, limit: rawLimit } = options;
    const limit = rawLimit === undefined ? undefined : Number(rawLimit);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      throw new Error("--limit must be a positive integer.");
    }
    this.write(await this.liveService.listVerificationRecords({
      acceptanceId: acceptance,
      appId: app,
      limit,
    }), options, (result) => result.entries.length === 0
      ? "Verification records: none\n"
      : `${result.entries.map((record) =>
        `${record.acceptanceId} ${record.status} ${record.entrySurface} ${record.actionOrEvent} ${record.verificationRunId}`,
      ).join("\n")}\n`);
  };

  acceptanceContract = async (options: { locale?: "zh-CN" | "en"; json?: boolean }): Promise<void> =>
    this.write(
      await this.liveService.portableRuntimeAcceptanceContract(options.locale),
      options,
      this.formatAcceptanceContract,
    );

  acceptanceStatus = async (options: { app?: string; locale?: "zh-CN" | "en"; json?: boolean }): Promise<void> =>
    this.write(
      await this.liveService.portableRuntimeAcceptanceStatus({ appId: options.app, locale: options.locale }),
      options,
      this.formatAcceptanceStatus,
    );

  acceptanceExport = async (options: { app?: string; locale?: "zh-CN" | "en"; json?: boolean }): Promise<void> =>
    this.write(
      await this.liveService.exportPortableRuntimeAcceptance({ appId: options.app, locale: options.locale }),
      { ...options, json: true },
      (value) => `${JSON.stringify(value, null, 2)}\n`,
    );

  listJobs = async (appId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.listJobs(appId), options, this.formatJobList);

  inspectJob = async (appId: string, jobId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.inspectJob(appId, jobId), options, this.formatJob);

  watchJob = async (appId: string, jobId: string, options: {
    after?: string;
    json?: boolean;
  }): Promise<void> => {
    const afterSequence = this.readAfterSequence(options.after);
    this.write(
      await this.liveService.watchJob(appId, jobId, afterSequence),
      options,
      this.formatJobWatch,
    );
  };

  cancelJob = async (appId: string, jobId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.cancelJob(appId, jobId), options, this.formatJob);

  listResidentInbox = async (appId: string, options: { deadLetters?: boolean; json?: boolean }): Promise<void> =>
    this.write(
      await this.liveService.listResidentInbox(appId, options.deadLetters === true),
      options,
      this.formatResidentInbox,
    );

  replayResidentDeadLetter = async (appId: string, eventId: string, options: JsonOptions): Promise<void> =>
    this.write(await this.liveService.replayResidentDeadLetter(appId, eventId), options, this.formatResidentEvent);

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
    `  readiness: ${app.readiness.status}`,
    ...app.readiness.requirements.map((requirement) =>
      `  requirement: ${requirement.kind} ${requirement.title} (${requirement.id})`,
    ),
    `  built-in: ${app.builtIn ? "yes" : "no"}`,
    `  versions: ${app.installedVersions.join(", ")}`,
  ].join("\n") + "\n";

  private formatOperations = (result: AppPackageOperationList): string => {
    if (result.entries.length === 0) return "App operations: none\n";
    return `${result.entries.map((operation) => this.formatOperation(operation).trim()).join("\n\n")}\n`;
  };

  private formatAcceptanceContract = (result: PortableRuntimeAcceptanceContractView): string => [
    `Portable runtime acceptance contract ${result.contractFingerprint}`,
    ...result.definitions.map((definition) =>
      `  ${definition.id} [${definition.category}] ${definition.presentation.title}`,
    ),
  ].join("\n") + "\n";

  private formatAcceptanceStatus = (result: PortableRuntimeAcceptanceStatusView): string => [
    `Portable runtime acceptance status for ${result.appId}`,
    result.identity.available
      ? `  product: ${result.identity.context.productVersion}; runtime: ${result.identity.context.runtimeVersion} (${result.identity.runtimeVersionSource})`
      : `  identity unavailable: ${result.identity.reason}`,
    `  contract: ${result.contract.contractFingerprint}`,
    ...result.entries.map((entry) =>
      `  ${entry.id} ${entry.result.status} ${entry.presentation.title}${entry.result.latestRecord ? ` (${entry.result.latestRecord.finishedAt})` : ""}`,
    ),
  ].join("\n") + "\n";

  private formatJobList = (result: ServiceAppJobList): string => result.entries.length === 0
    ? "App jobs: none\n"
    : `${result.entries.map((job) => this.formatJob(job).trim()).join("\n\n")}\n`;

  private formatJob = (job: ServiceAppJobView): string => [
    `App job ${job.id}`,
    `  status: ${job.status}`,
    `  action: ${job.componentId}.${job.actionName}`,
    `  call: ${job.callId}`,
    `  trace: ${job.traceId}`,
    job.error ? `  error: ${job.error.code ?? "JOB_FAILED"} ${job.error.message}` : "",
  ].filter(Boolean).join("\n") + "\n";

  private formatJobWatch = (result: ServiceAppJobWatch): string => [
    this.formatJob(result.job).trim(),
    `  cursor: ${result.cursor}`,
    ...result.events.map((event) => `  [${event.sequence}] ${event.type}`),
  ].join("\n") + "\n";

  private formatResidentInbox = (result: ServiceAppResidentEventList): string => result.entries.length === 0
    ? `Resident inbox: none${result.frozen ? " (frozen)" : ""}\n`
    : `${result.entries.map((event) => this.formatResidentEvent(event).trim()).join("\n\n")}\n`;

  private formatResidentEvent = (event: ServiceAppResidentEventView): string => [
    `Resident event ${event.eventId}`,
    `  status: ${event.status}`,
    `  stream: ${event.streamKey} #${event.sequence}`,
    `  attempt: ${event.attempt}`,
    event.lastError ? `  error: ${event.lastError.code ?? "RESIDENT_RETRY"} ${event.lastError.message}` : "",
  ].filter(Boolean).join("\n") + "\n";

  private formatDependencyView = (
    result: AppPackageDependencyView,
  ): string => [
    `Dependency readiness: ${result.readiness.status}`,
    ...result.readiness.requirements.map((requirement) =>
      `  requirement: ${requirement.componentId}/${requirement.kind}/${requirement.id}`,
    ),
    ...result.bindings.map((binding) =>
      `  binding: ${binding.componentId}/${binding.requirementKind}/${binding.requirementId} -> ${binding.providerId}`,
    ),
  ].join("\n") + "\n";

  private formatSecretReadiness = (result: AppPackageSecretReadiness): string => [
    `Secret readiness: ${result.readiness.status}`,
    ...result.slots.map((slot) =>
      `  slot: ${slot.id} ${slot.status}${slot.binding ? ` (${slot.binding.source}/${slot.binding.provider ?? slot.binding.source}/${slot.binding.id})` : ""}${slot.errorCode ? ` [${slot.errorCode}]` : ""}`,
    ),
  ].join("\n") + "\n";

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

  private readInput = (raw: string | undefined): Record<string, unknown> => {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("--input must be a JSON object.");
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new Error(error instanceof Error && error.message === "--input must be a JSON object."
        ? error.message
        : `--input is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  private readAfterSequence = (raw: string | undefined): number | undefined => {
    if (raw === undefined) return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("--after must be a non-negative integer.");
    }
    return value;
  };
}
