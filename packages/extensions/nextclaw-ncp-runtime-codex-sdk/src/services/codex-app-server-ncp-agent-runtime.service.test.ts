import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NcpAgentRunInput } from "@nextclaw/ncp";

const appServer = vi.hoisted(() => ({
  requests: [] as Array<{
    method: string;
    params: Record<string, unknown>;
  }>,
}));

vi.mock("./codex-app-server-client.service.js", () => ({
  CodexAppServerClient: class {
    initialize = async () => this;

    request = async (
      method: string,
      params: Record<string, unknown>,
    ): Promise<Record<string, unknown>> => {
      appServer.requests.push({ method, params });
      if (method === "thread/start") {
        return { thread: { id: "thread-created" } };
      }
      if (method === "thread/resume") {
        return { thread: { id: params.threadId } };
      }
      if (method === "turn/start") {
        return { turn: { id: "turn-1" } };
      }
      return {};
    };

    nextNotification = async () => ({
      done: false as const,
      value: {
        method: "turn/completed",
        params: {
          turn: {
            status: "completed",
          },
        },
      },
    });

    dispose = (): void => undefined;
  },
}));

import { CodexAppServerNcpAgentRuntime } from "./codex-app-server-ncp-agent-runtime.service.js";

const RUN_INPUT: NcpAgentRunInput = {
  sessionId: "session-1",
  messages: [
    {
      id: "user-1",
      sessionId: "session-1",
      role: "user",
      status: "final",
      timestamp: "2026-07-28T00:00:00.000Z",
      parts: [{ type: "text", text: "hello" }],
    },
  ],
};

async function runRuntime(threadId?: string): Promise<void> {
  const runtime = new CodexAppServerNcpAgentRuntime({
    sessionId: "session-1",
    apiKey: "",
    developerInstructions: "NextClaw instructions\n\nAvailable skills",
    threadId,
    threadOptions: {
      approvalPolicy: "never",
      model: "gpt-5.4",
      sandboxMode: "danger-full-access",
      workingDirectory: "/tmp/workspace",
      skipGitRepoCheck: true,
    },
    desktopThreadIndexSync: false,
  });
  for await (const _event of runtime.run(RUN_INPUT)) {
    // Drain the runtime output.
  }
}

describe("CodexAppServerNcpAgentRuntime NextClaw instructions", () => {
  beforeEach(() => {
    appServer.requests.length = 0;
  });

  it.each([
    { threadId: undefined, method: "thread/start" },
    { threadId: "thread-existing", method: "thread/resume" },
  ])(
    "appends developer instructions through $method without replacing Codex base instructions",
    async ({ method, threadId }) => {
      await runRuntime(threadId);

      const request = appServer.requests.find(
        (candidate) => candidate.method === method,
      );
      expect(request?.params).toMatchObject({
        approvalPolicy: "never",
        cwd: "/tmp/workspace",
        model: "gpt-5.4",
        sandbox: "danger-full-access",
        developerInstructions:
          "NextClaw instructions\n\nAvailable skills",
      });
      expect(request?.params).not.toHaveProperty("baseInstructions");

      const turnRequest = appServer.requests.find(
        (candidate) => candidate.method === "turn/start",
      );
      expect(turnRequest?.params).toMatchObject({
        approvalPolicy: "never",
        sandboxPolicy: { type: "dangerFullAccess" },
      });
    },
  );
});
