import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createInterface } from "node:readline";

export function startRunnerSession(binaryPath, options = {}) {
  return new RunnerSession(binaryPath, options);
}

class RunnerSession {
  pending = new Map();
  jobs = new RunnerJobState();

  constructor(binaryPath, options) {
    this.child = spawn(binaryPath, [], { stdio: ["pipe", "pipe", "pipe"] });
    this.request = createRequest({ child: this.child, pending: this.pending });
    const responseHostCall = createHostCallResponder(this.request);
    createInterface({ input: this.child.stdout }).on("line", (line) =>
      handleLine({ line, options, pending: this.pending, jobs: this.jobs, responseHostCall }));
  }

  waitForJob = (jobId, timeoutMs = 10_000) => this.jobs.waitFor(jobId, timeoutMs);
  eventsForJob = (jobId) => this.jobs.eventsFor(jobId);
  stop = async () => {
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    const exited = once(this.child, "exit");
    this.child.kill("SIGTERM");
    await exited;
  };
}

function createRequest({ child, pending }) {
  return (request) => {
    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(request.requestId);
        reject(new Error(`timed out waiting for ${request.operation}`));
      }, 10_000);
      pending.set(request.requestId, (value) => { clearTimeout(timer); resolve(value); });
    });
    child.stdin.write(`${JSON.stringify(request)}\n`);
    return response;
  };
}

function createHostCallResponder(request) {
  return (hostCall, resolution) => request({
    requestId: randomUUID(),
    operation: "resolve-host-call",
    hostCallId: hostCall.hostCallId,
    hostCallResult: resolution.error ? undefined : resolution.result,
    hostCallError: resolution.error,
  });
}

function handleLine(params) {
  const { line, options, pending, jobs, responseHostCall } = params;
  const response = JSON.parse(line);
  if (response.kind === "host-call-request") {
    void Promise.resolve(options.onHostCall?.(response)).then(
      (result) => responseHostCall(response, { result }),
      (error) => responseHostCall(response, { error: { code: error?.code || "HOST_CALL_FAILED", message: error?.message || "host callback failed" } }),
    );
    return;
  }
  if (response.kind === "job-terminal") {
    jobs.recordTerminal(response);
    return;
  }
  if (response.kind === "job-progress" || response.kind === "stream-chunk") {
    jobs.appendEvent(response);
    return;
  }
  pending.get(response.requestId)?.(response);
  pending.delete(response.requestId);
}

class RunnerJobState {
  jobWaiters = new Map();
  terminalEvents = new Map();
  jobEvents = new Map();

  eventsFor = (jobId) => [...(this.jobEvents.get(jobId) ?? [])];

  appendEvent = (response) => {
    const events = this.jobEvents.get(response.jobId) ?? [];
    this.jobEvents.set(response.jobId, [...events, response]);
  };

  recordTerminal = (response) => {
    this.appendEvent(response);
    const waiter = this.jobWaiters.get(response.jobId);
    if (!waiter) {
      this.terminalEvents.set(response.jobId, response);
      return;
    }
    waiter(response);
    this.jobWaiters.delete(response.jobId);
  };

  waitFor = (jobId, timeoutMs) => new Promise((resolve, reject) => {
    const terminal = this.terminalEvents.get(jobId);
    if (terminal) {
      this.terminalEvents.delete(jobId);
      resolve(terminal);
      return;
    }
    const timer = setTimeout(() => {
      this.jobWaiters.delete(jobId);
      reject(new Error(`timed out waiting for job ${jobId}`));
    }, timeoutMs);
    this.jobWaiters.set(jobId, (event) => { clearTimeout(timer); resolve(event); });
  });
}
