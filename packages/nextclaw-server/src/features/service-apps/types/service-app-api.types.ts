import type {
  ServiceAction,
  ServiceActionGrant,
  ServiceActionInvokeResult,
  ServiceAppDeleteResult,
  ServiceAppJobList,
  ServiceAppJobView,
  ServiceAppJobWatch,
  ServiceAppList,
  ServiceAppRecord,
  PortableRuntimeAcceptanceContractView,
  PortableRuntimeAcceptanceStatusView,
  VerificationRecordList,
} from "@nextclaw/kernel";

export type ServiceAppListView = ServiceAppList;
export type ServiceAppRecordView = ServiceAppRecord;
export type ServiceAppDeleteResultView = ServiceAppDeleteResult;
export type ServiceActionView = ServiceAction;
export type ServiceActionListView = { actions: ServiceActionView[] };
export type ServiceActionInvokeRequestView = { input?: Record<string, unknown> };
export type ServiceActionInvokeResultView = ServiceActionInvokeResult;
export type ServiceActionGrantView = ServiceActionGrant;
export type ServiceActionGrantBatchRequestView = { actionIds?: string[] };
export type ServiceActionGrantListView = { grants: ServiceActionGrantView[] };
export type ServiceAppJobListView = ServiceAppJobList;
export type ServiceAppJobViewResponse = ServiceAppJobView;
export type ServiceAppJobWatchView = ServiceAppJobWatch;
export type RuntimeVerificationRecordListView = VerificationRecordList;
export type PortableRuntimeAcceptanceContractApiView = PortableRuntimeAcceptanceContractView;
export type PortableRuntimeAcceptanceStatusApiView = PortableRuntimeAcceptanceStatusView;
export type PortableRuntimeAcceptanceExportApiView = PortableRuntimeAcceptanceStatusView;
