import { describe, expect, it } from "vitest";
import type { OpenAIChatChunk } from "@nextclaw/ncp";
import { AgentRunExecutionManager } from "./agent-run-execution.manager.js";

const spec = {
  agentId: "main",
  model: "openai/gpt-5",
  requestedModel: "openai/gpt-5",
  runId: "run-1",
  runtimeId: "native",
};

async function drain(stream: AsyncIterable<OpenAIChatChunk>): Promise<void> {
  for await (const _chunk of stream) {
    // Drain the observed model call.
  }
}

describe("AgentRunExecutionManager", () => {
  it("uses the last cumulative usage in one call and sums across calls", async () => {
    const manager = new AgentRunExecutionManager({
      spec,
      sessionId: "session-1",
      messageId: "message-1",
    });
    await drain(
      manager.observeModelCall(
        (async function* () {
          yield {
            usage: {
              prompt_tokens: 40,
              completion_tokens: 10,
              total_tokens: 50,
            },
          };
          yield {
            usage: {
              prompt_tokens: 100,
              completion_tokens: 20,
              total_tokens: 120,
              prompt_tokens_details_cached_tokens: 30,
            } as OpenAIChatChunk["usage"],
          };
        })(),
      ),
    );
    await drain(
      manager.observeModelCall(
        (async function* () {
          yield { usage: { prompt_tokens: 25, completion_tokens: 5 } };
        })(),
      ),
    );

    expect(manager.buildMetadata("completed")).toEqual({
      version: 1,
      runId: "run-1",
      runtimeId: "native",
      model: "openai/gpt-5",
      requestedModel: "openai/gpt-5",
      outcome: "completed",
      usage: {
        inputTokens: 125,
        outputTokens: 25,
        cachedInputTokens: 30,
        totalTokens: 150,
        modelCallCount: 2,
        reportedModelCallCount: 2,
        status: "reported",
      },
    });
  });

  it("marks retry attempts without usage as partial instead of zero", async () => {
    const manager = new AgentRunExecutionManager({
      spec,
      sessionId: "session-1",
      messageId: "message-1",
    });
    await expect(
      drain(
        manager.observeModelCall(
          (async function* () {
            yield {
              usage: { input_tokens: 80, output_tokens: 20, total_tokens: 100 },
            } as OpenAIChatChunk;
            throw new Error("stream closed");
          })(),
        ),
      ),
    ).rejects.toThrow("stream closed");
    await drain(
      manager.observeModelCall(
        (async function* () {
          yield { choices: [] };
        })(),
      ),
    );

    expect(manager.buildMetadata("failed").usage).toEqual({
      inputTokens: 80,
      outputTokens: 20,
      cachedInputTokens: null,
      totalTokens: 100,
      modelCallCount: 2,
      reportedModelCallCount: 1,
      status: "partial",
    });
  });
});
