import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InboxDeliveryContextProvider } from "@kernel/contributions/context-provider/index.js";
import { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import { EventBus, INBOX_DELIVERY_SESSION_METADATA_KEY } from "@nextclaw/shared";

const tempDirs: string[] = [];

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-inbox-delivery-"));
  tempDirs.push(directory);
  const sessions = new Map<string, { metadata: Record<string, unknown> }>();
  const createSession = vi.fn(async (input: { metadataOverrides?: Record<string, unknown> }) => {
    const sessionId = `session-${sessions.size + 1}`;
    sessions.set(sessionId, { metadata: input.metadataOverrides ?? {} });
    return { sessionId } as never;
  });
  const sessionManager = {
    createSession,
    getSessionRecord: vi.fn(async (sessionId: string) => {
      const session = sessions.get(sessionId);
      return session ? { sessionId, messages: [], ...session } as never : null;
    }),
  };
  const storePath = join(directory, "deliveries.json");
  const manager = new InboxDeliveryManager({
    eventBus: new EventBus(),
    sessionManager,
    storePath,
  });
  return { createSession, manager, sessionManager, storePath };
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
    const { manager, sessionManager, storePath } = await createFixture();
    await Promise.all(Array.from({ length: 8 }, (_, index) =>
      manager.createDelivery(createInput(index + 1))
    ));

    const restored = new InboxDeliveryManager({
      eventBus: new EventBus(),
      sessionManager,
      storePath,
    });
    const view = await restored.listDeliveries();

    expect(view.total).toBe(8);
    expect(view.unreadCount).toBe(8);
    expect(view.unpresentedCount).toBe(8);
    expect(new Set(view.deliveries.map(({ id }) => id)).size).toBe(8);
  });

  it("restores HTML deliveries without changing their source content", async () => {
    const { manager, sessionManager, storePath } = await createFixture();
    const content = "<!doctype html><html><body><h1>Report</h1></body></html>";
    await manager.createDelivery({ ...createInput(), content, contentType: "html" });

    const restored = new InboxDeliveryManager({
      eventBus: new EventBus(),
      sessionManager,
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

  it("creates one linked chat, marks the delivery read, and reuses the session", async () => {
    const { createSession, manager } = await createFixture();
    const delivery = await manager.createDelivery(createInput());

    const first = await manager.continueInChat(delivery.id);
    const second = await manager.continueInChat(delivery.id);

    expect(first.created).toBe(true);
    expect(first.delivery.readAt).toBeTruthy();
    expect(second).toMatchObject({ created: false, sessionId: first.sessionId });
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      metadataOverrides: {
        [INBOX_DELIVERY_SESSION_METADATA_KEY]: delivery.id,
      },
    }));
  });

  it("injects the linked delivery into the next agent run context", async () => {
    const { manager, sessionManager } = await createFixture();
    const delivery = await manager.createDelivery(createInput());
    const continued = await manager.continueInChat(delivery.id);
    const provider = new InboxDeliveryContextProvider(manager, sessionManager);

    const blocks = await provider.provide({
      sessionId: continued.sessionId,
      message: { id: "message-1", role: "user", parts: [] },
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain(delivery.title);
    expect(blocks[0]).toContain(delivery.content);
  });
});
