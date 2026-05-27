import type {
  ServiceAction,
  ServiceActionGrant,
  ServiceActionInvokeResult,
  ServiceAppList,
  ServiceAppRecord,
} from "@nextclaw/kernel";

export type ServiceAppListView = ServiceAppList;
export type ServiceAppRecordView = ServiceAppRecord;
export type ServiceActionView = ServiceAction;
export type ServiceActionListView = { actions: ServiceActionView[] };
export type ServiceActionInvokeRequestView = { input?: Record<string, unknown> };
export type ServiceActionInvokeResultView = ServiceActionInvokeResult;
export type ServiceActionGrantView = ServiceActionGrant;
export type ServiceActionGrantListView = { grants: ServiceActionGrantView[] };
