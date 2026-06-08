import { describe, expect, it } from "vitest";
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

    expect(context).toContain("## Reply Formatting Contract");
    expect(context).toContain("Goal:");
    expect(context).toContain("Allowed form:");
    expect(context).toContain("Path choice:");
    expect(context).toContain("Forbidden forms:");
    expect(context).toContain("Examples:");
    expect(context).toContain("Self-check before sending:");
    expect(context).toContain("must be clickable");
    expect(context).toContain("Markdown links only");
    expect(context).toContain("plain text label");
    expect(context).toContain("[MEMORY.md](MEMORY.md)");
    expect(context).toContain("[file](packages/example/file.ts)");
    expect(context).toContain("[notes.md](/Users/example/Documents/notes.md)");
    expect(context).toContain("project-relative hrefs");
    expect(context).toContain("absolute hrefs");
    expect(context).toContain("inline-code file names");
    expect(context).toContain("code-styled link labels");
    expect(context).toContain("unlinked comma-separated file lists");
    expect(context).toContain("bad `MEMORY.md` -> good [MEMORY.md](MEMORY.md)");
    expect(context).toContain("bad `memory/` -> good [memory/](memory/)");
    expect(context).toContain(
      "bad `2026-03-07.md` / `feishu-notes.md`",
    );
    expect(context).toContain("[2026-03-07.md](memory/2026-03-07.md)");
    expect(context).toContain("[feishu-notes.md](memory/feishu-notes.md)");
    expect(context).toContain("remove the exact names and summarize instead");
  });
});
