import type { AppPermissions } from "@nextclaw/app-runtime";

export type PortableRunnerApp = {
  id: string;
  componentPath: string;
  dataDirectory: string;
  permissions: AppPermissions;
  fileMounts: PortableRunnerFileMount[];
  /** Values exist only in the kernel-to-runner control request. */
  secretVariables: Record<string, string>;
  /** Slot digests only invalidate a loaded factor lane. */
  secretFingerprints: Record<string, string>;
  providerIds?: string[];
};

export type PortableRunnerFileMount = {
  hostPath: string;
  guestPath: string;
  writable: boolean;
};

export type PortableRunnerAction = {
  name: string;
  title: string;
  description: string;
};

export type RunnerOperation =
  | "cancel-job"
  | "deliver-event"
  | "invoke"
  | "job-status"
  | "list-actions"
  | "start-provider"
  | "start-resident"
  | "start-job"
  | "resolve-host-call"
  | "stats"
  | "stop";

export type RunnerRequest = {
  requestId: string;
  operation: RunnerOperation;
  app?: {
    id: string;
    componentPath: string;
    dataDirectory: string;
    allowedDomains: string[];
    allowedProviderIds: string[];
    storageEnabled: boolean;
    fileMounts: PortableRunnerFileMount[];
    secretVariables: Record<string, string>;
    secretFingerprints: Record<string, string>;
  };
  actionName?: string;
  jobId?: string;
  cancelReason?: "timeout";
  input?: Record<string, unknown>;
  timeoutMs?: number;
  callId?: string;
  traceId?: string;
  hostCallId?: string;
  hostCallResult?: unknown;
  hostCallError?: { code: string; message: string };
};

export type RunnerResponse = {
  kind?: "response";
  requestId: string;
  protocolVersion?: string;
  ok: boolean;
  result?: unknown;
  error?: { code?: string; message?: string };
};

export type PortableRunnerJobEvent =
  | {
      kind: "job-progress";
      protocolVersion?: string;
      jobId: string;
      sequence: number;
      current?: number;
      total?: number;
      message?: string;
    }
  | {
      kind: "stream-chunk";
      protocolVersion?: string;
      jobId: string;
      sequence: number;
      content: string;
    }
  | {
      kind: "host-call-request";
      protocolVersion?: string;
      hostCallId: string;
      jobId: string;
      sequence: number;
      callId: string;
      traceId: string;
      appId: string;
      capability: string;
      input: unknown;
    }
  | {
      kind: "job-terminal";
      protocolVersion?: string;
      jobId: string;
      sequence: number;
      status: "succeeded" | "cancelled" | "timed-out" | "failed" | "interrupted";
      result?: unknown;
      error?: { code?: string; message?: string };
    };

export type RunnerOutput = RunnerResponse | PortableRunnerJobEvent;

export type PortableRunnerHostCallRequest = Extract<
  PortableRunnerJobEvent,
  { kind: "host-call-request" }
>;

export type PortableRunnerHostCallHandler = (
  request: PortableRunnerHostCallRequest,
  signal: AbortSignal,
) => Promise<unknown>;

export type PortableRunnerJob = {
  jobId: string;
  result: Promise<unknown>;
};

export type PortableRunnerObservation = {
  operation: RunnerOperation;
  appId?: string;
  durationMs: number;
  runnerPid: number | null;
  memory: { rssBytes: number | null; pssBytes: number | null } | null;
  logs: string[];
};
