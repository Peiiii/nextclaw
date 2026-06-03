import type {
  ServiceAction,
  ServiceAppRecord,
} from "@nextclaw/kernel";

export type ServiceAppDevIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  fixHint?: string;
};

export type ServiceAppDevReport = {
  ok: boolean;
  target: string;
  app?: ServiceAppRecord;
  actions: ServiceAction[];
  issues: ServiceAppDevIssue[];
};

export type ServiceAppCallReport = {
  ok: boolean;
  target: string;
  actionId?: string;
  app?: ServiceAppRecord;
  result?: unknown;
  issues: ServiceAppDevIssue[];
};

export type ServiceAppDevCommandOptions = {
  json?: boolean;
};

export type ServiceAppCallCommandOptions = {
  input?: string;
  json?: boolean;
};
