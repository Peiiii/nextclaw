import { describe, expect, it } from "vitest";
import { sep } from "node:path";
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
  it("asks native agents to render local file paths as Markdown links", () => {
    const provider = new ReplyFormatContextProvider();

    const context = provider.provide(request).join("\n");

    for (const expected of [
      "## Agent Output & Reply Formatting Contract",
      "Goal:",
      "Content after the last tool call remains directly visible",
      "after the final tool call, always write a self-contained final response",
      "when all earlier narration and tool activity are collapsed",
      "Markdown structure:",
      "Mermaid diagrams:",
      "fenced `mermaid` block",
      "Visualization:",
      "infer the appropriate medium without requiring the user to name it",
      "MUST read the built-in `visualize-output` SKILL.md",
      "before any visualization tool call",
      "follow its data-fidelity rules",
      "State only facts and mathematical relationships directly supported by the user's input",
      "calculate every derived number with a tool",
      "compare every displayed value against the input and computed results",
      "do not label values healthy, normal, good, bad, high, or low",
      "do not add causal hypotheses, diagnostic recommendations, industry ranges, targets, optimization effects, forecasts, or projected impact",
      "stop at what the data shows rather than why it happened or what to do",
      "without inventing or reinterpreting missing facts",
      "create the parent directory first",
      "write and verify a real self-contained HTML file",
      "`nextclaw-inline` `file` target",
      "never represent generated local HTML as a URL",
      "duplicate the visual with a second table/list",
      "use `nextclaw-app-creator` for reusable apps",
      "File links:",
      "Display choice:",
      "Inline display:",
      "Forbidden forms:",
      "Examples:",
      "Self-check before sending:",
      "Mandatory visualization gate for the current turn",
      "your FIRST tool call MUST be `read_file`",
      "regardless of whether the user explicitly said inline",
      "verify with non-display file reads or commands instead",
      "perform the comparison silently",
      "must contain only the fenced `nextclaw-inline` declaration",
      "no sentence before it, no validation table, calculations, pass/fail narration, data recap, conclusion",
      "the declaration's closing fence must be the final content",
      "do not add extra month-over-month, year-over-year, compound-growth, or cumulative-growth metrics",
      "Persistent visualization assets:",
      ["assets", "visualizations", "session-1"].join(sep),
      "use the resulting absolute file path",
      "Never put these generated visualization assets in `/tmp`",
      "persistent session visualization directory named above",
      "emit its absolute `file` payload path",
      "must be clickable",
      "Markdown links only",
      "plain text label",
    ]) {
      expect(context).toContain(expected);
    }
    expect(context).toContain("[MEMORY.md](MEMORY.md)");
    expect(context).toContain("[file](packages/example/file.ts)");
    expect(context).toContain("[notes.md](/Users/example/Documents/notes.md)");
    expect(context).toContain("project-relative hrefs");
    expect(context).toContain("absolute hrefs");
    expect(context).toContain("File links open source by default");
    expect(context).toContain("[preview.html](preview.html?viewer=rendered)");
    for (const expected of [
      "[report.docx](report.docx)",
      "Markdown syntax and resource availability are separate",
      "never downgrade a valid link to bare text",
      "![chart](assets/chart.png)",
      "![diagram](/Users/example/Pictures/diagram.svg)",
      "Local image hrefs follow the same",
      "Use `show_file` only when",
      "`view_image` is only for giving the model visual input",
      "file:// URLs",
      "internal API URLs",
      "bad `report.docx` -> good [report.docx](report.docx)",
      "good ![chart](/Users/example/chart.png)",
    ]) {
      expect(context).toContain(expected);
    }
    expect(context).toContain("nextclaw-inline");
    expect(context).toContain('"target":{"type":"panel_app"');
    expect(context).toContain("add its absolute source `path`");
    expect(context).toContain(
      "Supported targets are `panel_app`, `json`, `file`, and `url`",
    );
    expect(context).toContain(
      "Prefer `panel_app` for inline Panel App display",
    );
    expect(context).toContain(
      "use `file` and `url` only as non-clickable placeholders",
    );
    expect(context).toContain("use `file` for generated local HTML");
    expect(context).toContain("`url` only for a real http/https page");
    expect(context).toContain("never for a local path or an invented root-relative URL");
    expect(context).toContain("use `json` for inert JSON snapshots");
    expect(context).toContain("display-only");
    expect(context).toContain("Never call `show_panel_app` for inline display");
    expect(context).toContain("side panel");
    expect(context).toContain("Use Markdown links for clickable resources");
    expect(context).toContain("`show_file` / `show_url` / `show_panel_app`");
    expect(context).toContain("Do not make every UI an inline card");
    expect(context).toContain("A Panel Card must be card-first");
    expect(context).toContain("nextclawDisplayMode=card");
    expect(context).toContain("inline-code file names");
    expect(context).toContain("code-styled link labels");
    expect(context).toContain("action semantics inside `nextclaw-inline`");
    expect(context).toContain("tool calls for inline display");
    expect(context).toContain("unlinked comma-separated file lists");
    expect(context).toContain("bad `MEMORY.md` -> good [MEMORY.md](MEMORY.md)");
    expect(context).toContain("bad `memory/` -> good [memory/](memory/)");
    expect(context).toContain("bad `2026-03-07.md` / `feishu-notes.md`");
    expect(context).toContain("[2026-03-07.md](memory/2026-03-07.md)");
    expect(context).toContain("[feishu-notes.md](memory/feishu-notes.md)");
    expect(context).toContain("intentionally represented by `nextclaw-inline`");
    expect(context).toContain("remove the exact names and summarize instead");
    expect(context).toContain(
      "do not call `show_file`, `show_url`, a browser-opening command",
    );
  });
});
