import { describe, expect, it } from "vitest";
import {
  EDIT_VERIFY_FUSION_RULE,
  WRITE_VERIFY_FUSION_RULE,
  getDefaultFusionRules,
} from "./default-rules.config.js";

describe("ActionFusion default rules", () => {
  describe("EDIT_VERIFY_FUSION_RULE", () => {
    it("should match edit_file + exec pattern", () => {
      expect(EDIT_VERIFY_FUSION_RULE.name).toBe("edit_verify");
      expect(EDIT_VERIFY_FUSION_RULE.pattern).toEqual(["edit_file", "exec"]);
      expect(EDIT_VERIFY_FUSION_RULE.maxDepth).toBe(2);
    });

    it("should fuse when pattern matches", async () => {
      const result = await EDIT_VERIFY_FUSION_RULE.execute([
        { toolCallId: "c1", toolName: "edit_file", args: JSON.stringify({ path: "/test.ts", old_string: "old", new_string: "new" }) },
        { toolCallId: "c2", toolName: "exec", args: JSON.stringify({ command: "echo test" }) },
      ]);
      expect(result).toHaveProperty("fused", true);
      expect(result).toHaveProperty("editApplied", true);
    });

    it("should throw when called with insufficient calls", async () => {
      await expect(
        EDIT_VERIFY_FUSION_RULE.execute([
          { toolCallId: "c1", toolName: "edit_file", args: "{}" },
        ])
      ).rejects.toThrow("requires at least 2 calls");
    });
  });

  describe("WRITE_VERIFY_FUSION_RULE", () => {
    it("should match write_file + exec pattern", () => {
      expect(WRITE_VERIFY_FUSION_RULE.name).toBe("write_verify");
      expect(WRITE_VERIFY_FUSION_RULE.pattern).toEqual(["write_file", "exec"]);
      expect(WRITE_VERIFY_FUSION_RULE.maxDepth).toBe(2);
    });

    it("should fuse when pattern matches", async () => {
      const result = await WRITE_VERIFY_FUSION_RULE.execute([
        { toolCallId: "c1", toolName: "write_file", args: JSON.stringify({ path: "/test.ts", content: "hello" }) },
        { toolCallId: "c2", toolName: "exec", args: JSON.stringify({ command: "cat /test.ts" }) },
      ]);
      expect(result).toHaveProperty("fused", true);
      expect(result).toHaveProperty("fileWritten", true);
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
