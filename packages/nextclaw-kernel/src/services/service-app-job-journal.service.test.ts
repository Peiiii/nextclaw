import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ServiceAppJobJournalService,
  type ServiceAppJobScope,
} from "./service-app-job-journal.service.js";

const tempDirectories: string[] = [];

function createScope(): ServiceAppJobScope {
  const stateDirectory = mkdtempSync(path.join(tmpdir(), "nextclaw-service-job-journal-"));
  tempDirectories.push(stateDirectory);
  return { appId: "example.notes", instanceId: "instance-1", stateDirectory };
}

async function createRunningJob(
  journal: ServiceAppJobJournalService,
  scope: ServiceAppJobScope,
): Promise<string> {
  const job = await journal.queue(scope, {
    actionName: "sync",
    callId: "call-1",
    traceId: "trace-1",
    jobId: "job-1",
  });
  await journal.transition(scope, job.id, "starting");
  await journal.transition(scope, job.id, "running");
  return job.id;
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

describe("ServiceAppJobJournalService", () => {
  it("persists a bounded per-instance event journal and replays it by sequence", async () => {
    const scope = createScope();
    const journal = new ServiceAppJobJournalService();
    const jobId = await createRunningJob(journal, scope);

    await journal.reportProgress(scope, jobId, { current: 1, total: 2, message: "starting" });
    await journal.emitChunk(scope, jobId, "first result");
    await journal.recordTerminal(scope, jobId, { status: "succeeded" });

    const replay = await journal.watch(scope, jobId, 1);
    expect(replay.job.status).toBe("succeeded");
    expect(replay.events.map((event) => event.type)).toEqual(["stream-chunk", "terminal"]);
    expect(replay.events.map((event) => event.sequence)).toEqual([2, 3]);
    expect(replay.cursor).toBe(3);

    const restarted = new ServiceAppJobJournalService();
    await expect(restarted.get(scope, jobId)).resolves.toMatchObject({
      status: "succeeded", callId: "call-1", traceId: "trace-1",
    });
  });

  it("never rewrites a terminal job and leaves cancellation pending until the runner reports a terminal fact", async () => {
    const scope = createScope();
    const journal = new ServiceAppJobJournalService();
    const jobId = await createRunningJob(journal, scope);

    await expect(journal.requestCancel(scope, jobId)).resolves.toMatchObject({ status: "cancel-requested" });
    await expect(journal.get(scope, jobId)).resolves.toMatchObject({ status: "cancel-requested" });
    await journal.recordTerminal(scope, jobId, { status: "cancelled" });
    await expect(journal.recordTerminal(scope, jobId, { status: "succeeded" }))
      .rejects.toMatchObject({ code: "SERVICE_APP_JOB_TERMINAL" });
  });

  it("marks unfinished work interrupted on host restart without replaying it", async () => {
    const scope = createScope();
    const first = new ServiceAppJobJournalService();
    const jobId = await createRunningJob(first, scope);

    const restarted = new ServiceAppJobJournalService();
    await restarted.recoverUnfinished([scope]);

    await expect(restarted.get(scope, jobId)).resolves.toMatchObject({
      status: "interrupted",
      error: { code: "HOST_RESTARTED" },
    });
  });

  it("expires cursors that fall outside the retained event window", async () => {
    const scope = createScope();
    const journal = new ServiceAppJobJournalService();
    const jobId = await createRunningJob(journal, scope);

    for (let index = 0; index < 257; index += 1) {
      await journal.emitChunk(scope, jobId, `chunk-${index}`);
    }

    await expect(journal.watch(scope, jobId, 0))
      .rejects.toMatchObject({ code: "STREAM_CURSOR_EXPIRED" });
    await expect(journal.watch(scope, jobId, 1)).resolves.toMatchObject({
      events: expect.any(Array),
    });
  });
});
