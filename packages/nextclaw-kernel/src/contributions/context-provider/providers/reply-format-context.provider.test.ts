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

    expect(context).toContain("## Reply Formatting");
    expect(context).toContain("[AGENTS.md](AGENTS.md)");
    expect(context).toContain("[file](packages/example/file.ts)");
    expect(context).toContain("Use project-relative links");
    expect(context).toContain("absolute links only for files outside it");
  });
});
