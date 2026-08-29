import type { ServiceAction, ServiceAppRecord } from "@nextclaw/kernel";
import type { PortableRunnerObservation } from "@nextclaw/kernel";

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
  observation?: PortableRunnerObservation;
  issues: ServiceAppDevIssue[];
};

export type ServiceAppRestartReport = {
  ok: boolean;
  target: string;
  app?: ServiceAppRecord;
  issues: ServiceAppDevIssue[];
};

export type ServiceAppDevCommandOptions = {
  component?: string;
  json?: boolean;
  resetData?: boolean;
  confirm?: string;
};

export type ServiceAppCallCommandOptions = {
  component?: string;
  input?: string;
  json?: boolean;
};

export type ServiceAppRestartCommandOptions = {
  json?: boolean;
};
