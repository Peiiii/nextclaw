import { describe, expect, it } from "vitest";
import type { NcpMessage } from "@nextclaw/ncp";
import {
  buildChatMessageExecutionPresentation,
  buildChatMessageExecutionSummary,
} from "@/features/chat/features/message/utils/chat-message-execution-summary.utils";

const labels = {
  input: "input",
  output: "output",
  tokens: "tokens",
  partial: "partial usage",
};

const presentationLabels = {
  ...labels,
  moreActions: "More actions",
  viewMetadata: "View run metadata",
  metadataTitle: "AI run metadata",
  metadataDescription: "Runtime facts",
  close: "Close",
  notAvailable: "Not available",
  fields: {
    runId: "Run ID",
    runtime: "Runtime",
    model: "Model",
    requestedModel: "Requested model",
    outcome: "Outcome",
    inputTokens: "Input tokens",
    outputTokens: "Output tokens",
    cachedInputTokens: "Cached input tokens",
    totalTokens: "Total tokens",
    modelCallCount: "Model calls",
    reportedModelCallCount: "Calls with reported usage",
    usageStatus: "Usage status",
  },
  outcomes: {
    completed: "Completed",
    failed: "Failed",
    aborted: "Aborted",
  },
  usageStatuses: {
    reported: "Reported",
    partial: "Partial",
    unavailable: "Unavailable",
  },
};

function createMessage(aiExecution: unknown): NcpMessage {
  return {
    id: "assistant-1",
    sessionId: "session-1",
    role: "assistant",
    status: "final",
    timestamp: "2026-07-18T00:00:00.000Z",
    parts: [{ type: "text", text: "done" }],
    metadata: { ai_execution: aiExecution },
  };
}

describe("buildChatMessageExecutionSummary", () => {
  it("formats reported input and output usage with the resolved model", () => {
    expect(
      buildChatMessageExecutionSummary({
        message: createMessage({
          version: 1,
          runId: "run-1",
          runtimeId: "native",
          model: "openai/gpt-5",
          requestedModel: null,
          outcome: "completed",
          usage: {
            inputTokens: 143_000,
            outputTokens: 307,
            cachedInputTokens: 8_000,
            totalTokens: 143_307,
            modelCallCount: 1,
            reportedModelCallCount: 1,
            status: "reported",
          },
        }),
        labels,
      }),
    ).toBe("openai/gpt-5 · 143k input / 307 output");
  });

  it("shows partial usage and keeps unavailable usage out of the footer", () => {
    const base = {
      version: 1,
      runId: "run-1",
      runtimeId: "codex",
      model: "gpt-5",
      requestedModel: null,
      outcome: "failed",
    };
    expect(
      buildChatMessageExecutionSummary({
        message: createMessage({
          ...base,
          usage: {
            inputTokens: 2_000,
            outputTokens: null,
            cachedInputTokens: null,
            totalTokens: null,
            modelCallCount: 2,
            reportedModelCallCount: 1,
            status: "partial",
          },
        }),
        labels,
      }),
    ).toBe("gpt-5 · 2k input · partial usage");
    const unavailableExecution = {
      ...base,
      usage: {
        inputTokens: null,
        outputTokens: null,
        cachedInputTokens: null,
        totalTokens: null,
        modelCallCount: null,
        reportedModelCallCount: null,
        status: "unavailable" as const,
      },
    };
    expect(
      buildChatMessageExecutionSummary({
        message: createMessage(unavailableExecution),
        labels,
      }),
    ).toBe("gpt-5");

    const presentation = buildChatMessageExecutionPresentation({
      message: createMessage(unavailableExecution),
      labels: presentationLabels,
    });
    expect(presentation?.summaryLabel).toBe("gpt-5");
    expect(presentation?.moreActions.items[0]?.dialog?.rows).toEqual(
      expect.arrayContaining([
        { label: "Input tokens", value: "Not available" },
        { label: "Usage status", value: "Unavailable" },
      ]),
    );
  });

  it("keeps cached and exact token counts in the metadata detail action", () => {
    const presentation = buildChatMessageExecutionPresentation({
      message: createMessage({
        version: 1,
        runId: "run-1",
        runtimeId: "native",
        model: "openai/gpt-5",
        requestedModel: null,
        outcome: "completed",
        usage: {
          inputTokens: 143_000,
          outputTokens: 307,
          cachedInputTokens: 128_000,
          totalTokens: 143_307,
          modelCallCount: 2,
          reportedModelCallCount: 2,
          status: "reported",
        },
      }),
      labels: presentationLabels,
    });

    expect(presentation?.summaryLabel).toBe(
      "openai/gpt-5 · 143k input / 307 output",
    );
    expect(presentation?.moreActions).toMatchObject({
      triggerLabel: "More actions",
      items: [
        {
          label: "View run metadata",
          dialog: {
            rows: expect.arrayContaining([
              { label: "Cached input tokens", value: "128k (128000)" },
              { label: "Total tokens", value: "143.3k (143307)" },
            ]),
          },
        },
      ],
    });
  });

  it("ignores missing, malformed, and non-assistant metadata", () => {
    expect(
      buildChatMessageExecutionSummary({
        message: createMessage({ version: 1 }),
        labels,
      }),
    ).toBeNull();
    expect(
      buildChatMessageExecutionSummary({
        message: { ...createMessage(null), role: "user" },
        labels,
      }),
    ).toBeNull();
  });
});
