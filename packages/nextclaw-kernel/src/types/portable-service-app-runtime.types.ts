import type { PortableRunnerHostCallRequest } from "@kernel/services/portable-service-runner-client.service.js";
import type { ServiceAppJobEventSink } from "@kernel/services/service-app-job-journal.service.js";
import type { ServiceAppManifest, ServiceAppRecord, ServiceAppRuntimeStatus } from "@kernel/types/service-app.types.js";

export type PortableRuntimeState = {
  status: ServiceAppRuntimeStatus;
  lastError?: string;
  lastStartedAt?: string;
  lastReadyAt?: string;
  lastFailedAt?: string;
};

export type PortablePersistentRegistration = { app: ServiceAppRecord; manifest: ServiceAppManifest };

export type PortableActiveHostJob = {
  controller: AbortController;
  pendingTerminalWork: Set<Promise<void>>;
  deadlineAt: number;
  terminalStatus?: "cancelled" | "timed-out";
  timeout?: NodeJS.Timeout;
};

export type PortableServiceAppHostCall = {
  app: ServiceAppRecord;
  manifest: ServiceAppManifest;
  request: PortableRunnerHostCallRequest;
  signal: AbortSignal;
  jobSignal?: AbortSignal;
  deferTerminal?: (completion: Promise<void>) => void;
  job?: { jobId: string; eventSink: ServiceAppJobEventSink; callId?: string; traceId?: string };
};

export type PortableServiceAppHostCallHandler = (call: PortableServiceAppHostCall) => Promise<unknown>;
