import type {
  AppDocumentGrantMutationResult,
  AppInstalledPermissionState,
  AppPackageDependencyBindingInput,
  AppPackageDependencyView,
  AppPackageList,
  AppPackageOperationList,
  AppPackageOperationView,
  AppPackageSecretReadiness,
  AppPackageView,
  PortableRuntimeAcceptanceContractView,
  PortableRuntimeAcceptanceStatusView,
  ServiceActionInvokeResult,
  ServiceAppJobList,
  ServiceAppJobView,
  ServiceAppJobWatch,
  ServiceAppResidentEventList,
  ServiceAppResidentEventView,
  VerificationRecordList,
} from "@nextclaw/kernel";
import {
  createLocalUiApiClient,
  type UiApiClient,
} from "@nextclaw-cli/cli/app/services/local-api/local-ui-api-client.service.js";
import path from "node:path";

export class AppPackageLiveService {
  constructor(
    private readonly params: {
      createApiClient?: () => UiApiClient | null;
    } = {},
  ) {}

  list = async (): Promise<AppPackageList> =>
    await this.requireApiClient().request<AppPackageList>({
      path: "/api/app-packages",
    });

  info = async (appId: string): Promise<AppPackageView> =>
    await this.requireApiClient().request<AppPackageView>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}`,
    });

  inspectDocumentAccess = async (
    appId: string,
  ): Promise<AppInstalledPermissionState> =>
    await this.requireApiClient().request<AppInstalledPermissionState>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/document-access`,
    });

  grantDocumentAccess = async (
    appId: string,
    input: {
      scopeId: string;
      directoryPath: string;
      mode: "read" | "read-write";
    },
  ): Promise<AppDocumentGrantMutationResult> =>
    await this.requireApiClient().request<AppDocumentGrantMutationResult>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/document-access/grant`,
      method: "POST",
      body: input,
    });

  revokeDocumentAccess = async (
    appId: string,
    scopeId: string,
  ): Promise<AppDocumentGrantMutationResult> =>
    await this.requireApiClient().request<AppDocumentGrantMutationResult>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/document-access/revoke`,
      method: "POST",
      body: { scopeId: this.requireValue(scopeId, "Document scope") },
    });

  listOperations = async (): Promise<AppPackageOperationList> =>
    await this.requireApiClient().request<AppPackageOperationList>({
      path: "/api/app-package-operations",
    });

  inspectDependencies = async (
    appId: string,
  ): Promise<AppPackageDependencyView> =>
    await this.requireApiClient().request<AppPackageDependencyView>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/dependencies`,
    });

  verifyDependencies = async (
    appId: string,
  ): Promise<AppPackageDependencyView> =>
    await this.requireApiClient().request<AppPackageDependencyView>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/dependencies/verify`,
    });

  setupDependencies = async (
    appId: string,
  ): Promise<AppPackageDependencyView> =>
    await this.requireApiClient().request<AppPackageDependencyView>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/dependencies/setup`,
      method: "POST",
    });

  bindDependency = async (
    appId: string,
    input: AppPackageDependencyBindingInput,
  ): Promise<AppPackageDependencyView> =>
    await this.requireApiClient().request<AppPackageDependencyView>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/dependencies/bind`,
      method: "POST",
      body: input,
    });

  unbindDependency = async (
    appId: string,
    input: Omit<AppPackageDependencyBindingInput, "providerId">,
  ): Promise<AppPackageDependencyView> =>
    await this.requireApiClient().request<AppPackageDependencyView>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/dependencies/unbind`,
      method: "POST",
      body: input,
    });

  inspectSecrets = async (appId: string): Promise<AppPackageSecretReadiness> =>
    await this.requireApiClient().request<AppPackageSecretReadiness>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/secrets`,
    });

  inspectAiCapabilities = async (appId: string): Promise<unknown> =>
    await this.requireApiClient().request({
      path: `/api/service-apps/${encodeURIComponent(this.requireId(appId))}/ai-capabilities`,
    });

  verifyAiCapabilities = async (appId: string): Promise<unknown> =>
    await this.requireApiClient().request({
      path: `/api/service-apps/${encodeURIComponent(this.requireId(appId))}/ai-capabilities/verify`,
      method: "POST",
    });

  bindAiCapability = async (
    appId: string,
    input: { kind: "model" | "agent"; slotId: string; targetId: string },
  ): Promise<unknown> =>
    await this.requireApiClient().request({
      path: `/api/service-apps/${encodeURIComponent(this.requireId(appId))}/ai-capabilities/bind`,
      method: "POST",
      body: input,
    });

  unbindAiCapability = async (
    appId: string,
    input: { kind: "model" | "agent"; slotId: string },
  ): Promise<unknown> =>
    await this.requireApiClient().request({
      path: `/api/service-apps/${encodeURIComponent(this.requireId(appId))}/ai-capabilities/unbind`,
      method: "POST",
      body: input,
    });

  verifySecrets = async (appId: string): Promise<AppPackageSecretReadiness> =>
    await this.requireApiClient().request<AppPackageSecretReadiness>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/secrets/verify`,
      method: "POST",
    });

  bindSecret = async (
    appId: string,
    input: {
      slotId: string;
      source: "env" | "file" | "exec";
      provider?: string;
      id: string;
    },
  ): Promise<AppPackageSecretReadiness> =>
    await this.requireApiClient().request<AppPackageSecretReadiness>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/secrets/bind`,
      method: "POST",
      body: input,
    });

  unbindSecret = async (
    appId: string,
    slotId: string,
  ): Promise<AppPackageSecretReadiness> =>
    await this.requireApiClient().request<AppPackageSecretReadiness>({
      path: `/api/app-packages/${encodeURIComponent(this.requireId(appId))}/secrets/unbind`,
      method: "POST",
      body: { slotId: this.requireValue(slotId, "Secret slot") },
    });

  install = async (
    source: string,
    registryUrl?: string,
  ): Promise<AppPackageOperationView> =>
    await this.requireApiClient().request<AppPackageOperationView>({
      path: "/api/app-package-operations/install",
      method: "POST",
      body: { source: this.normalizeInstallSource(source), registryUrl },
    });

  enable = async (appId: string): Promise<AppPackageView> =>
    await this.changeEnabled(appId, "enable");

  disable = async (appId: string): Promise<AppPackageView> =>
    await this.changeEnabled(appId, "disable");

  invoke = async (
    appId: string,
    actionName: string,
    input: Record<string, unknown>,
  ): Promise<ServiceActionInvokeResult> =>
    await this.requireApiClient().request<ServiceActionInvokeResult>({
      path: `/api/service-apps/${encodeURIComponent(this.requireId(appId))}/actions/${encodeURIComponent(this.requireValue(actionName, "Action name"))}/invoke`,
      method: "POST",
      body: { input },
    });

  listJobs = async (appId: string): Promise<ServiceAppJobList> =>
    await this.requireApiClient().request<ServiceAppJobList>({
      path: `/api/service-apps/${encodeURIComponent(this.requireId(appId))}/jobs`,
    });

  inspectJob = async (
    appId: string,
    jobId: string,
  ): Promise<ServiceAppJobView> =>
    await this.requireApiClient().request<ServiceAppJobView>({
      path: `/api/service-apps/${encodeURIComponent(this.requireId(appId))}/jobs/${encodeURIComponent(this.requireValue(jobId, "Job id"))}`,
    });

  watchJob = async (
    appId: string,
    jobId: string,
    afterSequence?: number,
  ): Promise<ServiceAppJobWatch> => {
    const query =
      afterSequence === undefined ? "" : `?afterSequence=${afterSequence}`;
    return await this.requireApiClient().request<ServiceAppJobWatch>({
      path: `/api/service-apps/${encodeURIComponent(this.requireId(appId))}/jobs/${encodeURIComponent(this.requireValue(jobId, "Job id"))}/watch${query}`,
    });
  };

  cancelJob = async (
    appId: string,
    jobId: string,
  ): Promise<ServiceAppJobView> =>
    await this.requireApiClient().request<ServiceAppJobView>({
      path: `/api/service-apps/${encodeURIComponent(this.requireId(appId))}/jobs/${encodeURIComponent(this.requireValue(jobId, "Job id"))}/cancel`,
      method: "POST",
    });

  listResidentInbox = async (
    appId: string,
    deadLettersOnly = false,
  ): Promise<ServiceAppResidentEventList> =>
    await this.requireApiClient().request<ServiceAppResidentEventList>({
      path: `/api/service-apps/${encodeURIComponent(this.requireId(appId))}/resident-inbox${deadLettersOnly ? "?deadLetters=true" : ""}`,
    });

  replayResidentDeadLetter = async (
    appId: string,
    eventId: string,
  ): Promise<ServiceAppResidentEventView> =>
    await this.requireApiClient().request<ServiceAppResidentEventView>({
      path: `/api/service-apps/${encodeURIComponent(this.requireId(appId))}/resident-inbox/${encodeURIComponent(this.requireValue(eventId, "Event id"))}/replay`,
      method: "POST",
    });

  listVerificationRecords = async (
    filters: {
      acceptanceId?: string;
      appId?: string;
      limit?: number;
    } = {},
  ): Promise<VerificationRecordList> => {
    const query = new URLSearchParams();
    if (filters.acceptanceId?.trim())
      query.set("acceptanceId", filters.acceptanceId.trim());
    if (filters.appId?.trim()) query.set("appId", filters.appId.trim());
    if (filters.limit !== undefined) query.set("limit", String(filters.limit));
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return await this.requireApiClient().request<VerificationRecordList>({
      path: `/api/runtime-verification-records${suffix}`,
    });
  };

  portableRuntimeAcceptanceContract = async (
    locale?: "zh-CN" | "en",
  ): Promise<PortableRuntimeAcceptanceContractView> =>
    await this.requireApiClient().request<PortableRuntimeAcceptanceContractView>(
      {
        path: `/api/portable-runtime/acceptance/contract${locale === "en" ? "?locale=en" : ""}`,
      },
    );

  portableRuntimeAcceptanceStatus = async (
    params: {
      appId?: string;
      locale?: "zh-CN" | "en";
    } = {},
  ): Promise<PortableRuntimeAcceptanceStatusView> =>
    await this.requireApiClient().request<PortableRuntimeAcceptanceStatusView>({
      path: this.portableRuntimeAcceptancePath("status", params),
    });

  exportPortableRuntimeAcceptance = async (
    params: {
      appId?: string;
      locale?: "zh-CN" | "en";
    } = {},
  ): Promise<PortableRuntimeAcceptanceStatusView> =>
    await this.requireApiClient().request<PortableRuntimeAcceptanceStatusView>({
      path: this.portableRuntimeAcceptancePath("export", params),
    });

  update = async (
    appId: string,
    options: { version?: string; registryUrl?: string },
  ): Promise<AppPackageOperationView> =>
    await this.requireApiClient().request<AppPackageOperationView>({
      path: `/api/app-package-operations/${encodeURIComponent(this.requireId(appId))}/update`,
      method: "POST",
      body: options,
    });

  rollback = async (
    appId: string,
    version: string,
  ): Promise<AppPackageOperationView> =>
    await this.requireApiClient().request<AppPackageOperationView>({
      path: `/api/app-package-operations/${encodeURIComponent(this.requireId(appId))}/rollback`,
      method: "POST",
      body: { version: this.requireVersion(version) },
    });

  uninstall = async (
    appId: string,
    purgeData: boolean,
  ): Promise<AppPackageOperationView> =>
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

  private requireId = (value: string): string =>
    this.requireValue(value, "App id");

  private requireSource = (value: string): string =>
    this.requireValue(value, "App install source");

  private normalizeInstallSource = (value: string): string => {
    const source = this.requireSource(value);
    return this.looksLikeLocalPath(source) ? path.resolve(source) : source;
  };

  private looksLikeLocalPath = (value: string): boolean =>
    value.startsWith(".") ||
    path.isAbsolute(value) ||
    value.includes(path.sep) ||
    value.endsWith(".napp");

  private portableRuntimeAcceptancePath = (
    action: "status" | "export",
    params: { appId?: string; locale?: "zh-CN" | "en" },
  ): string => {
    const query = new URLSearchParams();
    if (params.appId?.trim()) query.set("appId", params.appId.trim());
    if (params.locale === "en") query.set("locale", "en");
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return `/api/portable-runtime/acceptance/${action}${suffix}`;
  };

  private requireVersion = (value: string): string =>
    this.requireValue(value, "App version");

  private requireValue = (value: string, name: string): string => {
    const normalized = value.trim();
    if (!normalized) throw new Error(`${name} is required.`);
    return normalized;
  };
}
