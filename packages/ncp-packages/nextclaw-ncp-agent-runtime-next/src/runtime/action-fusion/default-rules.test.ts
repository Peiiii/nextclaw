import { describe, expect, it, vi } from "vitest";
import type { CollectedToolCall } from "@nextclaw/ncp-agent-runtime";
import type { NcpEndpointEvent } from "@nextclaw/ncp";
import {
  EDIT_VERIFY_FUSION_RULE,
  WRITE_VERIFY_FUSION_RULE,
  getDefaultFusionRules,
} from "./default-rules.config.js";
import type { ActionFusionContext } from "./types.js";

function makeCall(toolName: string, args = "{}"): CollectedToolCall {
  return { toolCallId: `call-${toolName}`, toolName, args };
}

function makeContext(
  results: Record<string, NcpEndpointEvent>,
  published: NcpEndpointEvent[] = [],
): ActionFusionContext {
  return {
    sessionId: "test-session",
    messageId: "test-message",
    publishToolEvent: vi.fn(async (event: NcpEndpointEvent) => {
      published.push(event);
    }),
    originalExecuteToolCall: vi.fn(async (call: CollectedToolCall) => results[call.toolName]!),
  };
}

describe("ActionFusion default rules", () => {
  describe("EDIT_VERIFY_FUSION_RULE", () => {
    it("should match edit_file + exec pattern", () => {
      expect(EDIT_VERIFY_FUSION_RULE.name).toBe("edit_verify");
      expect(EDIT_VERIFY_FUSION_RULE.pattern).toEqual(["edit_file", "exec"]);
      expect(EDIT_VERIFY_FUSION_RULE.maxDepth).toBe(2);
    });

    it("executes both calls sequentially and returns the last result", async () => {
      const editEvent = { type: "tool-result-edit" } as unknown as NcpEndpointEvent;
      const execEvent = { type: "tool-result-exec" } as unknown as NcpEndpointEvent;
      const published: NcpEndpointEvent[] = [];
      const context = makeContext(
        { edit_file: editEvent, exec: execEvent },
        published,
      );

      const result = await EDIT_VERIFY_FUSION_RULE.execute(
        [makeCall("edit_file"), makeCall("exec")],
        context,
      );

      expect(result).toBe(execEvent);
      expect(published).toEqual([editEvent]);
      expect(context.originalExecuteToolCall).toHaveBeenCalledTimes(2);
    });

    it("should throw when called with insufficient calls", async () => {
      const context = makeContext({ edit_file: {} as NcpEndpointEvent });
      await expect(
        EDIT_VERIFY_FUSION_RULE.execute([makeCall("edit_file")], context),
      ).rejects.toThrow("requires at least 2 calls");
    });
  });

  describe("WRITE_VERIFY_FUSION_RULE", () => {
    it("should match write_file + exec pattern", () => {
      expect(WRITE_VERIFY_FUSION_RULE.name).toBe("write_verify");
      expect(WRITE_VERIFY_FUSION_RULE.pattern).toEqual(["write_file", "exec"]);
      expect(WRITE_VERIFY_FUSION_RULE.maxDepth).toBe(2);
    });

    it("executes both calls sequentially and returns the last result", async () => {
      const writeEvent = { type: "tool-result-write" } as unknown as NcpEndpointEvent;
      const execEvent = { type: "tool-result-exec" } as unknown as NcpEndpointEvent;
      const published: NcpEndpointEvent[] = [];
      const context = makeContext(
        { write_file: writeEvent, exec: execEvent },
        published,
      );

      const result = await WRITE_VERIFY_FUSION_RULE.execute(
        [makeCall("write_file"), makeCall("exec")],
        context,
      );

      expect(result).toBe(execEvent);
      expect(published).toEqual([writeEvent]);
    });
  });

  describe("getDefaultFusionRules", () => {
    it("should return both default rules", () => {
      const rules = getDefaultFusionRules();
      expect(rules).toHaveLength(2);
      expect(rules[0]).toBe(EDIT_VERIFY_FUSION_RULE);
      expect(rules[1]).toBe(WRITE_VERIFY_FUSION_RULE);
    });
  });
});
