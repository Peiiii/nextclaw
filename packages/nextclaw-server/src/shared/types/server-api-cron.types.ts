export type CronScheduleView =
  | { kind: "at"; atMs?: number | null }
  | { kind: "every"; everyMs?: number | null }
  | { kind: "cron"; expr?: string | null; tz?: string | null };

export type CronPayloadView = {
  kind?: "system_event" | "agent_turn";
  message: string;
  agentId?: string | null;
  sessionId?: string | null;
};

export type CronJobStateView = {
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastStatus?: "ok" | "error" | "skipped" | null;
  lastError?: string | null;
};

export type CronJobView = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronScheduleView;
  payload: CronPayloadView;
  state: CronJobStateView;
  createdAt: string;
  updatedAt: string;
  deleteAfterRun: boolean;
};

export type CronListStatus = "all" | "enabled" | "disabled" | "attention";

export type CronListQuery = {
  all?: boolean;
  limit?: number;
  offset?: number;
  query?: string;
  status?: CronListStatus;
};

export type CronListSummaryView = {
  total: number;
  enabled: number;
  disabled: number;
  attention: number;
};

export type CronListView = {
  jobs: CronJobView[];
  total: number;
  summary: CronListSummaryView;
};

export type CronCreateRequest = {
  name: string;
  message: string;
  schedule: CronScheduleView;
  agentId?: string | null;
  sessionId?: string | null;
  deleteAfterRun?: boolean;
};

export type CronCreateResult = { job: CronJobView };

export type CronEnableRequest = { enabled: boolean };

export type CronRunRequest = { force?: boolean };

export type CronActionResult = {
  job: CronJobView | null;
  executed?: boolean;
};
