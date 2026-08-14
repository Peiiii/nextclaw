import type { ServiceAppRecord } from "@nextclaw/kernel";
import {
  createLocalUiApiClient,
  type UiApiClient,
} from "@nextclaw-cli/cli/app/services/local-api/local-ui-api-client.service.js";
import type {
  ServiceAppDevIssue,
  ServiceAppRestartReport,
} from "@nextclaw-cli/cli/app/types/service-app-dev.types.js";

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return String(error ?? "unknown error");
}

export class ServiceAppLiveRuntimeService {
  constructor(private readonly params: {
    createApiClient?: () => UiApiClient | null;
  } = {}) {}

  restart = async (appId: string): Promise<ServiceAppRestartReport> => {
    const target = appId.trim();
    const issues: ServiceAppDevIssue[] = [];
    if (!target) {
      issues.push({
        severity: "error",
        code: "service.id.invalid",
        message: "Service App id is required.",
      });
      return { ok: false, target, issues };
    }

    const apiClient = this.createApiClient();
    if (!apiClient) {
      issues.push({
        severity: "error",
        code: "service.runtime.notRunning",
        message: "NextClaw UI runtime is not running; start NextClaw before restarting a live Service App.",
      });
      return { ok: false, target, issues };
    }

    try {
      const app = await apiClient.request<ServiceAppRecord>({
        path: `/api/service-apps/${encodeURIComponent(target)}/restart`,
        method: "POST",
      });
      return {
        ok: true,
        target,
        app,
        issues,
      };
    } catch (error) {
      issues.push({
        severity: "error",
        code: "service.runtime.restartFailed",
        message: readErrorMessage(error),
      });
      return { ok: false, target, issues };
    }
  };

  private createApiClient = (): UiApiClient | null => {
    if (this.params.createApiClient) {
      return this.params.createApiClient();
    }
    return createLocalUiApiClient();
  };
}
