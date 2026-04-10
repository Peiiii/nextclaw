import { describe, expect, it, vi } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import {
  createCronJobHandler,
  createHeartbeatJobHandler,
} from "../service-cron-job-handler.js";

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
    const send = vi.fn((_envelope: unknown) =>
      (async function* () {
        yield {
          type: NcpEventType.MessageCompleted,
          payload: {
            message: createAssistantMessage("NCP says hi"),
          },
        } as never;
      })());
    const publishOutbound = vi.fn(async () => undefined);
    const handler = createCronJobHandler({
      resolveNcpAgent: () =>
        ({
          runApi: { send },
        }) as never,
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
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      sessionId: "cron:job-1",
      metadata: expect.objectContaining({
        agentId: "engineer",
        agent_id: "engineer",
        accountId: "acct-1",
        account_id: "acct-1",
        channel: "slack",
        chatId: "room-1",
        chat_id: "room-1",
        label: "daily-review",
        cron_job_id: "job-1",
        cron_job_name: "daily-review",
      }),
      message: expect.objectContaining({
        sessionId: "cron:job-1",
        role: "user",
        parts: [{ type: "text", text: "review inbox" }],
      }),
    });
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

  it("fails fast when the NCP agent is not ready instead of falling back to legacy execution", async () => {
    const publishOutbound = vi.fn(async () => undefined);
    const handler = createCronJobHandler({
      resolveNcpAgent: () => null,
      bus: {
        publishOutbound,
      } as never,
    });

    await expect(
      handler({
        id: "job-2",
        name: "no-fallback",
        payload: {
          message: "ping",
        },
      }),
    ).rejects.toThrow("NCP agent is not ready for cron execution.");

    expect(publishOutbound).not.toHaveBeenCalled();
  });

  it("fails fast when the NCP stream finishes without a completed assistant message", async () => {
    const send = vi.fn((_envelope: unknown) =>
      (async function* () {
        yield {
          type: NcpEventType.RunStarted,
          payload: { sessionId: "cron:job-3" },
        } as never;
      })());
    const handler = createCronJobHandler({
      resolveNcpAgent: () =>
        ({
          runApi: { send },
        }) as never,
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

describe("createHeartbeatJobHandler", () => {
  it("runs heartbeat through the NCP run api with the legacy cli/direct session semantics preserved", async () => {
    const send = vi.fn((_envelope: unknown) =>
      (async function* () {
        yield {
          type: NcpEventType.MessageCompleted,
          payload: {
            message: createAssistantMessage("HEARTBEAT_OK"),
          },
        } as never;
      })());
    const handler = createHeartbeatJobHandler({
      resolveNcpAgent: () =>
        ({
          runApi: { send },
        }) as never,
      resolveAgentId: () => "engineer",
    });

    const response = await handler("Read HEARTBEAT.md");

    expect(response).toBe("HEARTBEAT_OK");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      sessionId: "heartbeat",
      metadata: expect.objectContaining({
        agentId: "engineer",
        agent_id: "engineer",
        channel: "cli",
        chatId: "direct",
        chat_id: "direct",
        label: "heartbeat",
        session_origin: "heartbeat",
      }),
      message: expect.objectContaining({
        sessionId: "heartbeat",
        role: "user",
        parts: [{ type: "text", text: "Read HEARTBEAT.md" }],
      }),
    });
  });

  it("fails fast when the NCP agent is not ready instead of falling back to legacy execution", async () => {
    const handler = createHeartbeatJobHandler({
      resolveNcpAgent: () => null,
      resolveAgentId: () => "main",
    });

    await expect(handler("ping")).rejects.toThrow(
      "NCP agent is not ready for heartbeat execution.",
    );
  });

  it("fails fast when the NCP stream finishes without a completed assistant message", async () => {
    const send = vi.fn((_envelope: unknown) =>
      (async function* () {
        yield {
          type: NcpEventType.RunStarted,
          payload: { sessionId: "heartbeat" },
        } as never;
      })());
    const handler = createHeartbeatJobHandler({
      resolveNcpAgent: () =>
        ({
          runApi: { send },
        }) as never,
      resolveAgentId: () => "main",
    });

    await expect(handler("ping")).rejects.toThrow(
      "heartbeat execution completed without a final assistant message",
    );
  });
});
