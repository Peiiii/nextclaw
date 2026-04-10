import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ContextBuilder } from "../context.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-context-test-"));
  tempWorkspaces.push(workspace);
  return workspace;
}

afterEach(() => {
  while (tempWorkspaces.length > 0) {
    const workspace = tempWorkspaces.pop();
    if (!workspace) {
      continue;
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("ContextBuilder tool catalog", () => {
  it("renders the runtime tool catalog into the system prompt", () => {
    const workspace = createWorkspace();
    const builder = new ContextBuilder(workspace);

    const prompt = builder.buildSystemPrompt(undefined, undefined, undefined, [
      { name: "read_file", description: "Read file contents" },
      { name: "feishu_doc", description: "Feishu document operations" },
      { name: "feishu_wiki", description: "Feishu knowledge base operations" },
    ]);

    expect(prompt).toContain("- read_file: Read file contents");
    expect(prompt).toContain("- feishu_doc: Feishu document operations");
    expect(prompt).toContain("- feishu_wiki: Feishu knowledge base operations");
    expect(prompt).not.toContain("- gateway: Restart/apply config/update running process");
  });

  it("includes skill descriptions in the available skills list", () => {
    const workspace = createWorkspace();
    mkdirSync(join(workspace, "skills", "demo-skill"), { recursive: true });
    writeFileSync(
      join(workspace, "skills", "demo-skill", "SKILL.md"),
      [
        "---",
        "name: demo-skill",
        "description: Demo skill for routing tests",
        "---",
        "",
        "Use the demo skill instructions.",
      ].join("\n"),
    );
    const builder = new ContextBuilder(workspace);

    const prompt = builder.buildSystemPrompt();

    expect(prompt).toContain("<name>demo-skill</name>");
    expect(prompt).toContain("<description>Demo skill for routing tests</description>");
  });

  it("tells the agent to check current time before converting relative schedules", () => {
    const workspace = createWorkspace();
    const builder = new ContextBuilder(workspace);

    const prompt = builder.buildSystemPrompt();

    expect(prompt).toContain("For relative time/date scheduling requests");
    expect(prompt).toContain("first check the current local time");
    expect(prompt).toContain("Do not guess.");
  });

  it("explains inline skill tokens from the chat composer", () => {
    const workspace = createWorkspace();
    const builder = new ContextBuilder(workspace);

    const prompt = builder.buildSystemPrompt();

    expect(prompt).toContain("## Chat Composer Tokens");
    expect(prompt).toContain("`$weather`");
    expect(prompt).toContain("explicitly selected in the chat composer");
  });

  it("guides cross-session delivery through message plus route discovery", () => {
    const workspace = createWorkspace();
    const builder = new ContextBuilder(workspace);

    const prompt = builder.buildSystemPrompt();

    expect(prompt).toContain("Cross-session or cross-channel messaging");
    expect(prompt).toContain("use sessions_list first");
  });

  it("includes agent management in the NextClaw self-management guide", () => {
    const workspace = createWorkspace();
    const builder = new ContextBuilder(workspace);

    const prompt = builder.buildSystemPrompt();

    expect(prompt).toContain("self-management operations");
    expect(prompt).toContain("service/plugins/channels/config/agents/cron/remote/update");
    expect(prompt).toContain("resources/USAGE.md");
    expect(prompt).not.toContain(`${workspace}/USAGE.md`);
    expect(prompt).toContain("Do not load unrelated generic skills before reading the built-in self-management guide");
    expect(prompt).toContain("deprecated artifacts");
    expect(prompt).toContain("agents list|new|update|remove --json");
    expect(prompt).toContain("avoid text/initial-based avatar styles");
  });

  it("allows callers to override how attachments become user content", () => {
    const workspace = createWorkspace();
    const builder = new ContextBuilder(workspace, undefined, {
      buildUserContent: ({ text, attachments }) => [
        { type: "text", text: `override:${text}` },
        { type: "text", text: `attachments:${attachments.length}` },
      ],
    });

    const messages = builder.buildMessages({
      history: [],
      currentMessage: "hello",
      attachments: [{ name: "notes.md", mimeType: "text/markdown" }],
    });

    expect(messages[1]?.role).toBe("user");
    expect(messages[1]?.content).toEqual([
      { type: "text", text: "override:hello" },
      { type: "text", text: "attachments:1" },
    ]);
  });
});
