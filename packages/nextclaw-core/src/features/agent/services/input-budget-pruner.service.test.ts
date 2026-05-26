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
});
