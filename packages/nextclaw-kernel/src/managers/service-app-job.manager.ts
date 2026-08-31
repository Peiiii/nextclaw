import { createHash, randomUUID } from "node:crypto";
import type { AppPackageComponentSource } from "@kernel/types/app-package.types.js";
import type {
  ServiceAppJobJournalService,
  ServiceAppJobEventSink,
  ServiceAppJobScope,
} from "@kernel/services/service-app-job-journal.service.js";
import type {
  ServiceAppResidentEventInboxService,
  ResidentEventInput,
  ServiceAppResidentEventScope,
} from "@kernel/services/service-app-resident-event-inbox.service.js";
import type { VerificationRecordService } from "@kernel/services/verification-record.service.js";
import type { PortableRunnerObservation } from "@kernel/services/portable-service-runner-client.service.js";
import type {
  ServiceActionInvocationFacts,
  ServiceActionInvokeResult,
  ServiceAppJobCaller,
  ServiceAppJobList,
  ServiceAppJobView,
  ServiceAppJobWatch,
  ServiceAppManifest,
  ServiceAppRecord,
  ServiceAppResidentEventList,
  ServiceAppResidentEventView,
} from "@kernel/types/service-app.types.js";
import { ServiceAppError, toServiceAppRuntimeError } from "@kernel/utils/service-app-error.utils.js";
import type { VerificationRecordList } from "@kernel/types/verification-record.types.js";

type ServiceAppLookup = (appId: string, materializeStorage?: boolean) => Promise<{
  manifest: ServiceAppManifest;
  record: ServiceAppRecord;
}>;

type JobRuntime = {
  invokeAction: (params: {
    app: ServiceAppRecord; manifest: ServiceAppManifest; actionName: string;
    input: Record<string, unknown>;
    job: { jobId: string; eventSink: ServiceAppJobEventSink; callId: string; traceId: string };
  }) => Promise<unknown>;
  cancelJob?: (params: { appId: string; instanceId: string; jobId: string }) => Promise<void>;
  enqueueResidentEvent?: (params: {
    app: ServiceAppRecord; manifest: ServiceAppManifest; eventId: string;
    streamKey?: string; payload: Record<string, unknown>;
  }) => Promise<ServiceAppResidentEventView>;
  getLastObservation?: () => PortableRunnerObservation | undefined;
};

export class ServiceAppJobManager {
  constructor(private readonly params: {
    journal: ServiceAppJobJournalService;
    residentInbox: ServiceAppResidentEventInboxService;
    runtime: JobRuntime;
    verificationRecords?: VerificationRecordService;
    requireServiceApp: ServiceAppLookup;
    listPackageComponentSources: () => Promise<AppPackageComponentSource[]>;
  }) {}

  listVerificationRecords = async (filters: { acceptanceId?: string; appId?: string; limit?: number } = {}): Promise<VerificationRecordList> =>
    await this.params.verificationRecords?.list(filters) ?? { entries: [] };

  exportVerificationRecords = async (filters: { acceptanceId?: string; appId?: string; limit?: number } = {}): Promise<string> =>
    await this.params.verificationRecords?.export(filters) ?? "{\n  \"entries\": []\n}\n";

  list = async (appId: string, caller?: ServiceAppJobCaller): Promise<ServiceAppJobList> => {
    const jobs = await this.params.journal.list(await this.requireJobScope(appId));
    return caller ? { entries: jobs.entries.filter((job) => this.isVisible(job, caller)) } : jobs;
  };

  get = async (appId: string, jobId: string, caller?: ServiceAppJobCaller): Promise<ServiceAppJobView> => {
    const job = await this.params.journal.get(await this.requireJobScope(appId), jobId);
    this.assertVisible(job, caller);
    return job;
  };

  watch = async (appId: string, jobId: string, afterSequence?: number, caller?: ServiceAppJobCaller): Promise<ServiceAppJobWatch> => {
    const watch = await this.params.journal.watch(await this.requireJobScope(appId), jobId, afterSequence);
    this.assertVisible(watch.job, caller);
    return watch;
  };

  cancel = async (appId: string, jobId: string, caller?: ServiceAppJobCaller): Promise<ServiceAppJobView> => {
    const scope = await this.requireJobScope(appId);
    this.assertVisible(await this.params.journal.get(scope, jobId), caller);
    const job = await this.params.journal.requestCancel(scope, jobId);
    await this.params.runtime.cancelJob?.({ appId: job.appId, instanceId: job.instanceId, jobId });
    return job;
  };

  listResidentInbox = async (appId: string, deadLettersOnly = false): Promise<ServiceAppResidentEventList> =>
    await this.params.residentInbox.list(await this.requireResidentInboxScope(appId), { deadLettersOnly });

  replayResidentDeadLetter = async (appId: string, eventId: string): Promise<ServiceAppResidentEventView> =>
    await this.params.residentInbox.replayDeadLetter(await this.requireResidentInboxScope(appId), eventId);

  enqueueResidentEvent = async (appId: string, input: ResidentEventInput): Promise<ServiceAppResidentEventView> => {
    const { record, manifest } = await this.params.requireServiceApp(appId, true);
    if (!this.params.runtime.enqueueResidentEvent) throw new ServiceAppError("SERVICE_APP_RUNTIME_FAILED", "Resident event runtime is unavailable.");
    return await this.params.runtime.enqueueResidentEvent({ app: record, manifest, ...input });
  };

  create = async (params: {
    record: ServiceAppRecord; actionName: string; callId: string; traceId: string;
    caller?: ServiceAppJobCaller; retryOf?: string; jobId?: string;
  }): Promise<ServiceAppJobView> => {
    const { record, actionName, callId, traceId, caller, retryOf, jobId } = params;
    const scope = this.requireRecordScope(record);
    return await this.params.journal.queue(scope, {
      actionName, componentId: record.id, callId,
      traceId, caller, retryOf, jobId,
    });
  };

  createEventSink = (record: ServiceAppRecord, jobId: string): ServiceAppJobEventSink =>
    this.params.journal.createEventSink(this.requireRecordScope(record), jobId);

  invoke = async (params: {
    actionId: string; actionName: string; record: ServiceAppRecord; manifest: ServiceAppManifest;
    input: Record<string, unknown>; role: "panel" | "agent" | "cli";
    entrySurface: "panel" | "agent" | "installed-app-cli";
  }): Promise<ServiceActionInvokeResult> => {
    const { actionId, actionName, record, manifest, input, role } = params;
    const startedAt = new Date().toISOString();
    const facts: ServiceActionInvocationFacts = {
      callId: randomUUID(), traceId: randomUUID(), dataVersion: dataVersion(record), verificationRunId: randomUUID(),
    };
    const caller: ServiceAppJobCaller = { surface: role === "cli" ? "installed-app-cli" : role };
    const job = await this.create({ record, actionName, callId: facts.callId, traceId: facts.traceId, caller });
    const scope = this.requireRecordScope(record);
    await this.params.journal.transition(scope, job.id, "starting");
    await this.params.journal.transition(scope, job.id, "running");
    const eventSink = this.createEventSink(record, job.id);
    try {
      const result = await this.params.runtime.invokeAction({
        app: record, manifest, actionName,
        input, job: { jobId: job.id, eventSink, callId: facts.callId, traceId: facts.traceId },
      });
      if (!isTerminalJobStatus((await this.params.journal.get(scope, job.id)).status)) await eventSink.recordTerminal({ status: "succeeded" });
      await this.recordInvocation({ ...params, facts, startedAt, status: "passed", output: result });
      return { actionId, result, invocation: facts };
    } catch (error) {
      if (!isTerminalJobStatus((await this.params.journal.get(scope, job.id)).status)) {
        const code = readErrorCode(error);
        await eventSink.recordTerminal({
          status: code === "PORTABLE_RUNTIME_TIMEOUT" ? "timed-out" : "failed",
          error: { code, message: error instanceof Error ? error.message : "Service Action invocation failed." },
        });
      }
      await this.recordInvocation({ ...params, facts, startedAt, status: "failed", error });
      throw toServiceAppRuntimeError(error, record.id, actionName);
    }
  };

  private recordInvocation = async (params: {
    actionId: string; actionName: string; record: ServiceAppRecord; input: Record<string, unknown>;
    role: "panel" | "agent" | "cli"; entrySurface: "panel" | "agent" | "installed-app-cli";
    facts: ServiceActionInvocationFacts; startedAt: string; status: "passed" | "failed";
    output?: unknown; error?: unknown;
  }): Promise<void> => {
    if (!this.params.verificationRecords) return;
    const {
      actionId, actionName, record, input, role, entrySurface, facts, startedAt, status, output,
      error: invocationError,
    } = params;
    const observation = this.params.runtime.getLastObservation?.();
    const error = invocationError instanceof Error
      ? { code: readErrorCode(invocationError), message: redactErrorMessage(invocationError.message) }
      : invocationError === undefined ? undefined : { message: "Service Action invocation failed." };
    await this.params.verificationRecords.record({
      verificationRunId: facts.verificationRunId, acceptanceId: "PRT-ENTRY-001", scenarioVersion: "service-action-v1",
      status, startedAt, finishedAt: new Date().toISOString(),
      environment: `${process.platform}-${process.arch}`, appId: record.packageId ?? record.id,
      componentId: record.id, role, entrySurface,
      instanceId: record.instanceId, actionOrEvent: actionName,
      callId: facts.callId, traceId: facts.traceId,
      capabilityDecisions: capabilityDecisions(record), inputDigest: digest(input),
      outputDigest: status === "passed" ? digest(output) : undefined,
      dataVersion: facts.dataVersion,
      observation: observation ? { durationMs: observation.durationMs, runnerPid: observation.runnerPid, memory: observation.memory } : undefined,
      error, evidenceRefs: [actionId],
    });
  };

  private requireJobScope = async (appId: string): Promise<ServiceAppJobScope> => {
    const packageComponent = (await this.params.listPackageComponentSources())
      .find((component) => component.kind === "service" && component.packageId === appId);
    if (packageComponent) return { appId: packageComponent.packageId, instanceId: packageComponent.instanceId, stateDirectory: packageComponent.storage.stateDirectory };
    return this.requireRecordScope((await this.params.requireServiceApp(appId, true)).record);
  };

  private requireResidentInboxScope = async (appId: string): Promise<ServiceAppResidentEventScope> => {
    const packageComponent = (await this.params.listPackageComponentSources())
      .find((component) => component.kind === "service" && component.packageId === appId);
    if (packageComponent) return { appId: packageComponent.packageId, instanceId: packageComponent.instanceId, stateDirectory: packageComponent.storage.stateDirectory };
    const { record } = await this.params.requireServiceApp(appId, true);
    if (!record.storage?.stateDirectory || !record.instanceId) throw new ServiceAppError("SERVICE_APP_RUNTIME_FAILED", `Service App ${appId} is missing instance state storage for Resident events.`);
    return { appId: record.packageId ?? record.id, instanceId: record.instanceId, stateDirectory: record.storage.stateDirectory };
  };

  private requireRecordScope = (record: ServiceAppRecord): ServiceAppJobScope => {
    if (!record.storage?.stateDirectory || !record.instanceId) {
      throw new ServiceAppError("SERVICE_APP_RUNTIME_FAILED", `Service App ${record.id} is missing instance state storage for Job execution.`);
    }
    return { appId: record.packageId ?? record.id, instanceId: record.instanceId, stateDirectory: record.storage.stateDirectory };
  };

  private isVisible = (job: ServiceAppJobView, caller: ServiceAppJobCaller): boolean =>
    job.caller?.surface === caller.surface && job.caller.id === caller.id;

  private assertVisible = (job: ServiceAppJobView, caller?: ServiceAppJobCaller): void => {
    if (caller && !this.isVisible(job, caller)) throw new ServiceAppError("SERVICE_APP_JOB_NOT_FOUND", `Service App Job ${job.id} was not found.`);
  };
}

function isTerminalJobStatus(status: string): boolean {
  return ["succeeded", "cancelled", "timed-out", "failed", "interrupted"].includes(status);
}
function dataVersion(record: ServiceAppRecord): string {
  return record.storage ? `${record.storage.layout}:${record.storage.layoutVersion}` : "workspace-v1";
}
function capabilityDecisions(record: ServiceAppRecord): string[] {
  return [
    `runtime:${record.runtimeProfile ?? "workspace"}`, `isolation:${record.isolation ?? "workspace"}`,
    `storage:${record.permissions?.storage ? "granted" : "not-declared"}`,
    `network:${record.permissions?.allowedDomains?.length ? "granted" : "not-declared"}`,
  ];
}
function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
function canonicalJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}
function readErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}
function redactErrorMessage(message: string): string {
  return message.replace(/(?:Bearer|token|secret|password)\s+[^\s,;]+/gi, "[redacted]").slice(0, 500);
}
