import type { NcpAgentRunInput, NcpAgentRuntime } from "@nextclaw/ncp";
import { describe, expect, it } from "vitest";
import { OpencodeNarpRuntimeWrapper } from "./opencode-narp-runtime-wrapper.service.js";
import type { OpencodeAcpRuntimeConfig } from "@opencode-narp/types/opencode-narp-runtime.types.js";

class FakeRuntime implements NcpAgentRuntime {
  run = async function* (_input: NcpAgentRunInput): AsyncGenerator<never> {};
}

describe("OpencodeNarpRuntimeWrapper", () => {
  it("creates a runtime from the prompt-scoped wrapper context", async () => {
    const capturedConfigs: OpencodeAcpRuntimeConfig[] = [];
    const wrapper = new OpencodeNarpRuntimeWrapper(
      {
        resolve: async (context) => ({
          args: ["acp"],
          command: "opencode",
          cwd: context.cwd ?? process.cwd(),
          env: { OPENCODE_CONFIG: "/tmp/opencode.json" },
          providerRoute: {
            model: "deepseek/deepseek-v4-flash",
            apiKey: "secret",
            apiBase: "https://api.deepseek.com/v1",
            headers: {},
          },
          requestTimeoutMs: 240000,
          sessionId: context.sessionId,
          startupTimeoutMs: 15000,
        }),
      },
      (config) => {
        capturedConfigs.push(config);
        return new FakeRuntime();
      },
    );

    const runtime = await wrapper.createOpencodeRuntime({
      sessionId: "session-1",
      cwd: "/tmp/workspace",
      modelId: "deepseek-v4-flash",
      promptMeta: {},
    });

    expect(runtime).toBeInstanceOf(FakeRuntime);
    expect(capturedConfigs).toEqual([
      {
        args: ["acp"],
        command: "opencode",
        cwd: "/tmp/workspace",
        env: { OPENCODE_CONFIG: "/tmp/opencode.json" },
        providerRoute: {
          model: "deepseek/deepseek-v4-flash",
          apiKey: "secret",
          apiBase: "https://api.deepseek.com/v1",
          headers: {},
        },
        requestTimeoutMs: 240000,
        sessionId: "session-1",
        startupTimeoutMs: 15000,
      },
    ]);
  });
});
