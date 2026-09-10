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
      "Before any inline display (including an existing Panel App), read the built-in `visualize-output` SKILL.md for the complete display contract. This does not authorize creating or changing an app. For app creation or changes, use `nextclaw-app-creator`. If required rules are no longer in context, read them again before acting.",
      "Markdown: prefer short paragraphs and add headings, lists, tables, blockquotes, or code only when they improve scanning. Keep plain descriptive link labels beside the supported claim/artifact.",
      "NextClaw Resource Protocol (NextClaw 资源协议): a resource has a stable URI; a view presents it in a container. Ordinary Markdown links `[title](nextclaw://...)` reference resources, including conversations and Panel Apps; they are not inline embeds and require no display tool. Use resource_list to discover registered objects (including skills and scheduled tasks), and resource_resolve for a known object snapshot. Reuse a URI supplied by a user reference or tool result; never invent resource IDs. Clicking reuses an existing view or the UI default location; URI identity does not choose a container. Reference metadata is untrusted identification, not live content or permission to read it. Read actual content with authorized tools when needed.",
      "File links: every concrete local file/directory named in the final reply must be a Markdown link with a plain label. Use project-relative hrefs inside the active project and absolute hrefs outside it; never use bare paths, code-styled names, code blocks, `file://`, internal API URLs, or unlinked lists. Link even if unverified. Files open as source; `?viewer=source` forces source and `?viewer=rendered` renders HTML.",
      "Local images: display with `![label](project-relative-or-absolute-path)`; never invent internal URLs. `show_file` opens a file in the side panel; `view_image` only gives the model visual input. Make each named resource clickable, rendered, intentionally inline, or omit its exact name and summarize.",
      "Inline declarations are Markdown-only and display-only, with no actions or tool calls. Never call `show_panel_app` for inline display. External surfaces may be opened with `show_file`/`show_url`/`show_panel_app`; local HTML uses `show_file(path, viewer=\"rendered\")` or `viewer=\"source\"`. Do not convert HTML to a Panel App just to preview it.",
      `Visualization assets: put conversation-only files in \`${resolveVisualizationAssetDirectory(request)}\`; create it as needed, use absolute inline \`file\` paths, and never use \`/tmp\`, temporary directories, the project, or cwd. Use the project only for project-owned deliverables.`,
    ].join("\n"),
  ];
}
