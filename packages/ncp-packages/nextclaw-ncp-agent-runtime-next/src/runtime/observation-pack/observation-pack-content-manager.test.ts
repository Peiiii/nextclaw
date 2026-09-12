import { describe, expect, it, vi } from "vitest";
import type { NcpToolCallResult } from "@nextclaw/ncp";
import type { ToolResultContentManager } from "@nextclaw/ncp-agent-runtime";
import { ObservationStore } from "./observation-pack-store.config.js";
import { ObservationPackToolResultContentManager } from "./observation-pack-content-manager.config.js";

describe("ObservationPackToolResultContentManager", () => {
  function makeDelegate(
    normalize: (r: NcpToolCallResult) => NcpToolCallResult,
  ): ToolResultContentManager {
    return {
      normalizeToolCallResult: vi.fn(normalize),
      compactInput: vi.fn(),
      toModelContent: vi.fn(),
      toVisualObservationMessages: vi.fn(),
    } as never;
  }

  const SMALL_RESULT = {
    toolCallId: "c1",
    toolName: "echo",
    args: null,
    rawArgsText: "{}",
    result: "tiny",
  } as NcpToolCallResult;

  const LARGE_RESULT = {
    toolCallId: "c1",
    toolName: "read_file",
    args: null,
    rawArgsText: "{}",
    result: "x".repeat(10_000),
  } as NcpToolCallResult;

  it("passes through result unchanged when under threshold", () => {
    const store = new ObservationStore();
    const normalize = vi.fn((r: NcpToolCallResult) => r);
    const manager = new ObservationPackToolResultContentManager({
      delegate: makeDelegate(normalize),
      store,
      thresholdChars: 5000,
    });
    const result = manager.normalizeToolCallResult(SMALL_RESULT);
    expect(result).toBe(SMALL_RESULT);
    expect(store.size).toBe(0);
  });

  it("archives result and replaces with handle when over threshold", () => {
    const store = new ObservationStore();
    const delegate: ToolResultContentManager = {
      normalizeToolCallResult: vi.fn((r: NcpToolCallResult) => ({ ...r })),
      compactInput: vi.fn(),
      toModelContent: vi.fn(),
      toVisualObservationMessages: vi.fn(),
    } as never;
    const manager = new ObservationPackToolResultContentManager({
      delegate,
      store,
      thresholdChars: 5000,
    });
    const result = manager.normalizeToolCallResult(LARGE_RESULT);
    expect(String(result.result)).toMatch(/^\[observation: obs-\d+\]$/);
    expect(store.size).toBe(1);
  });

  it("preserves original bytes in archive", () => {
    const store = new ObservationStore();
    const bigData = "abcde".repeat(2000);
    const delegate: ToolResultContentManager = {
      normalizeToolCallResult: vi.fn((r: NcpToolCallResult) => ({ ...r })),
      compactInput: vi.fn(),
      toModelContent: vi.fn(),
      toVisualObservationMessages: vi.fn(),
    } as never;
    const manager = new ObservationPackToolResultContentManager({
      delegate,
      store,
      thresholdChars: 5000,
    });
    manager.normalizeToolCallResult({
      toolCallId: "c1",
      toolName: "tool",
      args: null,
      rawArgsText: "{}",
      result: bigData,
    });
    const entries = [...store["byId"]];
    expect(entries.length).toBeGreaterThan(0);
    const [, entry] = entries[0]!;
    expect(entry.resultBytes).toBeGreaterThan(5000);
  });
});
