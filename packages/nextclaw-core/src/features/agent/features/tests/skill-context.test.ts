import { describe, expect, it } from "vitest";
import { RequestedSkillsMetadataReader } from "@core/features/agent/utils/skill-context.utils.js";

describe("RequestedSkillsMetadataReader", () => {
  it("uses requested skill refs as authoritative selectors", () => {
    const reader = new RequestedSkillsMetadataReader();

    const selection = reader.readSelection({
      requested_skill_refs: [
        "project:/skills/a",
        "project:/skills/a",
        "workspace:/skills/b",
      ],
      requested_skills: ["demo"],
    });

    expect(selection).toEqual({
      refs: ["project:/skills/a", "workspace:/skills/b"],
      names: [],
      selectors: ["project:/skills/a", "workspace:/skills/b"],
      eventMetadata: {
        requested_skill_refs: ["project:/skills/a", "workspace:/skills/b"],
      },
    });
  });

  it("falls back to requested skill names when refs are absent", () => {
    const reader = new RequestedSkillsMetadataReader();

    const selection = reader.readSelection({
      requestedSkills: "weather web-search weather",
    });

    expect(selection).toEqual({
      refs: [],
      names: ["weather", "web-search"],
      selectors: ["weather", "web-search"],
      eventMetadata: {
        requested_skills: ["weather", "web-search"],
      },
    });
  });
});
