import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("session user question routes", () => {
  it("lists questions and sends an answer to the requested question ID", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nextclaw-question-route-"));
    tempDirs.push(dir);
    const configPath = join(dir, "config.json");
    saveConfig(ConfigSchema.parse({}), configPath);
    const question = { id: "question-1", messageId: "message-1", askedAt: "2026-09-28T00:00:00.000Z", title: "Which format?", status: "pending" as const };
    const list = vi.fn(async () => [question]);
    const resolve = vi.fn(async () => ({
      question: { ...question, status: "answered" as const, answer: "PDF" },
      handle: { sessionId: "session-1", userMessageId: "answer-1", assistantMessageId: null, runId: "run-1", delivery: "steered" as const },
    }));
    const app = createUiRouter({
      configPath,
      appEventBus: new EventBus(),
      kernel: createRouterTestKernel({ userQuestions: { list, resolve } as never }),
    });

    const listed = await app.request("http://localhost/api/ncp/sessions/session-1/user-questions");
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({ ok: true, data: { sessionId: "session-1", questions: [question] } });
    const answered = await app.request("http://localhost/api/ncp/sessions/session-1/user-questions/question-1/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "answer", answer: "PDF" }),
    });
    expect(answered.status).toBe(200);
    await expect(answered.json()).resolves.toMatchObject({ ok: true, data: { handle: { delivery: "steered" } } });
    expect(resolve).toHaveBeenCalledWith({ sessionId: "session-1", questionId: "question-1", action: "answer", answer: "PDF" });
  });
});
