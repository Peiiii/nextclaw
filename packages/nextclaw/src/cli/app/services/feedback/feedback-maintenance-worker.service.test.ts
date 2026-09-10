import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupportReport } from "@nextclaw/shared";
import {
  FeedbackMaintenanceStateStore,
  type FeedbackMaintenanceJournal,
} from "@nextclaw-cli/cli/app/stores/feedback/feedback-maintenance-state.store.js";
import {
  FeedbackMaintenanceWorkerService,
  selectFeedbackTriggerEvent,
} from "./feedback-maintenance-worker.service.js";

const report = (patch: Partial<SupportReport> = {}): SupportReport => ({
  id: "ticket-1",
  title: "Bug",
  description: "Broken",
  environment: "",
  version: "",
  status: "received",
  kind: "bug",
  priority: 1,
  authority: "repair",
  identity: "verified",
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:02.000Z",
  revision: 2,
  inputVersion: 1,
  runId: null,
  attempts: 0,
  messages: [],
  release: null,
  evidence: "",
  relatedUrl: null,
  approval: {
    inputVersion: 1,
    authority: "repair",
    reviewedAt: "2026-09-10T00:00:01.000Z",
  },
  ...patch,
});
const journal = (): FeedbackMaintenanceJournal => ({
  version: 1,
  engaged: {},
  events: {},
});

describe("feedback maintenance event selection", () => {
  it("requires approval for a first trigger and uses stable identities", () => {
    expect(
      selectFeedbackTriggerEvent([report({ approval: null })], journal())
    ).toBeNull();
    expect(selectFeedbackTriggerEvent([report()], journal())).toMatchObject({
      eventId: "approval:ticket-1:1:2026-09-10T00:00:01.000Z",
      feedbackId: "ticket-1",
      kind: "approved",
      revision: 2,
    });
  });

  it("delivers only new user messages for an engaged ticket and ignores maintainer replies", () => {
    const state = journal();
    state.engaged["ticket-1"] = "2026-09-10T00:00:05.000Z";
    const value = report({
      approval: null,
      inputVersion: 3,
      messages: [
        {
          id: "old",
          role: "user",
          body: "before activation",
          createdAt: "2026-09-10T00:00:03.000Z",
        },
        {
          id: "self",
          role: "maintainer",
          body: "question",
          createdAt: "2026-09-10T00:00:06.000Z",
        },
        {
          id: "new",
          role: "user",
          body: "answer",
          createdAt: "2026-09-10T00:00:07.000Z",
        },
      ],
    });
    expect(selectFeedbackTriggerEvent([value], state)).toMatchObject({
      eventId: "message:ticket-1:new",
      kind: "user-message",
    });
  });

  it("retries an interrupted launch and lets a later approval cover earlier user messages", () => {
    const state = journal();
    state.engaged["ticket-1"] = "2026-09-10T00:00:00.000Z";
    const value = report({
      messages: [
        {
          id: "covered",
          role: "user",
          body: "more detail",
          createdAt: "2026-09-10T00:00:00.500Z",
        },
      ],
    });
    const eventId = "approval:ticket-1:1:2026-09-10T00:00:01.000Z";
    state.events[eventId] = {
      feedbackId: "ticket-1",
      kind: "reapproved",
      revision: 2,
      state: "launching",
      attempts: 1,
      updatedAt: "2026-09-10T00:00:02.000Z",
    };
    expect(selectFeedbackTriggerEvent([value], state)).toMatchObject({
      eventId,
      kind: "reapproved",
    });
    state.events[eventId] = { ...state.events[eventId]!, state: "delivered" };
    expect(selectFeedbackTriggerEvent([value], state)).toBeNull();
  });

  it("retries a failed event after the consumer has claimed the report", () => {
    const state = journal();
    const eventId = "approval:ticket-1:1:2026-09-10T00:00:01.000Z";
    state.events[eventId] = {
      feedbackId: "ticket-1",
      kind: "approved",
      revision: 2,
      state: "failed",
      attempts: 1,
      updatedAt: "2026-09-10T00:00:02.000Z",
      nextAttemptAt: "2026-09-10T00:00:03.000Z",
      lastError: "Feedback trigger timed out.",
    };
    expect(
      selectFeedbackTriggerEvent(
        [report({ status: "working", revision: 3, runId: "run-1" })],
        state,
        new Date("2026-09-10T00:00:04.000Z")
      )
    ).toMatchObject({ eventId, kind: "approved", revision: 2 });
    expect(
      selectFeedbackTriggerEvent(
        [report({ status: "resolved", revision: 4, runId: "run-1" })],
        state,
        new Date("2026-09-10T00:00:04.000Z")
      )
    ).toBeNull();
  });
});

describe("FeedbackMaintenanceWorkerService", () => {
  it("passes the generic process contract and journals a successful delivery", async () => {
    const root = await mkdtemp(join(tmpdir(), "nextclaw-feedback-worker-"));
    const tokenFile = join(root, "token");
    await writeFile(tokenFile, "x".repeat(32));
    await chmod(tokenFile, 0o600);
    const store = new FeedbackMaintenanceStateStore(join(root, "state"));
    const runtimeNow = "2026-09-10T00:00:10.000Z";
    await store.writeRuntime({
      instanceId: "instance",
      pid: process.pid,
      startedAt: runtimeNow,
      heartbeatAt: runtimeNow,
    });
    const execute = vi.fn().mockResolvedValue(undefined);
    const worker = new FeedbackMaintenanceWorkerService({
      client: {
        list: vi.fn().mockResolvedValue({
          items: [report()],
          paused: false,
          maxAuthority: "repair",
          nextCursor: null,
        }),
      } as never,
      config: {
        endpoint: "https://roadmap.nextclaw.io",
        tokenFile,
        intervalMs: 30_000,
        timeoutMs: 600_000,
        command: ["consumer"],
      },
      command: ["consumer"],
      skillPath: "/installed/feedback-maintainer/SKILL.md",
      store,
      execute,
      now: () => new Date(runtimeNow),
    });
    await expect(worker.tick()).resolves.toBe("delivered");
    expect(execute).toHaveBeenCalledWith(
      ["consumer"],
      expect.objectContaining({
        environment: expect.objectContaining({
          NEXTCLAW_FEEDBACK_ID: "ticket-1",
          NEXTCLAW_FEEDBACK_EVENT_KIND: "approved",
          NEXTCLAW_FEEDBACK_TITLE: "Bug",
          NEXTCLAW_FEEDBACK_SKILL_PATH:
            "/installed/feedback-maintainer/SKILL.md",
          SUPPORT_MAINTAINER_TOKEN: "x".repeat(32),
        }),
      })
    );
    expect(execute.mock.calls[0]?.[1]).not.toHaveProperty("cwd");
    const saved = await store.readJournal();
    expect(saved.engaged["ticket-1"]).toBe(runtimeNow);
    expect(
      saved.events["approval:ticket-1:1:2026-09-10T00:00:01.000Z"]?.state
    ).toBe("delivered");
  });
});
