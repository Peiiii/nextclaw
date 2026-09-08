import { sep } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { estimateInputTokens } from "@nextclaw/core";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import { ReplyFormatContextProvider } from "./reply-format-context.provider.js";

const request = {
  message: {
    id: "message-1",
    sessionId: "session-1",
    role: "user",
    parts: [{ type: "text", text: "hello" }],
  },
} as AgentRunRequest;

describe("ReplyFormatContextProvider", () => {
  it("retains delivery rules across the stable prompt and the mandatory display skill", () => {
    const provider = new ReplyFormatContextProvider();
    const context = provider.provide(request).join("\n");
    const skill = readFileSync(new URL("../../../../../nextclaw-core/src/features/agent/shared/skills/visualize-output/SKILL.md", import.meta.url), "utf8");
    const inline = readFileSync(new URL("../../../../../nextclaw-core/src/features/agent/shared/skills/visualize-output/references/inline-display.md", import.meta.url), "utf8");
    const completeContract = context + "\n" + skill + "\n" + inline;

    for (const expected of [
      "## Agent Output & Reply Formatting Contract",
      "After that call, always write a concise, self-contained final response",
      "choose the smallest medium that materially reduces effort",
      "Keep simple facts, short explanations, one or two steps, and simple edits in prose",
      "compact Markdown tables",
      "focused Mermaid",
      "charts only for numeric patterns",
      "inline HTML only when",
      "FIRST tool call MUST be `read_file`",
      "built-in `visualize-output` SKILL.md",
      "use only supported facts and mathematics",
      "calculate derived values with a tool",
      "apply no unsupplied threshold or qualitative label",
      "For summary-only requests, stop at what the data shows",
      "fenced `mermaid` block",
      "ASCII/code-fence substitutes do not count",
      "Visualization assets:",
      ["assets", "visualizations", "session-1"].join(sep),
      "never use `/tmp`",
      "use a `nextclaw-inline` `file` target",
      "must contain only the fenced `nextclaw-inline` declaration",
      "no text before or after it",
      "every concrete local file/directory named in the final reply must be a Markdown link",
      "project-relative hrefs inside the active project and absolute hrefs outside it",
      "never use bare paths",
      "`file://`",
      "`?viewer=source`",
      "`?viewer=rendered`",
      "![label](project-relative-or-absolute-path)",
      "`show_file` opens a file in the side panel",
      "`view_image` only gives the model visual input",
      "Inline display:",
      "```nextclaw-inline",
      '"target":{"type":"panel_app"',
      "`panel_app`, `json`, `file`, and `url`",
      "real http/https pages",
      "immutable initial JSON at `payload.params`",
      "window.nextclaw.params",
      "Markdown-only and display-only",
      "Never call `show_panel_app` for inline display",
      'show_file(path, viewer="rendered")',
      'viewer="source"',
      "Panel Cards are card-first",
      "220–420px",
      "nextclawDisplayMode=card",
      "nextclawPlacement=inline",
    ]) {
      expect(completeContract).toContain(expected);
    }

    expect(
      estimateInputTokens([{ role: "system", content: context }]),
    ).toBeLessThan(1_200);
    expect(context).toContain("Before any inline display (including an existing Panel App)");
    expect(context).toContain("If required rules are no longer in context, read them again");
    expect(context).not.toContain("window.nextclaw.params");
    expect(skill).toContain("references/inline-display.md");
    expect(skill).toContain("普通文本、表格和 Mermaid 不读取该 reference");
    expect(inline).toContain("window.nextclaw.params");
  });
});
