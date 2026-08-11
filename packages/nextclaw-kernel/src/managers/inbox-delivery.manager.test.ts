import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import { EventBus } from "@nextclaw/shared";

const tempDirs: string[] = [];

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-inbox-delivery-"));
  tempDirs.push(directory);
  const storePath = join(directory, "deliveries.json");
  const manager = new InboxDeliveryManager({
    eventBus: new EventBus(),
    storePath,
  });
  return { manager, storePath };
}

function createInput(index = 1) {
  return {
    title: `Report ${index}`,
    summary: `Summary ${index}`,
    content: `# Report ${index}\n\nDetails`,
    contentType: "markdown" as const,
    source: {
      kind: "agent" as const,
      agentId: "main",
      sessionId: "source-session",
      toolCallId: `tool-${index}`,
      filePath: null,
    },
  };
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

describe("InboxDeliveryManager", () => {
  it("persists concurrent deliveries without losing updates", async () => {
    const { manager, storePath } = await createFixture();
    await Promise.all(Array.from({ length: 8 }, (_, index) =>
      manager.createDelivery(createInput(index + 1))
    ));

    const restored = new InboxDeliveryManager({
      eventBus: new EventBus(),
      storePath,
    });
    const view = await restored.listDeliveries();

    expect(view.total).toBe(8);
    expect(view.unreadCount).toBe(8);
    expect(view.unpresentedCount).toBe(8);
    expect(new Set(view.deliveries.map(({ id }) => id)).size).toBe(8);
  });

  it("restores HTML deliveries without changing their source content", async () => {
    const { manager, storePath } = await createFixture();
    const content = "<!doctype html><html><body><h1>Report</h1></body></html>";
    await manager.createDelivery({ ...createInput(), content, contentType: "html" });

    const restored = new InboxDeliveryManager({
      eventBus: new EventBus(),
      storePath,
    });
    const [delivery] = (await restored.listDeliveries()).deliveries;

    expect(delivery).toMatchObject({ content, contentType: "html" });
  });

  it("keeps a dismissed delivery unread without making it auto-presentable again", async () => {
    const { manager } = await createFixture();
    const created = await manager.createDelivery(createInput());
    const presented = await manager.updateDeliveryState(created.id, "present");
    const read = await manager.updateDeliveryState(created.id, "read");
    const unread = await manager.updateDeliveryState(created.id, "mark_unread");

    expect(presented.presentedAt).toBeTruthy();
    expect(presented.readAt).toBeNull();
    expect(read.readAt).toBeTruthy();
    expect(unread.readAt).toBeNull();
    expect(unread.presentedAt).toBe(presented.presentedAt);
    await expect(manager.listDeliveries()).resolves.toMatchObject({
      unreadCount: 1,
      unpresentedCount: 0,
    });
  });

  it("migrates a v1 linked-session record without preserving the chat coupling", async () => {
    const { manager, storePath } = await createFixture();
    const timestamp = "2026-08-11T00:00:00.000Z";
    await writeFile(storePath, JSON.stringify({
      version: 1,
      deliveries: [{
        id: "legacy-report",
        ...createInput(),
        createdAt: timestamp,
        updatedAt: timestamp,
        presentedAt: null,
        readAt: null,
        archivedAt: null,
        conversationSessionId: "legacy-session",
      }],
    }), "utf8");

    const [delivery] = (await manager.listDeliveries()).deliveries;
    expect(delivery).toMatchObject({ id: "legacy-report", title: "Report 1" });
    expect(delivery).not.toHaveProperty("conversationSessionId");
  });
});
