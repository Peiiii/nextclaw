import { describe, expect, it, vi } from "vitest";
import {
  createCronJobHandler,
} from "@nextclaw-service/shared/services/gateway/utils/cron-job-handler.utils.js";

function createAssistantMessage(text: string) {
  return {
    id: `assistant-${text}`,
    sessionId: "cron:job-1",
    role: "assistant" as const,
    status: "final" as const,
    timestamp: new Date().toISOString(),
    parts: [{ type: "text" as const, text }],
  };
}

describe("createCronJobHandler", () => {
  it("runs cron jobs through the NCP run api and publishes the final reply when deliver is enabled", async () => {
    const sendAndWaitForReply = vi.fn(async (_payload: unknown, _options?: unknown) => ({
      handle: {
        sessionId: "cron:job-1",
        userMessageId: "user-1",
        assistantMessageId: null,
        runId: "run-1",
      },
      text: "NCP says hi",
      completedMessage: createAssistantMessage("NCP says hi"),
    }));
    const publishOutbound = vi.fn(async () => undefined);
    const handler = createCronJobHandler({
      agentRunClient: {
        sendAndWaitForReply,
      } as never,
      bus: {
        publishOutbound,
      } as never,
    });

    const response = await handler({
      id: "job-1",
      name: "daily-review",
      payload: {
        message: "review inbox",
        agentId: "engineer",
        deliver: true,
        channel: "slack",
        to: "room-1",
        accountId: "acct-1",
      },
    });

    expect(response).toBe("NCP says hi");
    expect(sendAndWaitForReply).toHaveBeenCalledTimes(1);
    expect(sendAndWaitForReply.mock.calls[0]?.[0]).toMatchObject({
      sessionId: "cron:job-1",
      content: [{ type: "text", text: "review inbox" }],
      metadata: expect.objectContaining({
        agentId: "engineer",
        accountId: "acct-1",
        channel: "slack",
        chatId: "room-1",
        label: "daily-review",
        cron_job_id: "job-1",
        cron_job_name: "daily-review",
      }),
    });
    const payload = sendAndWaitForReply.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
    expect(payload.metadata).not.toHaveProperty("agent_id");
    expect(payload.metadata).not.toHaveProperty("account_id");
    expect(payload.metadata).not.toHaveProperty("chat_id");
    expect(publishOutbound).toHaveBeenCalledWith({
      channel: "slack",
      chatId: "room-1",
      content: "NCP says hi",
      media: [],
      metadata: expect.objectContaining({
        agentId: "engineer",
        accountId: "acct-1",
      }),
    });
  });

  it("uses a configured target session id instead of the job-owned cron session", async () => {
    const sendAndWaitForReply = vi.fn(async (_payload: unknown, _options?: unknown) => ({
      handle: {
        sessionId: "session-existing",
        userMessageId: "user-1",
        assistantMessageId: null,
        runId: "run-1",
      },
      text: "continued",
      completedMessage: createAssistantMessage("continued"),
    }));
    const handler = createCronJobHandler({
      agentRunClient: {
        sendAndWaitForReply,
      } as never,
      bus: {
        publishOutbound: vi.fn(async () => undefined),
      } as never,
    });

    await handler({
      id: "job-session",
      name: "continue-existing-thread",
      payload: {
        message: "continue",
        sessionId: "session-existing",
      },
    });

    expect(sendAndWaitForReply).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-existing",
        content: [{ type: "text", text: "continue" }],
      }),
      expect.any(Object),
    );
  });

  it("fails fast when the NCP stream finishes without a completed assistant message", async () => {
    const sendAndWaitForReply = vi.fn(async () => {
      throw new Error("cron job completed without a final assistant message");
    });
    const handler = createCronJobHandler({
      agentRunClient: {
        sendAndWaitForReply,
      } as never,
      bus: {
        publishOutbound: vi.fn(async () => undefined),
      } as never,
    });

    await expect(
      handler({
        id: "job-3",
        name: "strict-final-message",
        payload: {
          message: "continue",
        },
      }),
    ).rejects.toThrow("cron job completed without a final assistant message");
  });
});
