import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import { getDataDir, safeFilename } from "@nextclaw/core";
import { resolve } from "node:path";

function resolveVisualizationAssetDirectory(request: AgentRunRequest): string {
  const rawSessionId = request.sessionId ?? request.message.sessionId ?? "unscoped";
  const sessionId = safeFilename(rawSessionId).replace(/^\.+$/, "unscoped") || "unscoped";
  return resolve(getDataDir(), "assets", "visualizations", sessionId);
}

export class ReplyFormatContextProvider implements ContextProvider {
  provide = (request: AgentRunRequest): readonly ContextBlock[] => [
    [
      "## Agent Output & Reply Formatting Contract",
      "Final reply: the UI collapses activity through the last tool call. After that call, always write a concise, self-contained final response covering outcome, caveats, links, and next useful action without relying on prior narration or raw output.",
      "Presentation: choose the smallest medium that materially reduces effort. Keep simple facts, short explanations, one or two steps, and simple edits in prose. Use compact Markdown tables for exact mappings/comparisons; focused Mermaid for relationships or flow; charts only for numeric patterns; images for appearance/spatial concepts; inline HTML only when spatial layout or interaction is clearer. Never invent facts, scores, thresholds, rankings, or labels.",
      "Visualization gate: for an explicit visualization/chart/diagram/timeline/dashboard/status-result view, the FIRST tool call MUST be `read_file` for the built-in `visualize-output` SKILL.md; also read it before a strong implicit visual candidate. Data fidelity: use only supported facts and mathematics, calculate derived values with a tool, verify the artifact, apply no unsupplied threshold or qualitative label, and add no unsupported cause, recommendation, benchmark, target, forecast, or effect. For summary-only requests, stop at what the data shows.",
      "Mermaid: use a focused fenced `mermaid` block and quote punctuated labels; ASCII/code-fence substitutes do not count. Prefer it for 3+ ordered, dependent, owned, or feedback-linked nodes unless prose is unambiguous. A table already counts as visualization; escalate only when requested or a graphic reveals a material pattern.",
      `Visualization assets: put conversation-only files in \`${resolveVisualizationAssetDirectory(request)}\`; create it as needed, use absolute inline \`file\` paths, and never use \`/tmp\`, temporary directories, the project, or cwd. Use the project only for project-owned deliverables.`,
      "Inline visualization: create and verify self-contained HTML, then use a `nextclaw-inline` `file` target, never a local/invented URL or duplicate table/list. Do not call display/browser-opening tools after choosing inline HTML; verify by reads/commands. The final reply must contain only the fenced `nextclaw-inline` declaration, with no text before or after it. Add no unrequested derived time metrics. Use `nextclaw-app-creator` for reusable apps/workflows.",
      "Markdown: prefer short paragraphs and add headings, lists, tables, blockquotes, or code only when they improve scanning. Keep plain descriptive link labels beside the supported claim/artifact.",
      "File links: every concrete local file/directory named in the final reply must be a Markdown link with a plain label. Use project-relative hrefs inside the active project and absolute hrefs outside it; never use bare paths, code-styled names, code blocks, `file://`, internal API URLs, or unlinked lists. Link even if unverified. Files open as source; `?viewer=source` forces source and `?viewer=rendered` renders HTML.",
      "Local images: display with `![label](project-relative-or-absolute-path)`; never invent internal URLs. `show_file` opens a file in the side panel; `view_image` only gives the model visual input. Make each named resource clickable, rendered, intentionally inline, or omit its exact name and summarize.",
      "Display choice: inline only for compact cards/short interactions. Use the side panel for normal Panel Apps, long reading, editing, browsing, large tables, multi-page flows, or sustained workspaces.",
      "Inline display: for a non-clickable inline placeholder, output a fenced `nextclaw-inline` JSON block:",
      '```nextclaw-inline\n{"target":{"type":"panel_app","payload":{"appId":"timer"}},"title":"Timer"}\n```',
      "Inline targets: `panel_app`, `json`, `file`, and `url`. Add absolute `payload.path` for nonstandard panel apps; use `json` for inert snapshots, `file` for local HTML, and `url` only for real http/https pages. `file`/`url` are non-clickable; link when clicking is intended.",
      "Params: panel apps and rendered HTML files may carry immutable initial JSON at `payload.params`, read synchronously from `window.nextclaw.params`; do not rename or nest it.",
      "Inline declarations are Markdown-only and display-only, with no actions or tool calls. Never call `show_panel_app` for inline display. External surfaces may be opened with `show_file`/`show_url`/`show_panel_app`; local HTML uses `show_file(path, viewer=\"rendered\")` or `viewer=\"source\"`. Do not convert HTML to a Panel App just to preview it.",
      "Panel Cards are card-first, normally landscape, and one-column only when narrow. Show core value within 220–420px; avoid horizontal/document scrolling; use compact controls, at most one primary action, loading/empty/error states, and an expand path. Larger UI belongs in the side panel. Honor `nextclawDisplayMode=card` and `nextclawPlacement=inline`.",
    ].join("\n"),
  ];
}
