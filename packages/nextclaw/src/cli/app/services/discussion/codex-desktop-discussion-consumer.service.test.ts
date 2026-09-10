import { EventEmitter } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { DiscussionListenerStateStore } from "@nextclaw-cli/cli/app/stores/discussion/discussion-listener-state.store.js";
import { CodexDesktopDiscussionConsumerService } from "./codex-desktop-discussion-consumer.service.js";

function codexProxy(methods: string[], taskNames: string[]) {
  return (() => {
    const child = new EventEmitter() as EventEmitter & {
      stdin: PassThrough;
      stdout: PassThrough;
      stderr: PassThrough;
      kill: () => boolean;
    };
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      queueMicrotask(() => child.emit("close", 0));
      return true;
    };
    let input = "";
    child.stdin.on("data", (chunk) => {
      input += chunk.toString();
      while (input.includes("\n")) {
        const index = input.indexOf("\n");
        const line = input.slice(0, index);
        input = input.slice(index + 1);
        const message = JSON.parse(line) as {
          id?: number;
          method: string;
          params?: { name?: string };
        };
        methods.push(message.method);
        if (message.method === "thread/name/set" && message.params?.name)
          taskNames.push(message.params.name);
        if (!message.id) continue;
        const turnId =
          methods.filter((item) => item === "turn/start").length === 1
            ? "turn-1"
            : "turn-2";
        const result =
          message.method === "thread/start"
            ? { thread: { id: "thread-1" } }
            : message.method === "thread/resume"
            ? { thread: { id: "thread-1" } }
            : message.method === "turn/start"
            ? { turn: { id: turnId } }
            : {};
        queueMicrotask(() => {
          child.stdout.write(JSON.stringify({ id: message.id, result }) + "\n");
          if (message.method === "turn/start")
            child.stdout.write(
              JSON.stringify({
                method: "turn/completed",
                params: { turn: { id: turnId, status: "completed" } },
              }) + "\n"
            );
        });
      }
    });
    child.stdin.on("finish", () =>
      queueMicrotask(() => child.emit("close", 0))
    );
    queueMicrotask(() => child.emit("spawn"));
    return child;
  }) as never;
}

describe("CodexDesktopDiscussionConsumerService", () => {
  it("creates one visible thread and resumes it for the next event", async () => {
    const root = await mkdtemp(join(tmpdir(), "nextclaw-discussion-codex-"));
    const store = new DiscussionListenerStateStore(root);
    const methods: string[] = [];
    const taskNames: string[] = [];
    const service = new CodexDesktopDiscussionConsumerService({
      store,
      spawnProcess: codexProxy(methods, taskNames),
      timeoutMs: 1_000,
    });
    const base = {
      discussionId: "discussion-12345678",
      title: "Login fails",
      eventKind: "approved",
      cursor: "2",
      workspace: "/projects/nextbot",
      skillPath: "/skill/SKILL.md",
    };
    await expect(
      service.trigger({ ...base, eventId: "event-1" })
    ).resolves.toEqual({ threadId: "thread-1", turnId: "turn-1" });
    await expect(
      service.trigger({
        ...base,
        eventId: "event-2",
        eventKind: "user-message",
        cursor: "3",
      })
    ).resolves.toEqual({ threadId: "thread-1", turnId: "turn-2" });
    expect(methods.filter((method) => method === "thread/start")).toHaveLength(
      1
    );
    expect(methods.filter((method) => method === "thread/resume")).toHaveLength(
      1
    );
    expect(methods.filter((method) => method === "turn/start")).toHaveLength(2);
    expect(taskNames).toEqual(["反馈：[nextbot] Login fails"]);
    expect(
      (await store.readCodexBindings()).discussions[base.discussionId]
    ).toMatchObject({
      threadId: "thread-1",
      eventIds: { "event-1": "turn-1", "event-2": "turn-2" },
    });
  });
});
