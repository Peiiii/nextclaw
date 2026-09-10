import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { DiscussionActor, DiscussionEvent, DiscussionThreadView } from "@nextclaw/shared";
import { DiscussionListenerStateStore } from "@nextclaw-cli/cli/app/stores/discussion/discussion-listener-state.store.js";
import { DiscussionListenerWorkerService } from "./discussion-listener-worker.service.js";

const administrator: DiscussionActor = {
  id: "admin-1", kind: "human", displayName: "Owner",
  roles: ["administrator"], authenticated: true,
};

const participant: DiscussionActor = {
  id: "nextclaw-discussion-participant", kind: "agent", displayName: "Discussion Agent",
  roles: ["participant"], authenticated: true,
};

function event(cursor: number, actor: DiscussionActor = administrator): {
  source: DiscussionEvent;
  view: DiscussionThreadView;
} {
  const threadId = "discussion-1";
  const postId = `post-${cursor}`;
  return {
    source: {
      cursor, type: cursor === 1 ? "thread-created" : "post-created",
      threadId, postId, audienceRole: "participant", createdAt: "2026-09-10T00:00:00.000Z",
    },
    view: {
      thread: {
        id: threadId, space: "direct", title: "Investigate login", openedBy: administrator,
        createdAt: "2026-09-10T00:00:00.000Z", updatedAt: "2026-09-10T00:00:00.000Z", lastEventCursor: cursor,
      },
      posts: [{
        id: postId, threadId, sequence: cursor, author: actor, body: "Please investigate.",
        createdAt: "2026-09-10T00:00:00.000Z",
      }],
    },
  };
}

async function setup(source: DiscussionEvent, view: DiscussionThreadView) {
  const root = await mkdtemp(join(tmpdir(), "nextclaw-discussion-listener-"));
  const tokenFile = join(root, "token");
  await writeFile(tokenFile, "x".repeat(32));
  await chmod(tokenFile, 0o600);
  const store = new DiscussionListenerStateStore(join(root, "state"));
  const execute = vi.fn().mockResolvedValue(undefined);
  const worker = new DiscussionListenerWorkerService({
    discussion: {
      events: vi.fn().mockResolvedValue({ items: [source], nextCursor: source.cursor }),
      get: vi.fn().mockResolvedValue(view),
    } as never,
    config: {
      endpoint: "https://roadmap.nextclaw.io", tokenFile, intervalMs: 30_000,
      timeoutMs: 600_000, command: ["consumer"],
    },
    command: ["consumer"],
    skillPath: "/installed/discussion-participant/SKILL.md",
    store,
    execute,
    now: () => new Date("2026-09-10T00:00:10.000Z"),
  });
  return { worker, execute, store };
}

describe("DiscussionListenerWorkerService", () => {
  it("delivers a role-filtered event through the generic command contract", async () => {
    const value = event(1);
    const { worker, execute, store } = await setup(value.source, value.view);

    await expect(worker.tick()).resolves.toBe("delivered");
    expect(execute).toHaveBeenCalledWith(
      ["consumer"],
      expect.objectContaining({ environment: expect.objectContaining({
        NEXTCLAW_DISCUSSION_ID: "discussion-1",
        NEXTCLAW_DISCUSSION_EVENT_ID: "discussion:1",
        NEXTCLAW_DISCUSSION_SPACE: "direct",
        DISCUSSION_PARTICIPANT_TOKEN: "x".repeat(32),
      }) }),
    );
    expect(execute.mock.calls[0]?.[1]).not.toHaveProperty("cwd");
    const journal = await store.readJournal();
    expect(journal.events["discussion:1"]?.state).toBe("delivered");
    expect(journal.cursor).toBe(1);
  });

  it("advances the cursor without triggering for the participant's own post", async () => {
    const value = event(2, participant);
    const { worker, execute, store } = await setup(value.source, value.view);

    await expect(worker.tick()).resolves.toBe("idle");
    expect(execute).not.toHaveBeenCalled();
    expect((await store.readJournal()).cursor).toBe(2);
  });
});
