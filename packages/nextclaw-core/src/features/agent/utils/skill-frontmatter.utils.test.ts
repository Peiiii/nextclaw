import { describe, expect, it } from "vitest";
import {
  buildLocalizedTextMap,
  parseSkillFrontmatter,
  parseSkillFrontmatterMetadata,
  stripSkillFrontmatter,
} from "./skill-frontmatter.utils.js";

describe("skill frontmatter", () => {
  it("parses folded and literal YAML block scalars", () => {
    const folded = parseSkillFrontmatter(
      [
        "---",
        "name: demo",
        "description: >-",
        "  First trigger line.",
        "  Second trigger line.",
        "---",
        "# Demo",
      ].join("\n"),
    );
    const literal = parseSkillFrontmatter(
      ["---", "description: |-", "  First line.", "  Second line.", "---"].join(
        "\r\n",
      ),
    );

    expect(folded.description).toBe("First trigger line. Second trigger line.");
    expect(literal.description).toBe("First line.\nSecond line.");
  });

  it("preserves structured YAML metadata for runtime consumers", () => {
    const metadata = parseSkillFrontmatterMetadata(
      [
        "---",
        "metadata: { nextclaw: { always: true, requires: { bins: [git] } } }",
        "---",
      ].join("\n"),
    );

    expect(metadata).toMatchObject({
      metadata: {
        nextclaw: { always: true, requires: { bins: ["git"] } },
      },
    });
    expect(
      buildLocalizedTextMap("English", { zh: "中文", en: "stale" }),
    ).toEqual({ en: "English", zh: "中文" });
  });

  it("handles missing frontmatter and rejects invalid YAML observably", () => {
    expect(parseSkillFrontmatterMetadata("# Demo")).toBeNull();
    expect(stripSkillFrontmatter("# Demo")).toBe("# Demo");
    expect(() =>
      parseSkillFrontmatterMetadata(
        "---\ndescription: invalid: yaml\n---\n# Demo",
      ),
    ).toThrow("Invalid SKILL.md frontmatter");
  });
});
