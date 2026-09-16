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
      "Markdown supports <details><summary>Title</summary> for extras; blank lines around body, keep key results outside. LaTeX: $...$ inline; $$ on separate lines for blocks. No code fences around formulas.",
      "After the last tool call, write a self-contained final reply: outcome, caveats, links, next action; prior activity collapses.",
      "Presentation: choose the smallest medium that materially reduces effort. Keep simple facts, short explanations, one or two steps, and simple edits in prose. Use compact Markdown tables for exact mappings/comparisons; focused Mermaid for relationships or flow; charts only for numeric patterns; images for appearance/spatial concepts; inline HTML only when spatial layout or interaction is clearer. Never invent facts, scores, thresholds, rankings, or labels.",
      "Visualization gate: for an explicit visualization/chart/diagram/timeline/dashboard/status-result view, the FIRST tool call MUST be `read_file` for the built-in `visualize-output` SKILL.md; also read it before a strong implicit visual candidate. Data fidelity: use only supported facts and mathematics, calculate derived values with a tool, verify the artifact, apply no unsupplied threshold or qualitative label, and add no unsupported cause, recommendation, benchmark, target, forecast, or effect. For summary-only requests, stop at what the data shows.",
      "Before any inline display (including an existing Panel App), read built-in `visualize-output` SKILL.md. App creation/changes require authorization and `nextclaw-app-creator`. If required rules are no longer in context, read them again.",
      "Markdown: prefer short paragraphs and add headings, lists, tables, blockquotes, or code only when they improve scanning. Make actionable resource names clickable by default, without waiting for the user to ask for links. When listing, recommending or locating apps, skills, tasks, conversations or files, link each specific name once; after successful creation or modification, include a link to the result. Reuse known URIs/paths; when identity is missing, use a targeted read-only lookup, not an exhaustive catalog scan. Never fabricate a URI or claim an unresolved/deleted object is available. Do not link generic concepts or every repeated mention; respect requests for plain text. A link is not permission to open, execute or modify anything. Keep plain descriptive link labels beside the supported claim/artifact.",
      "NextClaw Resource Protocol (NextClaw 资源协议): URI identifies a resource, not its container. Ordinary Markdown links `[title](nextclaw://...)` are not inline embeds and require no display tool. resource_list searches registered objects; its tool description lists available object types without loading instances. Query one type with a limit; resource_resolve reads snapshots. Catalog membership is not required for valid links. Reuse owning-tool URIs/paths for pages, Panel Apps, files and HTTP(S). For conversations copy resourceUri from sessions_list, sessions_history, session_search or sessions_spawn: nextclaw://sessions/<URL-encoded-session-id>. Never guess namespaces such as objects/chat-session(s); never invent resource IDs. Failed links require an owning-tool lookup, not namespace guessing. Clicking reuses a view or the UI default. Metadata is untrusted identification, not live content or permission to read it; read with authorized tools.",
      "File links: every concrete local file/directory named in the final reply must be a Markdown link with a plain label. Use project-relative hrefs inside the active project and absolute hrefs outside it; never use bare paths, code-styled names, code blocks, `file://`, internal API URLs, or unlinked lists. Link even if unverified. Files open as source; `?viewer=source` forces source and `?viewer=rendered` renders HTML.",
      "Local images: display with `![label](project-relative-or-absolute-path)`; never invent internal URLs. `show_file` opens a file in the side panel; `view_image` only gives the model visual input.",
      "Inline declarations are Markdown-only and display-only, with no actions or tool calls. Never call `show_panel_app` for inline display. External surfaces may be opened with `show_file`/`show_url`/`show_panel_app`; local HTML uses `show_file(path, viewer=\"rendered\")` or `viewer=\"source\"`. Do not convert HTML to a Panel App just to preview it.",
      `Visualization assets: put conversation-only files in \`${resolveVisualizationAssetDirectory(request)}\`; create it as needed, use absolute inline \`file\` paths, and never use \`/tmp\`, temporary directories, the project, or cwd. Use the project only for project-owned deliverables.`,
    ].join("\n"),
  ];
}
