export type CronSchedule =
  | { kind: "at"; atMs?: number | null }
  | { kind: "every"; everyMs?: number | null }
  | { kind: "cron"; expr?: string | null; tz?: string | null };

export type CronPayload = {
  kind?: "system_event" | "agent_turn";
  message: string;
  deliver?: boolean;
  channel?: string | null;
  to?: string | null;
};

export type CronJobState = {
  nextRunAtMs?: number | null;
  lastRunAtMs?: number | null;
  lastStatus?: "ok" | "error" | "skipped" | null;
  lastError?: string | null;
};

export type CronJob = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  payload: CronPayload;
  state: CronJobState;
  createdAtMs: number;
  updatedAtMs: number;
  deleteAfterRun: boolean;
};

export type CronStore = {
  version: number;
  jobs: CronJob[];
};
