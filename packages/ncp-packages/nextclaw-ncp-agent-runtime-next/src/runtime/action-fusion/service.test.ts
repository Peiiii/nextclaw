import { describe, expect, it, vi } from "vitest";
import type { CollectedToolCall } from "@nextclaw/ncp-agent-runtime";
import {
  ActionFusionService,
  type ActionFusionContext,
} from "./service.js";
import type { ActionFusionConfig } from "./types.js";

function makeCall(toolName: string, args = "{}"): CollectedToolCall {
  return { toolCallId: `call-${toolName}`, toolName, args };
}

function makeConfig(overrides: Partial<ActionFusionConfig> = {}): ActionFusionConfig {
  return {
    enabled: true,
    rules: [],
    maxLookahead: 5,
    ...overrides,
  };
}

function makeContext(overrides: Partial<ActionFusionContext> = {}): ActionFusionContext {
  return {
    sessionId: "test-session",
    messageId: "test-message",
    publishToolEvent: vi.fn(),
    originalExecuteToolCall: vi.fn(async () => ({ result: "ok" })),
    ...overrides,
  };
}

describe("ActionFusionService", () => {
  describe("disabled", () => {
    it("returns non-fused when actionFusion.enabled is false", async () => {
      const service = new ActionFusionService(makeConfig({ enabled: false }));
      const context = makeContext();
      const result = await service.detectAndFuse(context, makeCall("edit_file"));
      expect(result.fused).toBe(false);
      expect(result.fusedCallCount).toBe(0);
      expect(result.savedCalls).toBe(0);
    });
  });

  describe("no matching rule", () => {
    it("returns non-fused when no rules match", async () => {
      const service = new ActionFusionService(makeConfig());
      const context = makeContext();
      const result = await service.detectAndFuse(context, makeCall("random_tool"));
      expect(result.fused).toBe(false);
      // Falls back to original execution
      expect(context.originalExecuteToolCall).toHaveBeenCalled();
    });
  });

  describe("pattern matching", () => {
    it("matches pattern [edit_file, exec] correctly", async () => {
      const execute = vi.fn(async () => ({ fused: true }));
      const service = new ActionFusionService(makeConfig({
        rules: [{
          name: "edit_verify",
          pattern: ["edit_file", "exec"],
          maxDepth: 2,
          execute,
        }],
      }));
      const context = makeContext();

      // First call: edit_file - should start matching
      const result1 = await service.detectAndFuse(context, makeCall("edit_file"));
      expect(result1.fused).toBe(false); // Not enough calls yet

      // Second call: exec - should fuse
      const result2 = await service.detectAndFuse(context, makeCall("exec"));
      expect(result2.fused).toBe(true);
      expect(execute).toHaveBeenCalledWith([
        expect.objectContaining({ toolName: "edit_file" }),
        expect.objectContaining({ toolName: "exec" }),
      ]);
    });

    it("respects maxDepth and does not exceed it", async () => {
      const execute = vi.fn(async () => ({ fused: true }));
      const service = new ActionFusionService(makeConfig({
        rules: [{
          name: "test",
          pattern: ["a", "b", "c"],
          maxDepth: 2,
          execute,
        }],
      }));
      const context = makeContext();

      await service.detectAndFuse(context, makeCall("a"));
      await service.detectAndFuse(context, makeCall("b"));
      // Third call should not exceed maxDepth
      const result = await service.detectAndFuse(context, makeCall("c"));
      expect(result.fused).toBe(false);
    });
  });

  describe("fusion execution", () => {
    it("executes fused calls and returns result", async () => {
      const execute = vi.fn(async () => ({ success: true, data: "fused" }));
      const service = new ActionFusionService(makeConfig({
        rules: [{
          name: "edit_verify",
          pattern: ["edit_file", "exec"],
          maxDepth: 2,
          execute,
        }],
      }));
      const context = makeContext();

      await service.detectAndFuse(context, makeCall("edit_file"));
      const result = await service.detectAndFuse(context, makeCall("exec"));

      expect(result.fused).toBe(true);
      expect(result.fusedCallCount).toBe(2);
      expect(result.savedCalls).toBe(1);
      expect(result.result).toEqual({ success: true, data: "fused" });
    });

    it("falls back to individual execution when fusion fails", async () => {
      const execute = vi.fn(async () => {
        throw new Error("Fusion failed");
      });
      const service = new ActionFusionService(makeConfig({
        rules: [{
          name: "edit_verify",
          pattern: ["edit_file", "exec"],
          maxDepth: 2,
          execute,
        }],
      }));
      const context = makeContext();
      const originalExec = vi.fn(async () => ({ individual: true }));
      context.originalExecuteToolCall = originalExec;

      await service.detectAndFuse(context, makeCall("edit_file"));
      const result = await service.detectAndFuse(context, makeCall("exec"));

      // Should fallback to individual execution
      expect(result.fused).toBe(false);
      expect(originalExec).toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("clears active fusion state", async () => {
      const service = new ActionFusionService(makeConfig());
      service.reset();
      // Should not throw
      const result = await service.detectAndFuse(makeContext(), makeCall("edit_file"));
      expect(result.fused).toBe(false);
    });
  });
});
