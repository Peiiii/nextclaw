import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";

export class ReplyFormatContextProvider implements ContextProvider {
  provide = (_request: AgentRunRequest): readonly ContextBlock[] => [
    [
      "## Reply Formatting",
      "- When mentioning a local project file in a user-visible reply, prefer a Markdown link such as `[AGENTS.md](AGENTS.md)` or `[file](packages/example/file.ts)` so the user can open it.",
      "- Use project-relative links for files under the active/session-bound project root; use absolute links only for files outside it.",
    ].join("\n"),
  ];
}
