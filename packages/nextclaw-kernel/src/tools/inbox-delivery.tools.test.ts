import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import { createInboxDeliveryTools } from "@kernel/tools/inbox-delivery.tools.js";
import { EventBus } from "@nextclaw/shared";

const tempDirs: string[] = [];

async function createFixture() {
  const directory = await mkdtemp(join(tmpdir(), "nextclaw-inbox-tool-"));
  tempDirs.push(directory);
  const manager = new InboxDeliveryManager({
    eventBus: new EventBus(),
    sessionManager: {
      createSession: async () => ({ sessionId: "unused" }) as never,
      getSessionRecord: async () => null,
    },
    storePath: join(directory, "deliveries.json"),
  });
  const [tool] = createInboxDeliveryTools(manager, {
    agentId: "writer",
    sessionId: "source-session",
  });
  return { directory, manager, tool };
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

describe("deliver_to_inbox", () => {
  it("creates a durable Markdown delivery from direct content", async () => {
    const { manager, tool } = await createFixture();
    const result = await tool.execute({
      title: "Weekly brief",
      summary: "Important changes",
      content: "# Brief\n\n- One",
    }, { toolCallId: "call-1" });

    expect(result).toMatchObject({ ok: true, title: "Weekly brief" });
    const [delivery] = (await manager.listDeliveries()).deliveries;
    expect(delivery).toMatchObject({
      content: "# Brief\n\n- One",
      source: {
        agentId: "writer",
        sessionId: "source-session",
        toolCallId: "call-1",
        filePath: null,
      },
    });
  });

  it("snapshots an absolute UTF-8 file", async () => {
    const { directory, manager, tool } = await createFixture();
    const filePath = join(directory, "report.md");
    await writeFile(filePath, "# Snapshotted report\n", "utf8");

    await tool.execute({ title: "File report", filePath });
    await writeFile(filePath, "changed", "utf8");

    const [delivery] = (await manager.listDeliveries()).deliveries;
    expect(delivery.content).toBe("# Snapshotted report");
    expect(delivery.source.filePath).toBe(filePath);
  });

  it("requires exactly one content source", async () => {
    const { directory, tool } = await createFixture();
    await expect(tool.execute({ title: "Missing" })).rejects.toThrow(
      "exactly one of content or filePath",
    );
    await expect(tool.execute({
      title: "Duplicate",
      content: "body",
      filePath: join(directory, "report.md"),
    })).rejects.toThrow("exactly one of content or filePath");
    await expect(tool.execute({
      title: "Relative",
      filePath: "report.md",
    })).rejects.toThrow("filePath must be an absolute path");
  });

  it("rejects a file that is not valid UTF-8 text", async () => {
    const { directory, tool } = await createFixture();
    const filePath = join(directory, "binary.md");
    await writeFile(filePath, new Uint8Array([0xff, 0xfe, 0xfd]));

    await expect(tool.execute({ title: "Binary", filePath })).rejects.toThrow(
      "filePath must contain valid UTF-8 text",
    );
  });
});
