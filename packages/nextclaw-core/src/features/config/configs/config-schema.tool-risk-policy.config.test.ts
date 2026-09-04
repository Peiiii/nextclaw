import { describe, expect, it } from "vitest";
import { ToolRiskPolicySchema } from "./config-schema.config.js";

describe("ToolRiskPolicySchema", () => {
  it("applies defaults for an empty policy", () => {
    const policy = ToolRiskPolicySchema.parse({});

    expect(policy.entries).toEqual({});
    expect(policy.confirmTimeoutSec).toBe(120);
    expect(policy.rememberConfirmations).toBe(true);
  });

  it("keeps explicit risk level, hint and confirm conditions per tool", () => {
    const policy = ToolRiskPolicySchema.parse({
      entries: {
        "fs.remove": {
          risk: "critical",
          reasonHint: "删除文件不可恢复，需要用户确认",
          requireConfirmWhen: ["recursive=true"]
        },
        "exec.run": {
          risk: "high"
        }
      },
      confirmTimeoutSec: 60,
      rememberConfirmations: false
    });

    expect(policy.entries["fs.remove"]).toMatchObject({
      risk: "critical",
      reasonHint: "删除文件不可恢复，需要用户确认",
      requireConfirmWhen: ["recursive=true"]
    });
    expect(policy.entries["exec.run"]).toMatchObject({
      risk: "high",
      requireConfirmWhen: []
    });
    expect(policy.entries["exec.run"]).not.toHaveProperty("reasonHint");
    expect(policy.confirmTimeoutSec).toBe(60);
    expect(policy.rememberConfirmations).toBe(false);
  });

  it("defaults an unlisted tool entry to low risk", () => {
    const policy = ToolRiskPolicySchema.parse({
      entries: {
        "fs.read": {}
      }
    });

    expect(policy.entries["fs.read"].risk).toBe("low");
    expect(policy.entries["fs.read"].requireConfirmWhen).toEqual([]);
  });

  it("rejects an invalid risk level", () => {
    expect(() =>
      ToolRiskPolicySchema.parse({
        entries: {
          "fs.remove": { risk: "extreme" }
        }
      })
    ).toThrow();
  });

  it("rejects a non-positive confirm timeout", () => {
    expect(() => ToolRiskPolicySchema.parse({ confirmTimeoutSec: 0 })).toThrow();
  });
});
