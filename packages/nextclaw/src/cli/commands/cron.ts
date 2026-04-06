import type { CronAddOptions } from "../types.js";
import { CronLocalService } from "./cron-support/cron-local.service.js";
import { printCronJobs, type CronJobView } from "./cron-support/cron-job.utils.js";
import { UiBridgeApiClient, resolveManagedApiBase } from "./shared/ui-bridge-api.service.js";

type CronListApiData = {
  jobs: CronJobView[];
};

type CronActionApiData = {
  deleted?: boolean;
  job?: CronJobView | null;
  executed?: boolean;
};

export class CronCommands {
  constructor(
    private readonly local = new CronLocalService()
  ) {}

  private readonly createApiClient = (): UiBridgeApiClient | null => {
    const apiBase = resolveManagedApiBase();
    if (!apiBase) {
      return null;
    }
    return new UiBridgeApiClient(apiBase);
  };

  readonly cronList = async (opts: { enabledOnly?: boolean }): Promise<void> => {
    const includeDisabled = opts.enabledOnly !== true;
    const apiClient = this.createApiClient();
    if (apiClient) {
      try {
        const query = includeDisabled ? "" : "?enabledOnly=1";
        const data = await apiClient.request<CronListApiData>({
          path: `/api/cron${query}`
        });
        printCronJobs(data.jobs);
        return;
      } catch {
        void 0;
      }
    }
    printCronJobs(this.local.list(includeDisabled));
  };

  readonly cronAdd = async (opts: CronAddOptions): Promise<void> => {
    const result = this.local.add(opts);
    if (!result.job) {
      console.error(result.error ?? "Error: Failed to add job");
      return;
    }
    console.log(`✓ Added job '${result.job.name}' (${result.job.id})`);
  };

  readonly cronRemove = async (jobId: string): Promise<void> => {
    const apiClient = this.createApiClient();
    if (apiClient) {
      try {
        const data = await apiClient.request<CronActionApiData>({
          path: `/api/cron/${encodeURIComponent(jobId)}`,
          method: "DELETE"
        });
        if (data.deleted) {
          console.log(`✓ Removed job ${jobId}`);
          return;
        }
      } catch {
        void 0;
      }
    }
    if (this.local.remove(jobId)) {
      console.log(`✓ Removed job ${jobId}`);
    } else {
      console.log(`Job ${jobId} not found`);
    }
  };

  readonly cronEnable = async (jobId: string, opts: { disable?: boolean }): Promise<void> => {
    const apiClient = this.createApiClient();
    const enabled = !opts.disable;
    if (apiClient) {
      try {
        const data = await apiClient.request<CronActionApiData>({
          path: `/api/cron/${encodeURIComponent(jobId)}/enable`,
          method: "PUT",
          body: { enabled }
        });
        if (data.job) {
          console.log(`✓ Job '${data.job.name}' ${opts.disable ? "disabled" : "enabled"}`);
          return;
        }
      } catch {
        void 0;
      }
    }
    const job = this.local.enable(jobId, enabled);
    if (job) {
      console.log(`✓ Job '${job.name}' ${opts.disable ? "disabled" : "enabled"}`);
    } else {
      console.log(`Job ${jobId} not found`);
    }
  };

  readonly cronRun = async (jobId: string, opts: { force?: boolean }): Promise<void> => {
    const apiClient = this.createApiClient();
    if (apiClient) {
      try {
        const data = await apiClient.request<CronActionApiData>({
          path: `/api/cron/${encodeURIComponent(jobId)}/run`,
          method: "POST",
          body: { force: Boolean(opts.force) }
        });
        console.log(data.executed ? "✓ Job executed" : `Failed to run job ${jobId}`);
        return;
      } catch {
        void 0;
      }
    }
    const ok = await this.local.run(jobId, Boolean(opts.force));
    console.log(ok ? "✓ Job executed" : `Failed to run job ${jobId}`);
  };
}
