import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";

export class ReplyFormatContextProvider implements ContextProvider {
  provide = (_request: AgentRunRequest): readonly ContextBlock[] => [
    "## Reply Formatting Contract\nGoal: local openable files mentioned in user-visible replies must be clickable.\nAllowed form: use Markdown links only, with a plain text label and an openable href: [MEMORY.md](MEMORY.md), [file](packages/example/file.ts), [notes.md](/Users/example/Documents/notes.md).\nPath choice: use project-relative hrefs for files under the active/session project root, and absolute hrefs for local files outside it.\nForbidden forms: bare file names or paths, inline-code file names, bold-only file names, code-styled link labels, code blocks for file references, and unlinked comma-separated file lists.\nExamples: bad `MEMORY.md` -> good [MEMORY.md](MEMORY.md); bad `memory/` -> good [memory/](memory/); bad `2026-03-07.md` / `feishu-notes.md` -> good [2026-03-07.md](memory/2026-03-07.md) / [feishu-notes.md](memory/feishu-notes.md).\nSelf-check before sending: scan the final visible reply for local file names or paths. If every concrete file cannot be linked, remove the exact names and summarize instead.",
  ];
}
