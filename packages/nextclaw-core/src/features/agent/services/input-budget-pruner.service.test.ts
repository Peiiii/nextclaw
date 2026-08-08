import { describe, expect, it } from "vitest";
import { InputBudgetPruner } from "./input-budget-pruner.service.js";

const toolCall = (id: string) => ({
  id,
  type: "function",
  function: {
    name: "read_file",
    arguments: "{}",
  },
});

describe("InputBudgetPruner", () => {
  it("keeps historical tool protocol when the input is within budget", () => {
    const pruner = new InputBudgetPruner();
    const result = pruner.prune({
      contextTokens: 10_000,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      messages: [
        { role: "system", content: "system" },
        { role: "user", content: "read package json" },
        {
          role: "assistant",
          content: "",
          tool_calls: [toolCall("call-1")],
        },
        {
          role: "tool",
          tool_call_id: "call-1",
          content: "{\"name\":\"nextclaw\"}",
        },
        { role: "assistant", content: "done" },
      ],
    });

    expect(result.droppedHistoryCount).toBe(0);
    expect(result.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
    expect(result.messages[2]).toHaveProperty("tool_calls");
    expect(result.messages[3]).toMatchObject({
      role: "tool",
      tool_call_id: "call-1",
    });
  });

  it("truncates a single oversized tool result without pruning the pair", () => {
    const pruner = new InputBudgetPruner();
    const result = pruner.prepareForBudget({
      contextTokens: 1_000,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      messages: [
        {
          role: "assistant",
          content: "",
          tool_calls: [toolCall("call-1")],
        },
        {
          role: "tool",
          tool_call_id: "call-1",
          content: "x".repeat(2_500),
        },
      ],
    });

    expect(result.truncatedToolResultCount).toBe(1);
    expect(result.messages).toHaveLength(2);
    expect(String(result.messages[1].content)).toContain("Tool result truncated");
  });

  it("prunes complete tool pairs only when the whole input exceeds budget", () => {
    const pruner = new InputBudgetPruner();
    const result = pruner.prune({
      contextTokens: 120,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      messages: [
        { role: "system", content: "system" },
        { role: "user", content: "first" },
        {
          role: "assistant",
          content: "",
          tool_calls: [toolCall("call-1")],
        },
        {
          role: "tool",
          tool_call_id: "call-1",
          content: "x".repeat(1_400),
        },
        { role: "assistant", content: "first result noted" },
        { role: "user", content: "second" },
        {
          role: "assistant",
          content: "",
          tool_calls: [toolCall("call-2")],
        },
        {
          role: "tool",
          tool_call_id: "call-2",
          content: "short",
        },
        { role: "assistant", content: "done" },
      ],
    });

    const toolCallIds = result.messages.flatMap((message) => {
      if (!Array.isArray(message.tool_calls)) {
        return [];
      }
      return message.tool_calls.map((item) => (item as { id: string }).id);
    });
    const toolResultIds = result.messages.flatMap((message) => {
      return message.role === "tool" && typeof message.tool_call_id === "string"
        ? [message.tool_call_id]
        : [];
    });

    expect(result.estimatedTokens).toBeLessThanOrEqual(result.budgetTokens);
    expect(result.droppedHistoryCount).toBeGreaterThan(0);
    expect(toolResultIds).toEqual(expect.arrayContaining(toolCallIds));
    expect(toolCallIds).toEqual(expect.arrayContaining(toolResultIds));
  });

  it("removes orphan tool results during protocol normalization", () => {
    const pruner = new InputBudgetPruner();
    const result = pruner.prepareForBudget({
      contextTokens: 10_000,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      messages: [
        { role: "user", content: "hello" },
        {
          role: "tool",
          tool_call_id: "missing-call",
          content: "orphan",
        },
      ],
    });

    expect(result.droppedHistoryCount).toBe(1);
    expect(result.messages).toEqual([{ role: "user", content: "hello" }]);
  });

  it("fills missing tool results during protocol normalization", () => {
    const pruner = new InputBudgetPruner();
    const result = pruner.prepareForBudget({
      contextTokens: 10_000,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      messages: [
        {
          role: "assistant",
          content: "",
          tool_calls: [toolCall("call-1")],
        },
      ],
    });

    expect(result.messages).toHaveLength(2);
    expect(result.messages[1]).toMatchObject({
      role: "tool",
      tool_call_id: "call-1",
    });
    expect(String(result.messages[1].content)).toContain("interrupted");
  });

  it("keeps a declared stable prefix unchanged while pruning its dynamic suffix", () => {
    const pruner = new InputBudgetPruner();
    const stablePrefix = [
      { role: "system", content: "compressed summary" },
      { role: "user", content: "exact preserved user constraint" },
      { role: "user", content: "continue the active run" },
    ];
    const result = pruner.prune({
      contextTokens: 100,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      protectedPrefixMessageCount: stablePrefix.length,
      messages: [
        ...stablePrefix,
        { role: "assistant", content: "old dynamic output ".repeat(100) },
        { role: "user", content: "latest suffix input" },
      ],
    });

    expect(result.messages.slice(0, stablePrefix.length)).toEqual(stablePrefix);
    expect(result.messages.at(-1)).toEqual({ role: "user", content: "latest suffix input" });
    expect(result.estimatedTokens).toBeLessThanOrEqual(result.budgetTokens);
  });

  it("counts fixed provider input such as tool schemas in the hard budget", () => {
    const pruner = new InputBudgetPruner();
    const result = pruner.prune({
      contextTokens: 300,
      fixedInputTokens: 40,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      messages: [{ role: "user", content: "x".repeat(2_000) }],
    });

    expect(result.estimatedTokens).toBeGreaterThanOrEqual(40);
    expect(result.estimatedTokens).toBeLessThanOrEqual(result.budgetTokens);
    expect(result.truncatedUserMessage).toBe(true);
  });

});

describe("InputBudgetPruner protected system context", () => {
  it("truncates only the system tail after a protected compressed-context prefix", () => {
    const pruner = new InputBudgetPruner();
    const compressedContext = "authoritative compressed checkpoint";
    const stablePrefix = [
      {
        role: "system",
        content: `${compressedContext}\n\n${"dynamic bootstrap context ".repeat(400)}`,
      },
      { role: "user", content: "exact preserved user constraint" },
    ];
    const prune = (dynamicSuffix: Record<string, unknown>[]) => pruner.prune({
      contextTokens: 700,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      protectedPrefixMessageCount: stablePrefix.length,
      protectedSystemContentChars: compressedContext.length,
      messages: [...stablePrefix, ...dynamicSuffix],
    });
    const result = prune([]);
    const resultWithLargerSuffix = prune([
      { role: "assistant", content: "growing dynamic suffix ".repeat(200) },
      { role: "user", content: "new request" },
    ]);

    expect(result.messages[0]?.content).toMatch(new RegExp(`^${compressedContext}`));
    expect(String(result.messages[0]?.content).length).toBeLessThan(
      `${compressedContext}\n\n${"dynamic bootstrap context ".repeat(400)}`.length,
    );
    expect(result.messages[1]).toEqual({ role: "user", content: "exact preserved user constraint" });
    expect(resultWithLargerSuffix.messages.slice(0, stablePrefix.length)).toEqual(
      result.messages.slice(0, stablePrefix.length),
    );
    expect(result.estimatedTokens).toBeLessThanOrEqual(result.budgetTokens);
    expect(resultWithLargerSuffix.estimatedTokens).toBeLessThanOrEqual(
      resultWithLargerSuffix.budgetTokens,
    );
  });
});

describe("InputBudgetPruner visual inputs", () => {
  it("counts image data URLs as bounded visual inputs instead of raw base64 text", () => {
    const pruner = new InputBudgetPruner();
    const imageUrl = `data:image/png;base64,${"a".repeat(2_500_000)}`;
    const messages = [
      { role: "system", content: "system prompt" },
      { role: "user", content: "previous context that must survive" },
      { role: "assistant", content: "I will remember the previous context." },
      {
        role: "user",
        content: [
          { type: "text", text: "please inspect this image" },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
      { role: "user", content: "continue from the previous context" },
    ];

    const result = pruner.prune({
      contextTokens: 20_000,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      messages,
    });

    expect(result.droppedHistoryCount).toBe(0);
    expect(result.estimatedTokens).toBeLessThan(result.budgetTokens);
    expect(result.messages).toHaveLength(messages.length);
    expect(result.messages[1]).toMatchObject({
      content: "previous context that must survive",
      role: "user",
    });
  });

  it("uses image dimensions when estimating visual input budget", () => {
    const pruner = new InputBudgetPruner();
    const imageUrl = `data:image/png;base64,${"a".repeat(2_500_000)}`;
    const withoutDimensions = pruner.estimate({
      contextTokens: 20_000,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      messages: [
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: imageUrl } }],
        },
      ],
    });
    const withDimensions = pruner.estimate({
      contextTokens: 20_000,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { height: 64, url: imageUrl, width: 64 },
            },
          ],
        },
      ],
    });

    expect(withDimensions.estimatedTokens).toBeLessThan(withoutDimensions.estimatedTokens);
  });

  it("counts raw image tool payload objects as visual inputs", () => {
    const pruner = new InputBudgetPruner();
    const result = pruner.prune({
      contextTokens: 20_000,
      reserveTokensFloor: 0,
      softThresholdTokens: 0,
      messages: [
        { role: "system", content: "system prompt" },
        { role: "user", content: "previous context that must survive" },
        {
          role: "user",
          content: [
            {
              data: "a".repeat(2_500_000),
              height: 64,
              mimeType: "image/png",
              type: "image",
              width: 64,
            },
          ],
        },
      ],
    });

    expect(result.droppedHistoryCount).toBe(0);
    expect(result.estimatedTokens).toBeLessThan(result.budgetTokens);
    expect(result.messages[1]).toMatchObject({
      content: "previous context that must survive",
      role: "user",
    });
  });
});
