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

function createAssistantMessageWithMessageToolFailure(message: string) {
  return {
    ...createAssistantMessage("failed"),
    parts: [
      {
        type: "tool-invocation" as const,
        toolName: "message",
        toolCallId: "call-message-1",
        state: "result" as const,
        result: {
          ok: false,
          error: {
            code: "tool_execution_failed",
            message,
          },
        },
      },
      { type: "text" as const, text: "failed" },
    ],
  };
}

describe("createCronJobHandler", () => {
  it("runs cron jobs through the NCP run api without binding channel delivery", async () => {
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
    const handler = createCronJobHandler({
      agentRunClient: {
        sendAndWaitForReply,
      } as never,
    });

    const response = await handler({
      id: "job-1",
      name: "daily-review",
      payload: {
        message: "review inbox",
        agentId: "engineer",
      },
    });

    expect(response).toBe("NCP says hi");
    expect(sendAndWaitForReply).toHaveBeenCalledTimes(1);
    expect(sendAndWaitForReply.mock.calls[0]?.[0]).toMatchObject({
      sessionId: "cron:job-1",
      content: [{ type: "text", text: "review inbox" }],
      metadata: expect.objectContaining({
        agentId: "engineer",
        label: "daily-review",
        cron_job_id: "job-1",
        cron_job_name: "daily-review",
      }),
    });
    const payload = sendAndWaitForReply.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
    expect(payload.metadata).not.toHaveProperty("agent_id");
    expect(payload.metadata).not.toHaveProperty("account_id");
    expect(payload.metadata).not.toHaveProperty("chat_id");
    expect(payload.metadata).not.toHaveProperty("accountId");
    expect(payload.metadata).not.toHaveProperty("channel");
    expect(payload.metadata).not.toHaveProperty("chatId");
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

  it("marks cron runs as failed when the message tool reports delivery failure", async () => {
    const sendAndWaitForReply = vi.fn(async () => ({
      handle: {
        sessionId: "cron:job-4",
        userMessageId: "user-1",
        assistantMessageId: null,
        runId: "run-1",
      },
      text: "failed",
      completedMessage: createAssistantMessageWithMessageToolFailure(
        "weixin send failed: account \"missing@im.bot\" is not logged in",
      ),
    }));
    const handler = createCronJobHandler({
      agentRunClient: {
        sendAndWaitForReply,
      } as never,
    });

    await expect(
      handler({
        id: "job-4",
        name: "message-failure",
        payload: {
          message: "send weixin",
        },
      }),
    ).rejects.toThrow("cron message delivery failed: weixin send failed: account \"missing@im.bot\" is not logged in");
  });
});
