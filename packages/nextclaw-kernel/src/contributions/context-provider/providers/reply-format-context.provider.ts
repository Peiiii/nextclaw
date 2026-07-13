import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";

export class ReplyFormatContextProvider implements ContextProvider {
  provide = (_request: AgentRunRequest): readonly ContextBlock[] => [
    [
      "## Reply Formatting Contract",
      "Goal: openable files in user-visible replies must be clickable, local images should appear directly in the reply when appropriate, and inert inline display declarations are only for content that should appear as part of the reply.",
      "File links: use Markdown links only, with a plain text label and an openable href: [MEMORY.md](MEMORY.md), [report.docx](report.docx), [file](packages/example/file.ts), [notes.md](/Users/example/Documents/notes.md). Use project-relative hrefs for files under the active/session project root, and absolute hrefs for local files outside it. File links open source by default; supported visual and Office documents open their automatic preview. Use a viewer query such as [diagram.svg](diagram.svg?viewer=source) when source is explicitly required, or [preview.html](preview.html?viewer=rendered) when an HTML link should open rendered output.",
      "Markdown syntax and resource availability are separate: emit a proper Markdown link even when you cannot verify that its target still exists. The UI will report missing or unavailable content when the user opens it; never downgrade a valid link to bare text preemptively.",
      "Local images: prefer standard Markdown image syntax when the image should be visible in the reply: ![chart](assets/chart.png) or ![diagram](/Users/example/Pictures/diagram.svg). Local image hrefs follow the same project-relative or absolute path rules as file links. Do not invent an internal API URL or a file:// URL. Use show_file only when the file should immediately open in the side panel; use view_image only to give the model visual input.",
      "Inline display: when the final reply should include a non-clickable inline display placeholder, output a fenced `nextclaw-inline` JSON block:",
      '```nextclaw-inline\n{"target":{"type":"panel_app","payload":{"appId":"timer"}},"title":"Timer"}\n```',
      "Supported targets are `panel_app`, `json`, `file`, and `url`. Prefer `panel_app` for inline Panel App display; use `file` and `url` only as non-clickable placeholders when a clickable link is not intended; use `json` for inert JSON snapshots.",
      "It is display-only: no opening, executing, or tool action. Never call `show_panel_app` for inline display; `show_panel_app` is only for immediately opening a Panel App outside the final reply in the side panel. Use Markdown links for clickable resources and show_file/show_url/show_panel_app tools only when you want the UI to immediately show or run content outside the final reply.",
      "Forbidden forms: bare file names or paths, inline-code file names, bold-only file names, code-styled link labels, code blocks for file references, file:// URLs, internal API URLs, action semantics inside `nextclaw-inline`, tool calls for inline display, and unlinked comma-separated file lists.",
      "Examples: bad `MEMORY.md` -> good [MEMORY.md](MEMORY.md); bad `memory/` -> good [memory/](memory/); bad `report.docx` -> good [report.docx](report.docx); bad `/Users/example/chart.png` -> good ![chart](/Users/example/chart.png); bad `2026-03-07.md` / `feishu-notes.md` -> good [2026-03-07.md](memory/2026-03-07.md) / [feishu-notes.md](memory/feishu-notes.md).",
      "Self-check before sending: scan the final visible reply for local file names, paths, and images. Make every concrete file clickable, render intended images with Markdown image syntax, or ensure it is intentionally represented by `nextclaw-inline`; otherwise remove the exact names and summarize instead.",
    ].join("\n"),
  ];
}
