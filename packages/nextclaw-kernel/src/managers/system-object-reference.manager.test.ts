import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EventBus, SYSTEM_OBJECT_TYPE_CRON_JOB, SYSTEM_OBJECT_TYPE_INBOX_DELIVERY } from "@nextclaw/shared";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import {
  createCronJobSystemObjectProvider,
  createInboxDeliverySystemObjectProvider,
  SystemObjectReferenceManager,
} from "@kernel/managers/system-object-reference.manager.js";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-system-object-"));
  tempDirs.push(directory);
  const inbox = new InboxDeliveryManager({
    eventBus: new EventBus(),
    storePath: join(directory, "inbox.json"),
  });
  const cronJob = {
    id: "cron-1",
    name: "Daily review",
    enabled: true,
    schedule: { kind: "cron" as const, expr: "0 9 * * *", tz: "Asia/Shanghai" },
    payload: { kind: "agent_turn" as const, message: "Review unread reports", agentId: "main" },
    state: { nextRunAtMs: Date.parse("2026-08-12T01:00:00.000Z") },
    createdAtMs: Date.parse("2026-08-10T00:00:00.000Z"),
    updatedAtMs: Date.parse("2026-08-11T00:00:00.000Z"),
    deleteAfterRun: false,
  };
  const automation = { listJobs: () => [cronJob] };
  const assetStore = new LocalAssetStore({ rootDir: join(directory, "assets") });
  const manager = new SystemObjectReferenceManager(assetStore, [
    createInboxDeliverySystemObjectProvider(inbox),
    createCronJobSystemObjectProvider(automation as never),
  ]);
  return { assetStore, cronJob, inbox, manager };
}

describe("SystemObjectReferenceManager", () => {
  it("returns provider-owned groups for browsing and grouped results for search", async () => {
    const { inbox, manager } = await createFixture();
    await inbox.createDelivery({
      title: "OOM investigation",
      summary: "Memory pressure report",
      content: "# Root cause\n\nJournal expansion",
      contentType: "markdown",
      source: { kind: "agent", agentId: "main", sessionId: null, toolCallId: null, filePath: null },
    });

    await expect(manager.listReferences()).resolves.toMatchObject({
      total: 2,
      groups: [
        expect.objectContaining({
          objectType: SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
          icon: "inbox",
          items: [],
          total: 1,
        }),
        expect.objectContaining({
          objectType: SYSTEM_OBJECT_TYPE_CRON_JOB,
          icon: "calendar-clock",
          items: [],
          total: 1,
        }),
      ],
    });
    await expect(manager.listReferences({ query: "unread" })).resolves.toMatchObject({
      total: 1,
      groups: [{
        objectType: SYSTEM_OBJECT_TYPE_CRON_JOB,
        items: [expect.objectContaining({ objectType: SYSTEM_OBJECT_TYPE_CRON_JOB })],
        total: 1,
      }],
    });
    await expect(manager.listReferences({
      objectType: SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
    })).resolves.toMatchObject({
      groups: [{
        objectType: SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
        items: [expect.objectContaining({ label: "OOM investigation" })],
        total: 1,
      }],
    });
  });

  it("applies the result limit independently inside each provider group", async () => {
    const { inbox, manager } = await createFixture();
    await inbox.createDelivery({
      title: "Daily inbox review",
      summary: "Review the inbox",
      content: "Inbox",
      contentType: "markdown",
      source: { kind: "agent", agentId: "main", sessionId: null, toolCallId: null, filePath: null },
    });

    const result = await manager.listReferences({ query: "review", limit: 1 });

    expect(result.groups).toEqual([
      expect.objectContaining({
        objectType: SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
        items: [expect.objectContaining({ label: "Daily inbox review" })],
      }),
      expect.objectContaining({
        objectType: SYSTEM_OBJECT_TYPE_CRON_JOB,
        items: [expect.objectContaining({ label: "Daily review" })],
      }),
    ]);
  });

  it("materializes immutable content-addressed snapshots and reuses the same version", async () => {
    const { assetStore, inbox, manager } = await createFixture();
    const report = await inbox.createDelivery({
      title: "OOM investigation",
      summary: "Memory pressure report",
      content: "# Root cause\n\nJournal expansion",
      contentType: "markdown",
      source: { kind: "agent", agentId: "main", sessionId: null, toolCallId: null, filePath: null },
    });
    const [{ uri }] = (await manager.listReferences({ query: report.title })).groups[0]!.items;

    const first = await manager.resolveReference(uri);
    const second = await manager.resolveReference(uri);
    const bytes = await assetStore.readAssetBytes(first.assetUri);

    expect(second).toEqual(first);
    expect(first.version).toMatch(/^[a-f0-9]{64}$/);
    expect(bytes?.toString("utf8")).toContain("Journal expansion");
  });

  it("exports a scheduled task snapshot through the same resolver", async () => {
    const { assetStore, manager } = await createFixture();
    const [{ uri }] = (await manager.listReferences({ query: "Daily review" })).groups[0]!.items;
    const reference = await manager.resolveReference(uri);
    const bytes = await assetStore.readAssetBytes(reference.assetUri);

    expect(reference).toMatchObject({
      objectType: SYSTEM_OBJECT_TYPE_CRON_JOB,
      mimeType: "text/markdown",
    });
    expect(bytes?.toString("utf8")).toContain("0 9 * * *");
    expect(bytes?.toString("utf8")).toContain("Review unread reports");
  });
});
