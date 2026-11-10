import { describe, expect, it } from "vitest";
import {
  DEFAULT_REDACTION_RULES,
  DEFAULT_ENABLED_RULE_IDS,
  redactText,
  redactWithDefaults,
  REDACTED_PLACEHOLDER,
  type RedactionRule,
} from "./redaction.utils.js";

describe("redaction utils", () => {
  it("redacts a phone number with the built-in rule", () => {
    const result = redactWithDefaults("联系我 13812345678 谢谢");
    expect(result.text).toContain(REDACTED_PLACEHOLDER);
    expect(result.text).not.toContain("13812345678");
    expect(result.matchedRuleIds).toContain("phone");
  });

  it("redacts an email address", () => {
    const result = redactWithDefaults("邮箱 a.b+c@example.com 即可");
    expect(result.text).toContain(REDACTED_PLACEHOLDER);
    expect(result.text).not.toContain("example.com");
  });

  it("redacts a mainland China ID card number", () => {
    const result = redactWithDefaults("身份证 11010119900307771X 存档");
    expect(result.text).not.toContain("11010119900307771X");
    expect(result.text).toContain(REDACTED_PLACEHOLDER);
  });

  it("redacts user-defined keyword rules case-insensitively", () => {
    const customRule: RedactionRule = {
      id: "custom:0",
      kind: "keyword",
      label: "机密项目",
      keyword: "北极星计划",
      optional: true,
    };
    const result = redactText(
      "讨论北极星计划进展",
      [customRule],
      new Set([customRule.id]),
    );
    expect(result.text).toContain(REDACTED_PLACEHOLDER);
    expect(result.text).not.toContain("北极星计划");
    expect(result.matchedRuleIds).toEqual(["custom:0"]);
  });

  it("skips optional rules when not enabled", () => {
    const customRule: RedactionRule = {
      id: "custom:0",
      kind: "keyword",
      label: "机密项目",
      keyword: "北极星计划",
      optional: true,
    };
    const result = redactText("北极星计划", [customRule], new Set());
    expect(result.text).toBe("北极星计划");
    expect(result.matchedRuleIds).toEqual([]);
  });

  it("keeps plain text unchanged", () => {
    const result = redactWithDefaults("今天的会议纪要正常");
    expect(result.text).toBe("今天的会议纪要正常");
    expect(result.matchedRuleIds).toEqual([]);
  });

  it("exposes the built-in rule catalog and default enablement", () => {
    expect(DEFAULT_REDACTION_RULES.length).toBeGreaterThanOrEqual(5);
    expect(DEFAULT_ENABLED_RULE_IDS).toHaveLength(DEFAULT_REDACTION_RULES.length);
    expect(new Set(DEFAULT_REDACTION_RULES.map((rule) => rule.id)).size).toBe(
      DEFAULT_REDACTION_RULES.length,
    );
  });
});
